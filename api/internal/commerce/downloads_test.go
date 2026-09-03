package commerce

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type downloadSessionStub struct {
	session CheckoutSession
	err     error
	calls   int
}

func (s *downloadSessionStub) RetrieveCheckoutSession(
	_ context.Context,
	_ string,
) (CheckoutSession, error) {
	s.calls++
	return s.session, s.err
}

func paidDownloadSession(id, skus string) CheckoutSession {
	return CheckoutSession{
		ID:            id,
		PaymentStatus: "paid",
		Status:        "complete",
		Metadata: map[string]string{
			"source":       shopSource,
			"cart_version": shopCartVersion,
			"cart_skus":    skus,
		},
	}
}

func downloadRequest(t *testing.T, handler http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/order-downloads",
		strings.NewReader(body),
	)
	request.Header.Set("Origin", "https://mirrorloopai.com")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	return response
}

func TestPaidOrderReturnsFreshDownloadsAndSeparateDeliveryItems(t *testing.T) {
	const sessionID = "cs_test_12345678"
	retriever := &downloadSessionStub{
		session: paidDownloadSession(
			sessionID,
			"arc-01-mono,deck-color-visual",
		),
	}
	fulfillment := &fulfillmentStub{}
	handler := NewDownloadHandler(
		retriever,
		fulfillment,
		[]string{"https://mirrorloopai.com"},
	).(*DownloadHandler)
	now := time.Date(2026, 9, 3, 12, 0, 0, 0, time.UTC)
	handler.now = func() time.Time { return now }

	response := downloadRequest(
		t,
		handler,
		`{"session_id":"cs_test_12345678"}`,
	)
	if response.Code != http.StatusOK {
		t.Fatalf("got %d: %s", response.Code, response.Body.String())
	}
	var payload struct {
		Status string         `json:"status"`
		Items  []downloadItem `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Status != "ready" || len(payload.Items) != 2 {
		t.Fatalf("payload=%#v", payload)
	}
	if payload.Items[0].Delivery != "download" ||
		payload.Items[0].DownloadURL == "" ||
		payload.Items[0].ExpiresAt == "" {
		t.Fatalf("download item=%#v", payload.Items[0])
	}
	if payload.Items[1].Delivery != "separate" ||
		payload.Items[1].DownloadURL != "" {
		t.Fatalf("separate item=%#v", payload.Items[1])
	}
	if fulfillment.calls != 1 {
		t.Fatalf("fulfillment calls=%d", fulfillment.calls)
	}
	for _, forbidden := range []string{"buyer@example.com", "amount_total", "customer"} {
		if strings.Contains(response.Body.String(), forbidden) {
			t.Fatalf("response leaked %q", forbidden)
		}
	}
	if response.Header().Get("Cache-Control") != "no-store" ||
		response.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("security headers=%v", response.Header())
	}
}

func TestDownloadPanelRejectsUnpaidAndForeignSessions(t *testing.T) {
	const sessionID = "cs_test_abcdefgh"
	retriever := &downloadSessionStub{
		session: paidDownloadSession(sessionID, "arc-01-color"),
	}
	retriever.session.PaymentStatus = "unpaid"
	fulfillment := &fulfillmentStub{}
	handler := NewDownloadHandler(
		retriever,
		fulfillment,
		[]string{"https://mirrorloopai.com"},
	)

	response := downloadRequest(
		t,
		handler,
		`{"session_id":"cs_test_abcdefgh"}`,
	)
	if response.Code != http.StatusConflict {
		t.Fatalf("unpaid got %d: %s", response.Code, response.Body.String())
	}
	if fulfillment.calls != 0 {
		t.Fatalf("unpaid fulfillment calls=%d", fulfillment.calls)
	}

	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/order-downloads",
		strings.NewReader(`{"session_id":"cs_test_abcdefgh"}`),
	)
	request.Header.Set("Origin", "https://evil.example")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("foreign origin got %d", response.Code)
	}
	if retriever.calls != 1 {
		t.Fatalf("retriever calls=%d", retriever.calls)
	}
}

func TestDownloadPanelValidatesSessionAndOrderMetadata(t *testing.T) {
	const sessionID = "cs_test_abcdefgh"
	for name, testCase := range map[string]struct {
		configure func(*CheckoutSession)
		expected  int
	}{
		"wrong source": {
			configure: func(session *CheckoutSession) {
				session.Metadata["source"] = "other.example"
			},
			expected: http.StatusNotFound,
		},
		"wrong cart version": {
			configure: func(session *CheckoutSession) {
				session.Metadata["cart_version"] = "unknown"
			},
			expected: http.StatusNotFound,
		},
		"unknown sku": {
			configure: func(session *CheckoutSession) {
				session.Metadata["cart_skus"] = "not-real"
			},
			expected: http.StatusNotFound,
		},
		"mismatched id": {
			configure: func(session *CheckoutSession) {
				session.ID = "cs_test_other1234"
			},
			expected: http.StatusNotFound,
		},
	} {
		t.Run(name, func(t *testing.T) {
			session := paidDownloadSession(sessionID, "arc-01-mono")
			testCase.configure(&session)
			handler := NewDownloadHandler(
				&downloadSessionStub{session: session},
				&fulfillmentStub{},
				[]string{"https://mirrorloopai.com"},
			)
			response := downloadRequest(
				t,
				handler,
				`{"session_id":"cs_test_abcdefgh"}`,
			)
			if response.Code != testCase.expected {
				t.Fatalf("got %d: %s", response.Code, response.Body.String())
			}
		})
	}

	handler := NewDownloadHandler(
		&downloadSessionStub{},
		&fulfillmentStub{},
		[]string{"https://mirrorloopai.com"},
	)
	response := downloadRequest(
		t,
		handler,
		`{"session_id":"../../secret"}`,
	)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("malformed id got %d", response.Code)
	}
}

func TestDownloadPanelHidesStripeAndStorageErrors(t *testing.T) {
	for name, testCase := range map[string]struct {
		retriever   *downloadSessionStub
		fulfillment FulfillmentProvider
	}{
		"stripe": {
			retriever:   &downloadSessionStub{err: errors.New("secret Stripe detail")},
			fulfillment: &fulfillmentStub{},
		},
		"storage": {
			retriever: &downloadSessionStub{
				session: paidDownloadSession(
					"cs_test_abcdefgh",
					"arc-12-color",
				),
			},
			fulfillment: &fulfillmentStub{err: errors.New("secret GCS detail")},
		},
	} {
		t.Run(name, func(t *testing.T) {
			handler := NewDownloadHandler(
				testCase.retriever,
				testCase.fulfillment,
				[]string{"https://mirrorloopai.com"},
			)
			response := downloadRequest(
				t,
				handler,
				`{"session_id":"cs_test_abcdefgh"}`,
			)
			if response.Code != http.StatusServiceUnavailable {
				t.Fatalf("got %d: %s", response.Code, response.Body.String())
			}
			if strings.Contains(response.Body.String(), "secret") {
				t.Fatal("internal provider error leaked")
			}
		})
	}
}

func TestHTTPStripeClientRetrievesCheckoutSession(t *testing.T) {
	client := &http.Client{Transport: checkoutRoundTripFunc(
		func(request *http.Request) (*http.Response, error) {
			if request.Method != http.MethodGet ||
				!strings.HasSuffix(request.URL.Path, "/cs_test_abcdefgh") {
				t.Fatalf("unexpected request %s %s", request.Method, request.URL)
			}
			username, password, ok := request.BasicAuth()
			if !ok || username != "sk_test_safe" || password != "" {
				t.Fatalf("unexpected auth %q %q %v", username, password, ok)
			}
			if request.Header.Get("Stripe-Version") != "2026-03-25.dahlia" {
				t.Fatalf("Stripe-Version=%q", request.Header.Get("Stripe-Version"))
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body: io.NopCloser(strings.NewReader(`{
					"id":"cs_test_abcdefgh",
					"payment_status":"paid",
					"status":"complete",
					"livemode":false,
					"metadata":{
						"source":"mirrorloopai.com/shop",
						"cart_version":"shop-v1",
						"cart_skus":"arc-02-color"
					}
				}`)),
				Header: make(http.Header),
			}, nil
		},
	)}
	session, err := (HTTPStripeClient{
		SecretKey: "sk_test_safe",
		Client:    client,
	}).RetrieveCheckoutSession(context.Background(), "cs_test_abcdefgh")
	if err != nil {
		t.Fatal(err)
	}
	if session.ID != "cs_test_abcdefgh" ||
		session.PaymentStatus != "paid" ||
		session.Status != "complete" ||
		session.Livemode {
		t.Fatalf("session=%#v", session)
	}
}
