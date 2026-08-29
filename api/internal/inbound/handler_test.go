package inbound

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

type forwarderStub struct {
	calls []string
	err   error
}

func (s *forwarderStub) Forward(_ context.Context, emailID string) error {
	s.calls = append(s.calls, emailID)
	return s.err
}

func signedRequest(
	t *testing.T,
	body []byte,
	secret string,
	now time.Time,
) *http.Request {
	t.Helper()
	messageID := "msg_test"
	timestamp := strconv.FormatInt(now.Unix(), 10)
	key, err := base64.StdEncoding.DecodeString(secret[len("whsec_"):])
	if err != nil {
		t.Fatal(err)
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(messageID + "." + timestamp + "."))
	_, _ = mac.Write(body)
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/resend/inbound",
		bytes.NewReader(body),
	)
	req.Header.Set("svix-id", messageID)
	req.Header.Set("svix-timestamp", timestamp)
	req.Header.Set("svix-signature", "v1,"+signature)
	return req
}

func TestHandlerForwardsReceivedEmailOnce(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "whsec_" + base64.StdEncoding.EncodeToString([]byte("test-secret"))
	forwarder := &forwarderStub{}
	store := NewMemoryEventStore()
	handler := NewHandler(secret, forwarder, store).(*Handler)
	handler.now = func() time.Time { return now }
	body := []byte(`{"type":"email.received","data":{"email_id":"email_123","from":"visitor@example.com"}}`)

	for range 2 {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, signedRequest(t, body, secret, now))
		if response.Code != http.StatusOK {
			t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
		}
	}
	if len(forwarder.calls) != 1 || forwarder.calls[0] != "email_123" {
		t.Fatalf("forward calls=%v", forwarder.calls)
	}
}

func TestHandlerRejectsBadSignatureAndRetriesForwardingError(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	secret := "whsec_" + base64.StdEncoding.EncodeToString([]byte("test-secret"))
	body := []byte(`{"type":"email.received","data":{"email_id":"email_123","from":"visitor@example.com"}}`)

	forwarder := &forwarderStub{}
	handler := NewHandler(secret, forwarder, NewMemoryEventStore()).(*Handler)
	handler.now = func() time.Time { return now }
	bad := signedRequest(t, body, secret, now)
	bad.Header.Set("svix-signature", "v1,bad")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, bad)
	if response.Code != http.StatusBadRequest || len(forwarder.calls) != 0 {
		t.Fatalf("status=%d calls=%v", response.Code, forwarder.calls)
	}

	forwarder.err = errors.New("provider unavailable")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, signedRequest(t, body, secret, now))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d", response.Code)
	}
}
