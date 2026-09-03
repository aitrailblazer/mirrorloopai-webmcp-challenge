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
	items      []OrderItem
	err        error
}

func (s *webhookMailerStub) SendBuyerOrderReceived(
	_ context.Context,
	_, email string,
	items []OrderItem,
) error {
	s.buyerCalls++
	s.buyerEmail = email
	s.items = items
	return s.err
}

func (s *webhookMailerStub) SendOwnerOrderNotification(
	_ context.Context,
	_, _ string,
	_ []OrderItem,
) error {
	s.ownerCalls++
	return s.err
}

type fulfillmentStub struct {
	calls int
	err   error
}

func (s *fulfillmentStub) Prepare(
	_ context.Context,
	items []OrderItem,
	now time.Time,
) ([]OrderItem, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	prepared := append([]OrderItem(nil), items...)
	for index := range prepared {
		if _, _, ok := fulfillmentObject(prepared[index].SKU); ok {
			prepared[index].DownloadURL = "https://storage.example/" + prepared[index].SKU
			prepared[index].ExpiresAt = now.Add(fulfillmentLinkLifetime)
		}
	}
	return prepared, nil
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
	fulfillment := &fulfillmentStub{}
	handler := NewFulfillmentWebhookHandler(
		"whsec_test", mailer, store, fulfillment,
	).(*WebhookHandler)
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
		!strings.Contains(mailer.items[0].Name, "ARC 01") ||
		!strings.Contains(mailer.items[1].Name, "144-Card") {
		t.Fatalf("items=%#v", mailer.items)
	}
	if mailer.items[0].DownloadURL == "" || mailer.items[1].DownloadURL != "" {
		t.Fatalf("fulfillment links=%#v", mailer.items)
	}
	if fulfillment.calls != 1 {
		t.Fatalf("fulfillment calls=%d", fulfillment.calls)
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
	handler := NewFulfillmentWebhookHandler(
		"whsec_test", mailer, store, &fulfillmentStub{},
	).(*WebhookHandler)
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

func TestWebhookRetriesWhenFulfillmentFails(t *testing.T) {
	now := time.Date(2026, 8, 28, 1, 2, 3, 0, time.UTC)
	mailer := &webhookMailerStub{}
	store := NewMemoryEventStore()
	handler := NewFulfillmentWebhookHandler(
		"whsec_test",
		mailer,
		store,
		&fulfillmentStub{err: errors.New("temporary storage error")},
	).(*WebhookHandler)
	handler.now = func() time.Time { return now }
	body := `{
		"id":"evt_test",
		"type":"checkout.session.completed",
		"data":{"object":{
			"id":"cs_test_fulfillment_retry",
			"payment_status":"paid",
			"customer_details":{"email":"buyer@example.com"},
			"metadata":{"cart_skus":"arc-12-mono"}
		}}
	}`
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, signedWebhookRequest(t, body, "whsec_test", now))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d", response.Code)
	}
	if mailer.buyerCalls != 0 || mailer.ownerCalls != 0 {
		t.Fatalf("email calls buyer=%d owner=%d", mailer.buyerCalls, mailer.ownerCalls)
	}
	processed, err := store.Processed(context.Background(), "cs_test_fulfillment_retry")
	if err != nil || processed {
		t.Fatalf("processed=%v err=%v", processed, err)
	}
}

func TestUnpaidCheckoutDoesNotPrepareOrEmailFulfillment(t *testing.T) {
	now := time.Date(2026, 8, 28, 1, 2, 3, 0, time.UTC)
	mailer := &webhookMailerStub{}
	fulfillment := &fulfillmentStub{}
	handler := NewFulfillmentWebhookHandler(
		"whsec_test",
		mailer,
		NewMemoryEventStore(),
		fulfillment,
	).(*WebhookHandler)
	handler.now = func() time.Time { return now }
	body := `{
		"id":"evt_test_unpaid",
		"type":"checkout.session.completed",
		"data":{"object":{
			"id":"cs_test_unpaid",
			"payment_status":"unpaid",
			"customer_details":{"email":"buyer@example.com"},
			"metadata":{"cart_skus":"arc-01-color"}
		}}
	}`
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, signedWebhookRequest(t, body, "whsec_test", now))
	if response.Code != http.StatusOK {
		t.Fatalf("got %d", response.Code)
	}
	if fulfillment.calls != 0 || mailer.buyerCalls != 0 || mailer.ownerCalls != 0 {
		t.Fatalf(
			"fulfillment=%d buyer=%d owner=%d",
			fulfillment.calls,
			mailer.buyerCalls,
			mailer.ownerCalls,
		)
	}
}
