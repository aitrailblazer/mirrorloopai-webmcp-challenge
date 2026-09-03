package commerce

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	maxRequestBytes = 8 << 10
	maxCartItems    = 28
)

type StripeClient interface {
	CreateCheckoutSession(context.Context, []string) (string, error)
}

type HTTPStripeClient struct {
	SecretKey  string
	SuccessURL string
	CancelURL  string
	Client     *http.Client
}

func (c HTTPStripeClient) CreateCheckoutSession(
	ctx context.Context,
	priceIDs []string,
) (string, error) {
	if strings.TrimSpace(c.SecretKey) == "" {
		return "", errors.New("stripe checkout is not configured")
	}
	values := url.Values{
		"mode":                   {"payment"},
		"success_url":            {c.SuccessURL},
		"cancel_url":             {c.CancelURL},
		"customer_creation":      {"always"},
		"allow_promotion_codes":  {"true"},
		"metadata[source]":       {shopSource},
		"metadata[cart_version]": {shopCartVersion},
		"metadata[cart_skus]":    {strings.Join(priceIDsToSKUs(priceIDs), ",")},
	}
	for index, priceID := range priceIDs {
		prefix := "line_items[" + strconv.Itoa(index) + "]"
		values.Set(prefix+"[price]", priceID)
		values.Set(prefix+"[quantity]", "1")
	}
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		"https://api.stripe.com/v1/checkout/sessions",
		strings.NewReader(values.Encode()),
	)
	if err != nil {
		return "", err
	}
	request.SetBasicAuth(strings.TrimSpace(c.SecretKey), "")
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Stripe-Version", "2026-03-25.dahlia")
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 12 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	if err != nil {
		return "", err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", errors.New("stripe rejected the checkout session")
	}
	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	checkoutURL, err := url.Parse(result.URL)
	if err != nil || checkoutURL.Scheme != "https" ||
		checkoutURL.Host != "checkout.stripe.com" {
		return "", errors.New("stripe returned an invalid checkout URL")
	}
	return result.URL, nil
}

func priceIDsToSKUs(priceIDs []string) []string {
	byPrice := make(map[string]string, len(allowedPrices))
	for sku, priceID := range allowedPrices {
		byPrice[priceID] = sku
	}
	skus := make([]string, 0, len(priceIDs))
	for _, priceID := range priceIDs {
		skus = append(skus, byPrice[priceID])
	}
	return skus
}

type Handler struct {
	client         StripeClient
	allowedOrigins map[string]struct{}
}

func NewHandler(client StripeClient, allowedOrigins []string) http.Handler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		if value := strings.TrimSpace(origin); value != "" {
			origins[value] = struct{}{}
		}
	}
	return &Handler{client: client, allowedOrigins: origins}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if _, ok := h.allowedOrigins[origin]; !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "Checkout origin is not allowed.",
		})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	var request struct {
		Items []string `json:"items"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "The cart could not be read.",
		})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "The cart could not be read.",
		})
		return
	}
	if len(request.Items) == 0 || len(request.Items) > maxCartItems {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "Choose between 1 and 28 different editions.",
		})
		return
	}
	seen := make(map[string]struct{}, len(request.Items))
	priceIDs := make([]string, 0, len(request.Items))
	for _, rawSKU := range request.Items {
		sku := strings.TrimSpace(rawSKU)
		priceID, ok := allowedPrices[sku]
		if !ok {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "The cart contains an unavailable edition.",
			})
			return
		}
		if _, duplicate := seen[sku]; duplicate {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Each digital edition may be purchased once per cart.",
			})
			return
		}
		seen[sku] = struct{}{}
		priceIDs = append(priceIDs, priceID)
	}
	checkoutURL, err := h.client.CreateCheckoutSession(r.Context(), priceIDs)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "Secure checkout is temporarily unavailable.",
		})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": checkoutURL})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
