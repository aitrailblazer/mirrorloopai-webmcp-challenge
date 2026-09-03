package commerce

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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

type OrderMailer interface {
	SendBuyerOrderReceived(context.Context, string, string, []OrderItem) error
	SendOwnerOrderNotification(context.Context, string, string, []OrderItem) error
}

type EventStore interface {
	Processed(context.Context, string) (bool, error)
	MarkProcessed(context.Context, string, time.Time) error
}

type WebhookHandler struct {
	secret      string
	mailer      OrderMailer
	store       EventStore
	fulfillment FulfillmentProvider
	now         func() time.Time
}

func NewWebhookHandler(secret string, mailer OrderMailer, store EventStore) http.Handler {
	return &WebhookHandler{
		secret: strings.TrimSpace(secret),
		mailer: mailer,
		store:  store,
		now:    time.Now,
	}
}

func NewFulfillmentWebhookHandler(
	secret string,
	mailer OrderMailer,
	store EventStore,
	fulfillment FulfillmentProvider,
) http.Handler {
	handler := NewWebhookHandler(secret, mailer, store).(*WebhookHandler)
	handler.fulfillment = fulfillment
	return handler
}

func (h *WebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.secret == "" || h.mailer == nil || h.store == nil {
		http.Error(w, "webhook unavailable", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxWebhookBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "invalid webhook", http.StatusBadRequest)
		return
	}
	if err := verifyStripeSignature(
		body,
		r.Header.Get("Stripe-Signature"),
		h.secret,
		h.now(),
	); err != nil {
		http.Error(w, "invalid signature", http.StatusBadRequest)
		return
	}

	var event struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID              string `json:"id"`
				PaymentStatus   string `json:"payment_status"`
				CustomerEmail   string `json:"customer_email"`
				CustomerDetails struct {
					Email string `json:"email"`
				} `json:"customer_details"`
				Metadata map[string]string `json:"metadata"`
			} `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &event); err != nil {
		http.Error(w, "invalid webhook", http.StatusBadRequest)
		return
	}
	if event.Type != "checkout.session.completed" &&
		event.Type != "checkout.session.async_payment_succeeded" {
		w.WriteHeader(http.StatusOK)
		return
	}
	session := event.Data.Object
	if session.PaymentStatus != "paid" {
		w.WriteHeader(http.StatusOK)
		return
	}
	email := strings.TrimSpace(session.CustomerDetails.Email)
	if email == "" {
		email = strings.TrimSpace(session.CustomerEmail)
	}
	items, ok := orderItems(session.Metadata["cart_skus"])
	if event.ID == "" || session.ID == "" || email == "" || !ok {
		slog.ErrorContext(r.Context(), "paid Stripe order lacks fulfillment metadata",
			"event_id", event.ID, "session_id", session.ID)
		w.WriteHeader(http.StatusOK)
		return
	}
	processed, err := h.store.Processed(r.Context(), session.ID)
	if err != nil {
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	if processed {
		w.WriteHeader(http.StatusOK)
		return
	}
	if needsDigitalFulfillment(items) {
		if h.fulfillment == nil {
			http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
			return
		}
		items, err = h.fulfillment.Prepare(r.Context(), items, h.now())
		if err != nil {
			slog.ErrorContext(r.Context(), "digital fulfillment preparation failed",
				"event_id", event.ID, "session_id", session.ID, "error", err)
			http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
			return
		}
	}
	if err := h.mailer.SendBuyerOrderReceived(
		r.Context(), session.ID, email, items,
	); err != nil {
		slog.ErrorContext(r.Context(), "buyer order email failed",
			"event_id", event.ID, "session_id", session.ID, "error", err)
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	if err := h.mailer.SendOwnerOrderNotification(
		r.Context(), session.ID, email, items,
	); err != nil {
		slog.ErrorContext(r.Context(), "owner order email failed",
			"event_id", event.ID, "session_id", session.ID, "error", err)
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	if err := h.store.MarkProcessed(r.Context(), session.ID, h.now().UTC()); err != nil {
		http.Error(w, "temporary webhook failure", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func orderItems(value string) ([]OrderItem, bool) {
	raw := strings.Split(value, ",")
	if value == "" || len(raw) > maxCartItems {
		return nil, false
	}
	items := make([]OrderItem, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		sku := strings.TrimSpace(item)
		name, ok := productNames[sku]
		if !ok {
			return nil, false
		}
		if _, duplicate := seen[sku]; duplicate {
			return nil, false
		}
		seen[sku] = struct{}{}
		items = append(items, OrderItem{SKU: sku, Name: name})
	}
	return items, true
}

func needsDigitalFulfillment(items []OrderItem) bool {
	for _, item := range items {
		if _, _, ok := fulfillmentObject(item.SKU); ok {
			return true
		}
	}
	return false
}

func verifyStripeSignature(body []byte, header, secret string, now time.Time) error {
	var timestamp int64
	var signatures [][]byte
	for _, part := range strings.Split(header, ",") {
		key, value, found := strings.Cut(strings.TrimSpace(part), "=")
		if !found {
			continue
		}
		switch key {
		case "t":
			parsed, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return errors.New("invalid timestamp")
			}
			timestamp = parsed
		case "v1":
			decoded, err := hex.DecodeString(value)
			if err == nil {
				signatures = append(signatures, decoded)
			}
		}
	}
	if timestamp == 0 || len(signatures) == 0 {
		return errors.New("signature fields missing")
	}
	eventTime := time.Unix(timestamp, 0)
	age := now.Sub(eventTime)
	if age < -signatureMaxAge || age > signatureMaxAge {
		return errors.New("signature timestamp outside tolerance")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(strconv.FormatInt(timestamp, 10)))
	_, _ = mac.Write([]byte("."))
	_, _ = mac.Write(body)
	expected := mac.Sum(nil)
	for _, signature := range signatures {
		if hmac.Equal(expected, signature) {
			return nil
		}
	}
	return errors.New("signature mismatch")
}
