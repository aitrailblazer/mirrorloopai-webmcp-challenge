package subscriber

import (
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
)

type HTTPHandler struct {
	service        *Service
	allowedOrigins map[string]struct{}
}

func NewHTTPHandler(service *Service, allowedOrigins []string) http.Handler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}
	h := &HTTPHandler{service: service, allowedOrigins: origins}
	mux := http.NewServeMux()
	for _, prefix := range []string{"", "/api"} {
		mux.HandleFunc(prefix+"/v1/subscribers", h.subscribe)
		mux.HandleFunc(prefix+"/v1/subscribers/verify", h.verify)
		mux.HandleFunc(prefix+"/v1/subscribers/unsubscribe", h.unsubscribe)
		mux.HandleFunc(prefix+"/v1/analytics/events", h.analyticsEvent)
		mux.HandleFunc(prefix+"/v1/health", func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		})
	}
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	return h.security(h.cors(mux))
}

func (h *HTTPHandler) subscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	var req SubscribeRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "The request could not be read."})
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0]); forwarded != "" {
		ip = forwarded
	}
	if err := h.service.Subscribe(r.Context(), req, ip); err != nil {
		slog.WarnContext(r.Context(), "subscriber request rejected", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": publicError(err)})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]string{"status": "confirmation_required"})
}

func (h *HTTPHandler) analyticsEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, ok := h.allowedOrigins[strings.TrimSpace(r.Header.Get("Origin"))]; !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Analytics origin is not allowed."})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	var request struct {
		Event string `json:"event"`
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "The analytics event could not be read."})
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "The analytics event could not be read."})
		return
	}
	if err := h.service.RecordPublicAnalytics(r.Context(), request.Event); err != nil {
		if strings.Contains(err.Error(), "unsupported analytics event") {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Unsupported analytics event."})
			return
		}
		slog.WarnContext(r.Context(), "analytics event failed", "error", err)
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Analytics is temporarily unavailable."})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HTTPHandler) verify(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if r.Method == http.MethodGet {
		if err := h.service.ValidateToken(token, "verify"); err != nil {
			renderMessagePage(w, http.StatusBadRequest, actionPage{
				Kind:      "error",
				Eyebrow:   "Confirmation link",
				Title:     "This link is no longer active",
				Message:   "The confirmation link is invalid or has expired. Request a new reflection from the quiz to continue.",
				Footnote:  "No subscription was activated.",
				LinkLabel: "Return to MIRROR//LOOP",
				LinkURL:   "/",
			})
			return
		}
		renderActionPage(w, r, actionPage{
			Kind:    "confirm",
			Eyebrow: "One last step",
			Title:   "Confirm your reflection",
			Message: "Review what happens before you continue.",
			Details: []string{
				"Your saved MIRROR//LOOP reflection is sent to your inbox.",
				"Your email joins the launch list for occasional App Store release and product updates.",
			},
			ReviewTitle: "Confirming does two things:",
			Button:      "Confirm and send my reflection",
			Footnote:    "This link gives you a 48-hour review window. Nothing changes until you choose confirm, and you can unsubscribe at any time.",
			LinkLabel:   "Return without confirming",
			LinkURL:     "/",
		})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	record, err := h.service.Confirm(r.Context(), token)
	if err != nil {
		slog.WarnContext(r.Context(), "subscriber confirmation failed", "error", err)
		renderMessagePage(w, http.StatusBadRequest, actionPage{
			Kind:      "error",
			Eyebrow:   "Confirmation link",
			Title:     "We could not confirm this link",
			Message:   "The link is invalid, expired, or has already been used. Request a new reflection from the quiz to continue.",
			Footnote:  "No additional subscription change was made.",
			LinkLabel: "Return to MIRROR//LOOP",
			LinkURL:   "/",
		})
		return
	}
	primary := record.Result.Dominant
	if canonical, ok := Archetypes[record.Result.DominantCode]; ok {
		primary = canonical
	}
	copy := ReflectionCopies[record.Result.DominantCode]
	renderMessagePage(w, http.StatusOK, actionPage{
		Kind:    "success",
		Eyebrow: "Email confirmed",
		Title:   "Your reflection is ready",
		Message: "You do not need to repeat the quiz.",
		Details: []string{
			"A second email containing this reflection has been sent to the address you confirmed. You can open that email on any device.",
			"Your 12 individual choices remain only in the browser where you completed the quiz; they are not synchronized or placed in this page.",
		},
		ReviewTitle:    "On this computer or another:",
		PatternName:    primary.Name,
		PatternDomain:  primary.Domain,
		PatternSummary: copy.Summary,
		PatternPrompt:  copy.Prompt,
		PatternCount:   record.Result.DominantCount,
		Footnote:       "This is the compact result you asked us to remember—not your individual answers. Keep the second email if you want to return to it later.",
		LinkLabel:      "Return to MIRROR//LOOP",
		LinkURL:        "/",
	})
}

