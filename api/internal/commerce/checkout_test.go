package commerce

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type checkoutRoundTripFunc func(*http.Request) (*http.Response, error)

func (f checkoutRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type stubClient struct {
	priceIDs []string
	err      error
}

func (s *stubClient) CreateCheckoutSession(
	_ context.Context,
	priceIDs []string,
) (string, error) {
	s.priceIDs = priceIDs
	if s.err != nil {
		return "", s.err
	}
	return "https://checkout.stripe.com/c/pay/cs_test_safe", nil
}

func TestCheckoutRejectsUnknownAndDuplicateSKUs(t *testing.T) {
	client := &stubClient{}
	handler := NewHandler(client, []string{"https://mirrorloopai.com"})
	for _, body := range []string{
		`{"items":["not-real"]}`,
		`{"items":["arc-01-mono","arc-01-mono"]}`,
		`{"items":[]}`,
	} {
		request := httptest.NewRequest(
			http.MethodPost,
			"/v1/checkout-sessions",
			strings.NewReader(body),
		)
		request.Header.Set("Origin", "https://mirrorloopai.com")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body %s: got %d", body, response.Code)
		}
	}
}

func TestCheckoutUsesOnlyServerAllowlistedPrices(t *testing.T) {
	client := &stubClient{}
	handler := NewHandler(client, []string{"https://mirrorloopai.com"})
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/checkout-sessions",
		strings.NewReader(`{"items":["arc-01-mono","deck-color-visual"]}`),
	)
	request.Header.Set("Origin", "https://mirrorloopai.com")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("got %d: %s", response.Code, response.Body.String())
	}
	if len(client.priceIDs) != 2 ||
		client.priceIDs[0] != allowedPrices["arc-01-mono"] ||
		client.priceIDs[1] != allowedPrices["deck-color-visual"] {
		t.Fatalf("unexpected prices: %#v", client.priceIDs)
	}
	var body map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(body["url"], "https://checkout.stripe.com/") {
		t.Fatalf("unexpected checkout URL: %q", body["url"])
	}
}

func TestCheckoutRejectsForeignOriginAndHidesStripeErrors(t *testing.T) {
	client := &stubClient{err: errors.New("secret Stripe detail")}
	handler := NewHandler(client, []string{"https://mirrorloopai.com"})
	for origin, expected := range map[string]int{
		"https://evil.example":     http.StatusForbidden,
		"https://mirrorloopai.com": http.StatusServiceUnavailable,
	} {
		request := httptest.NewRequest(
			http.MethodPost,
			"/v1/checkout-sessions",
			strings.NewReader(`{"items":["arc-01-mono"]}`),
		)
		request.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != expected {
			t.Fatalf("%s: got %d", origin, response.Code)
		}
		if strings.Contains(response.Body.String(), "secret Stripe detail") {
			t.Fatal("internal Stripe error leaked")
		}
	}
}

func TestCheckoutAcceptsEntireCatalog(t *testing.T) {
	client := &stubClient{}
	handler := NewHandler(client, []string{"https://mirrorloopai.com"})
	items := make([]string, 0, len(allowedPrices))
	for sku := range allowedPrices {
		items = append(items, sku)
	}
	body, err := json.Marshal(map[string]any{"items": items})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/checkout-sessions",
		strings.NewReader(string(body)),
	)
	request.Header.Set("Origin", "https://mirrorloopai.com")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("got %d: %s", response.Code, response.Body.String())
	}
	if len(client.priceIDs) != len(allowedPrices) {
		t.Fatalf("got %d prices, want %d", len(client.priceIDs), len(allowedPrices))
	}
}

func TestStripeSessionIncludesFulfillmentSKUs(t *testing.T) {
	var form string
	client := &http.Client{Transport: checkoutRoundTripFunc(
		func(request *http.Request) (*http.Response, error) {
			body, err := io.ReadAll(request.Body)
			if err != nil {
				t.Fatal(err)
			}
			form = string(body)
			return &http.Response{
				StatusCode: http.StatusOK,
				Status:     "200 OK",
				Body: io.NopCloser(strings.NewReader(
					`{"url":"https://checkout.stripe.com/c/pay/cs_test_safe"}`,
				)),
				Header: make(http.Header),
			}, nil
		},
	)}
	stripeClient := HTTPStripeClient{
		SecretKey:  "rk_test_safe",
		SuccessURL: "https://mirrorloopai.com/shop?checkout=success",
		CancelURL:  "https://mirrorloopai.com/shop?checkout=cancelled",
		Client:     client,
	}
	_, err := stripeClient.CreateCheckoutSession(
		context.Background(),
		[]string{
			allowedPrices["arc-01-mono"],
			allowedPrices["deck-color-visual"],
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	values, err := url.ParseQuery(form)
	if err != nil {
		t.Fatal(err)
	}
	if values.Get("metadata[cart_skus]") !=
		"arc-01-mono,deck-color-visual" {
		t.Fatalf("cart_skus=%q", values.Get("metadata[cart_skus]"))
	}
	if values.Get("line_items[0][price]") != allowedPrices["arc-01-mono"] {
		t.Fatalf("first price=%q", values.Get("line_items[0][price]"))
	}
}
