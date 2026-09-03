package commerce

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	shopSource      = "mirrorloopai.com/shop"
	shopCartVersion = "shop-v1"
)

type CheckoutSession struct {
	ID            string
	PaymentStatus string
	Status        string
	Livemode      bool
	Metadata      map[string]string
}

type CheckoutSessionRetriever interface {
	RetrieveCheckoutSession(context.Context, string) (CheckoutSession, error)
}

func (c HTTPStripeClient) RetrieveCheckoutSession(
	ctx context.Context,
	sessionID string,
) (CheckoutSession, error) {
	if strings.TrimSpace(c.SecretKey) == "" {
		return CheckoutSession{}, errors.New("stripe checkout is not configured")
	}
	request, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://api.stripe.com/v1/checkout/sessions/"+url.PathEscape(sessionID),
		nil,
	)
	if err != nil {
		return CheckoutSession{}, err
	}
	request.SetBasicAuth(strings.TrimSpace(c.SecretKey), "")
	request.Header.Set("Stripe-Version", "2026-03-25.dahlia")
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 12 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return CheckoutSession{}, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	if err != nil {
		return CheckoutSession{}, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return CheckoutSession{}, errors.New("stripe rejected the session lookup")
	}
	var payload struct {
		ID            string            `json:"id"`
		PaymentStatus string            `json:"payment_status"`
		Status        string            `json:"status"`
		Livemode      bool              `json:"livemode"`
		Metadata      map[string]string `json:"metadata"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return CheckoutSession{}, err
	}
	return CheckoutSession{
		ID:            payload.ID,
		PaymentStatus: payload.PaymentStatus,
		Status:        payload.Status,
		Livemode:      payload.Livemode,
		Metadata:      payload.Metadata,
	}, nil
}

type DownloadHandler struct {
	retriever      CheckoutSessionRetriever
	fulfillment    FulfillmentProvider
	allowedOrigins map[string]struct{}
	now            func() time.Time
}

func NewDownloadHandler(
	retriever CheckoutSessionRetriever,
	fulfillment FulfillmentProvider,
	allowedOrigins []string,
) http.Handler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		if value := strings.TrimSpace(origin); value != "" {
			origins[value] = struct{}{}
		}
	}
	return &DownloadHandler{
		retriever:      retriever,
		fulfillment:    fulfillment,
		allowedOrigins: origins,
		now:            time.Now,
	}
}

type downloadItem struct {
	SKU         string `json:"sku"`
	Name        string `json:"name"`
	Delivery    string `json:"delivery"`
	DownloadURL string `json:"download_url,omitempty"`
	ExpiresAt   string `json:"expires_at,omitempty"`
}

func (h *DownloadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, ok := h.allowedOrigins[strings.TrimSpace(r.Header.Get("Origin"))]; !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error": "Download origin is not allowed.",
		})
		return
	}
	if h.retriever == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "Order verification is temporarily unavailable.",
		})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	var input struct {
		SessionID string `json:"session_id"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "The checkout session could not be read.",
		})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "The checkout session could not be read.",
		})
		return
	}
	sessionID := strings.TrimSpace(input.SessionID)
	if !validCheckoutSessionID(sessionID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "The checkout session is invalid.",
		})
		return
	}
	session, err := h.retriever.RetrieveCheckoutSession(r.Context(), sessionID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "Order verification is temporarily unavailable.",
		})
		return
	}
	if session.ID != sessionID ||
		session.Metadata["source"] != shopSource ||
		session.Metadata["cart_version"] != shopCartVersion {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "This MIRROR//LOOP order could not be verified.",
		})
		return
	}
	if session.PaymentStatus != "paid" || session.Status != "complete" {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": "Payment is still being confirmed. Try again shortly.",
		})
		return
	}
	items, ok := orderItems(session.Metadata["cart_skus"])
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": "This MIRROR//LOOP order could not be verified.",
		})
		return
	}
	if needsDigitalFulfillment(items) {
		if h.fulfillment == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "Downloads are temporarily unavailable.",
			})
			return
		}
		items, err = h.fulfillment.Prepare(r.Context(), items, h.now().UTC())
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "Downloads are temporarily unavailable.",
			})
			return
		}
	}
	result := make([]downloadItem, 0, len(items))
	for _, item := range items {
		entry := downloadItem{
			SKU:      item.SKU,
			Name:     item.Name,
			Delivery: "separate",
		}
		if item.DownloadURL != "" {
			entry.Delivery = "download"
			entry.DownloadURL = item.DownloadURL
			entry.ExpiresAt = item.ExpiresAt.UTC().Format(time.RFC3339)
		}
		result = append(result, entry)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":   "ready",
		"livemode": session.Livemode,
		"items":    result,
	})
}

func validCheckoutSessionID(value string) bool {
	var remainder string
	switch {
	case strings.HasPrefix(value, "cs_test_"):
		remainder = strings.TrimPrefix(value, "cs_test_")
	case strings.HasPrefix(value, "cs_live_"):
		remainder = strings.TrimPrefix(value, "cs_live_")
	default:
		return false
	}
	if len(value) > 255 || len(remainder) < 8 {
		return false
	}
	for _, character := range remainder {
		if (character < 'a' || character > 'z') &&
			(character < 'A' || character > 'Z') &&
			(character < '0' || character > '9') {
			return false
		}
	}
	return true
}
