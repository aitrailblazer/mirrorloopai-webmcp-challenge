package commerce

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

type webhookMailerStub struct {
	buyerCalls int
	ownerCalls int
	buyerEmail string
	items      []string
	err        error
}

func (s *webhookMailerStub) SendBuyerOrderReceived(
	_ context.Context,
	_, email string,
	items []string,
) error {
	s.buyerCalls++
	s.buyerEmail = email
	s.items = items
	return s.err
}

func (s *webhookMailerStub) SendOwnerOrderNotification(
	_ context.Context,
	_, _ string,
	_ []string,
) error {
	s.ownerCalls++
	return s.err
}

func signedWebhookRequest(
	t *testing.T,
	body, secret string,
	at time.Time,
) *http.Request {
	t.Helper()
	timestamp := strconv.FormatInt(at.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp + "." + body))
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/stripe/webhook",
		strings.NewReader(body),
	)
	request.Header.Set(
		"Stripe-Signature",
		"t="+timestamp+",v1="+hex.EncodeToString(mac.Sum(nil)),
	)
	return request
}

func TestPaidCheckoutSendsBothEmailsOnlyOnce(t *testing.T) {
	now := time.Date(2026, 8, 28, 1, 2, 3, 0, time.UTC)
	mailer := &webhookMailerStub{}
	store := NewMemoryEventStore()
	handler := NewWebhookHandler("whsec_test", mailer, store).(*WebhookHandler)
	handler.now = func() time.Time { return now }
	body := `{
		"id":"evt_test",
		"type":"checkout.session.completed",
		"data":{"object":{
			"id":"cs_test_order",
			"payment_status":"paid",
			"customer_details":{"email":"buyer@example.com"},
			"metadata":{"cart_skus":"arc-01-mono,deck-color-visual"}
		}}
	}`
	for range 2 {
		response := httptest.NewRecorder()
		handler.ServeHTTP(
			response,
			signedWebhookRequest(t, body, "whsec_test", now),
		)
		if response.Code != http.StatusOK {
			t.Fatalf("got %d: %s", response.Code, response.Body.String())
		}
	}
	if mailer.buyerCalls != 1 || mailer.ownerCalls != 1 {
		t.Fatalf("email calls buyer=%d owner=%d", mailer.buyerCalls, mailer.ownerCalls)
	}
	if mailer.buyerEmail != "buyer@example.com" {
		t.Fatalf("buyer email=%q", mailer.buyerEmail)
	}
	if len(mailer.items) != 2 ||
		!strings.Contains(mailer.items[0], "ARC 01") ||
		!strings.Contains(mailer.items[1], "144-Card") {
		t.Fatalf("items=%#v", mailer.items)
	}
}

func TestWebhookRejectsBadOrExpiredSignatures(t *testing.T) {
	now := time.Date(2026, 8, 28, 1, 2, 3, 0, time.UTC)
	handler := NewWebhookHandler(
		"whsec_test",
		&webhookMailerStub{},
		NewMemoryEventStore(),
	).(*WebhookHandler)
	handler.now = func() time.Time { return now }
	body := `{"id":"evt_test","type":"checkout.session.completed"}`
	for name, request := range map[string]*http.Request{
		"bad secret": signedWebhookRequest(t, body, "wrong", now),
		"expired":    signedWebhookRequest(t, body, "whsec_test", now.Add(-6*time.Minute)),
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("%s: got %d", name, response.Code)
		}
	}
}

func TestWebhookRetriesWhenEmailFails(t *testing.T) {
	now := time.Date(2026, 8, 28, 1, 2, 3, 0, time.UTC)
	mailer := &webhookMailerStub{err: errors.New("temporary provider error")}
	store := NewMemoryEventStore()
	handler := NewWebhookHandler("whsec_test", mailer, store).(*WebhookHandler)
	handler.now = func() time.Time { return now }
	body := `{
		"id":"evt_test",
		"type":"checkout.session.completed",
		"data":{"object":{
			"id":"cs_test_retry",
			"payment_status":"paid",
			"customer_details":{"email":"buyer@example.com"},
			"metadata":{"cart_skus":"arc-01-mono"}
		}}
	}`
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, signedWebhookRequest(t, body, "whsec_test", now))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d", response.Code)
	}
	processed, err := store.Processed(context.Background(), "cs_test_retry")
	if err != nil || processed {
		t.Fatalf("processed=%v err=%v", processed, err)
	}
}
