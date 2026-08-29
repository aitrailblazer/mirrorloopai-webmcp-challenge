package inbound

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	maxWebhookBytes = 256 << 10
	signatureMaxAge = 5 * time.Minute
)

type Forwarder interface {
	Forward(context.Context, string) error
}

type EventStore interface {
	Processed(context.Context, string) (bool, error)
	MarkProcessed(context.Context, string, time.Time) error
}

type Handler struct {
	secret    string
	forwarder Forwarder
	store     EventStore
	now       func() time.Time
}

func NewHandler(secret string, forwarder Forwarder, store EventStore) http.Handler {
	return &Handler{
		secret:    strings.TrimSpace(secret),
		forwarder: forwarder,
		store:     store,
		now:       time.Now,
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.secret == "" || h.forwarder == nil || h.store == nil {
		http.Error(w, "webhook unavailable", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxWebhookBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid webhook", http.StatusBadRequest)
		return
	}
	if err := verifySvixSignature(body, r.Header, h.secret, h.now()); err != nil {
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	var event struct {
		Type string `json:"type"`
		Data struct {
			EmailID string `json:"email_id"`
			From    string `json:"from"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "invalid webhook", http.StatusBadRequest)
		return
	}
	if event.Type != "email.received" {
		w.WriteHeader(http.StatusOK)
		return
	}
	emailID := strings.TrimSpace(event.Data.EmailID)
	if emailID == "" {
		http.Error(w, "invalid webhook", http.StatusBadRequest)
		return
	}
	processed, err := h.store.Processed(r.Context(), emailID)
	if err != nil {
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	if processed {
		w.WriteHeader(http.StatusOK)
		return
	}
	if err := h.forwarder.Forward(r.Context(), emailID); err != nil {
		slog.ErrorContext(r.Context(), "inbound email forwarding failed",
			"email_id", emailID, "error", err)
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	if err := h.store.MarkProcessed(r.Context(), emailID, h.now().UTC()); err != nil {
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func verifySvixSignature(
	body []byte,
	header http.Header,
	secret string,
	now time.Time,
) error {
	messageID := strings.TrimSpace(header.Get("svix-id"))
	timestampValue := strings.TrimSpace(header.Get("svix-timestamp"))
	if messageID == "" || timestampValue == "" {
		return errors.New("signature fields missing")
	}
	timestamp, err := strconv.ParseInt(timestampValue, 10, 64)
	if err != nil {
		return errors.New("invalid timestamp")
	}
	eventTime := time.Unix(timestamp, 0)
	age := now.Sub(eventTime)
	if age < -signatureMaxAge || age > signatureMaxAge {
		return errors.New("signature timestamp outside tolerance")
	}
	keyValue := strings.TrimPrefix(strings.TrimSpace(secret), "whsec_")
	key, err := base64.StdEncoding.DecodeString(keyValue)
	if err != nil {
		key, err = base64.RawStdEncoding.DecodeString(keyValue)
	}
	if err != nil || len(key) == 0 {
		return errors.New("invalid signing secret")
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(messageID))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write([]byte(timestampValue))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write(body)
	expected := mac.Sum(nil)
	for _, part := range strings.Fields(header.Get("svix-signature")) {
		version, encoded, found := strings.Cut(part, ",")
		if !found || version != "v1" {
			continue
		}
		signature, decodeErr := base64.StdEncoding.DecodeString(encoded)
		if decodeErr == nil && hmac.Equal(expected, signature) {
			return nil
		}
	}
	return errors.New("signature mismatch")
}