func (h *HTTPHandler) unsubscribe(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if r.Method == http.MethodGet {
		if err := h.service.ValidateToken(token, "unsubscribe"); err != nil {
			renderMessagePage(w, http.StatusBadRequest, actionPage{
				Kind:      "error",
				Eyebrow:   "Unsubscribe link",
				Title:     "This link is no longer active",
				Message:   "The unsubscribe link is invalid or has expired.",
				Footnote:  "Contact us if you still need help with your subscription.",
				LinkLabel: "Return to MIRROR//LOOP",
				LinkURL:   "/",
			})
			return
		}
		renderActionPage(w, r, actionPage{
			Kind:        "unsubscribe",
			Eyebrow:     "Email preferences",
			Title:       "Unsubscribe from MIRROR//LOOP",
			Message:     "Review the change before you continue.",
			Details:     []string{"You will stop receiving MIRROR//LOOP launch and product updates."},
			ReviewTitle: "Unsubscribing does this:",
			Button:      "Unsubscribe me",
			Footnote:    "Nothing changes until you choose unsubscribe.",
			LinkLabel:   "Keep my subscription",
			LinkURL:     "/",
		})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := h.service.Unsubscribe(r.Context(), token); err != nil {
		http.Error(w, "This unsubscribe link is invalid or expired.", http.StatusBadRequest)
		return
	}
	renderMessagePage(w, http.StatusOK, actionPage{
		Kind:      "success",
		Eyebrow:   "Email preferences updated",
		Title:     "You are unsubscribed",
		Message:   "You will not receive further MIRROR//LOOP launch or product updates.",
		Footnote:  "Your preference has been saved.",
		LinkLabel: "Return to MIRROR//LOOP",
		LinkURL:   "/",
	})
}

type actionPage struct {
	Kind           string
	Eyebrow        string
	Title          string
	Message        string
	Details        []string
	ReviewTitle    string
	Button         string
	Footnote       string
	LinkLabel      string
	LinkURL        string
	Action         string
	PatternName    string
	PatternDomain  string
	PatternSummary string
	PatternPrompt  string
	PatternCount   int
}

func renderActionPage(w http.ResponseWriter, r *http.Request, page actionPage) {
	page.Action = r.URL.RequestURI()
	renderMessagePage(w, http.StatusOK, page)
}

func renderMessagePage(w http.ResponseWriter, status int, page actionPage) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
	w.WriteHeader(status)
	if err := actionPageTemplate.Execute(w, page); err != nil {
		slog.Error("render subscriber action page", "error", err)
	}
}

var actionPageTemplate = template.Must(template.New("subscriber-action").Parse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#080b15">
  <title>{{.Title}} — MIRROR//LOOP</title>
  <link rel="stylesheet" href="/confirmation.css?v=20260830-1">
</head>
<body>
  <div class="shell">
    <header><a class="brand" href="/" aria-label="MIRROR LOOP home">MIRROR<span>//</span>LOOP</a><span>Reflection tools for clearer choices.</span></header>
    <main>
      <section class="card" aria-labelledby="page-title">
        <div class="mark" aria-hidden="true">{{if eq .Kind "confirm"}}◯{{else if eq .Kind "success"}}✓{{else if eq .Kind "unsubscribe"}}—{{else}}!{{end}}</div>
        <p class="eyebrow">{{.Eyebrow}}</p>
        <h1 id="page-title">{{.Title}}</h1>
        <p class="lede">{{.Message}}</p>
        {{if .PatternName}}<section class="result" aria-labelledby="result-title">
          <p class="result-label">What to remember</p>
          <h2 id="result-title">{{.PatternName}}</h2>
          <p class="result-domain">{{.PatternDomain}}</p>
          <p class="result-summary">{{.PatternSummary}}</p>
          {{if gt .PatternCount 0}}<p class="result-evidence">This response appeared {{.PatternCount}} of 12 times in your choices.</p>{{end}}
          <div class="bounded-action"><strong>Try this today</strong><p>{{.PatternPrompt}}</p></div>
        </section>{{end}}
        {{if .Details}}<div class="review"><strong>{{.ReviewTitle}}</strong><ol>{{range .Details}}<li>{{.}}</li>{{end}}</ol></div>{{end}}
        {{if .Action}}<form method="post" action="{{.Action}}"><button class="button" type="submit">{{.Button}}</button></form>{{end}}
        <p class="footnote">{{.Footnote}}</p>
        <a class="secondary" href="{{.LinkURL}}">{{.LinkLabel}}</a>
      </section>
    </main>
    <footer><a class="brand" href="/">MIRROR<span>//</span>LOOP</a><span>Private by design. Human confirmation required.</span></footer>
  </div>
</body>
</html>`))

func (h *HTTPHandler) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := h.allowedOrigins[origin]; ok {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			if origin != "" {
				if _, ok := h.allowedOrigins[origin]; !ok {
					http.Error(w, "origin not allowed", http.StatusForbidden)
					return
				}
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *HTTPHandler) security(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func publicError(err error) string {
	switch {
	case strings.Contains(err.Error(), "valid email address"):
		return "Enter a valid email address."
	case strings.Contains(err.Error(), "consent"):
		return "Please agree before subscribing."
	case strings.Contains(err.Error(), "answer"):
		return "Complete all 12 questions before subscribing."
	case strings.Contains(err.Error(), "human verification"):
		return "Please complete the human verification."
	default:
		return "We could not process the request. Please try again."
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func validateURL(value string) error {
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return errors.New("valid absolute URL required")
	}
	return nil
}
