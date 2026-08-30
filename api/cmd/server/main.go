package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"cloud.google.com/go/firestore"
	"mirrorloopai.com/web/api/internal/analytics"
	"mirrorloopai.com/web/api/internal/commerce"
	"mirrorloopai.com/web/api/internal/inbound"
	"mirrorloopai.com/web/api/internal/subscriber"
)

const consentVersion = "email-reflection-owner-review-v2-2026-08-30"

func main() {
	if err := run(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx := context.Background()
	cfg, err := loadConfig()
	if err != nil {
		return err
	}
	signer, err := subscriber.NewTokenSigner(cfg.tokenSecret)
	if err != nil {
		return err
	}

	var store subscriber.Store
	var analyticsRecorder analytics.Recorder = analytics.NoopRecorder{}
	var closeStore func() error = func() error { return nil }
	var firestoreClient *firestore.Client
	if cfg.memoryStore {
		store = subscriber.NewMemoryStore()
	} else {
		client, err := firestore.NewClient(ctx, cfg.projectID)
		if err != nil {
			return err
		}
		store = subscriber.NewFirestoreStore(client)
		firestoreClient = client
		analyticsRecorder = analytics.NewFirestoreRecorder(client)
		closeStore = client.Close
	}
	defer closeStore()

	var mailer subscriber.Mailer = subscriber.LogMailer{}
	var orderMailer commerce.OrderMailer = subscriber.LogMailer{}
	if !cfg.logEmail {
		resendMailer := subscriber.ResendMailer{
			APIKey:     cfg.resendAPIKey,
			From:       cfg.fromEmail,
			ReplyTo:    cfg.replyToEmail,
			OwnerEmail: cfg.orderNotificationEmail,
		}
		mailer = resendMailer
		orderMailer = resendMailer
	}
	var challenge subscriber.ChallengeVerifier = subscriber.AllowChallenge{}
	if cfg.challengeRequired {
		challenge = subscriber.TurnstileVerifier{Secret: cfg.turnstileSecret}
	}
	service, err := subscriber.NewService(store, mailer, challenge, signer, subscriber.ServiceConfig{
		SubscriberIDSecret: cfg.subscriberIDSecret,
		PublicAPIURL:       cfg.publicAPIURL, ConfirmedURL: cfg.confirmedURL,
		ConsentVersion: consentVersion, ChallengeRequired: cfg.challengeRequired,
		Analytics: analyticsRecorder,
	})
	if err != nil {
		return err
	}
	apiHandler := subscriber.NewHTTPHandler(service, cfg.allowedOrigins)
	checkoutHandler := commerce.NewHandler(
		commerce.HTTPStripeClient{
			SecretKey:  cfg.stripeSecretKey,
			SuccessURL: cfg.shopSuccessURL,
			CancelURL:  cfg.shopCancelURL,
		},
		cfg.allowedOrigins,
	)
	var eventStore commerce.EventStore = commerce.NewMemoryEventStore()
	if firestoreClient != nil {
		eventStore = commerce.NewFirestoreEventStore(firestoreClient)
	}
	webhookHandler := commerce.NewWebhookHandler(
		cfg.stripeWebhookSecret,
		orderMailer,
		eventStore,
	)
	var inboundStore inbound.EventStore = inbound.NewMemoryEventStore()
	if firestoreClient != nil {
		inboundStore = inbound.NewFirestoreEventStore(firestoreClient)
	}
	var inboundForwarder inbound.Forwarder
	if cfg.resendInboundEnabled {
		inboundForwarder = inbound.ResendForwarder{
			APIKey:     cfg.resendInboundAPIKey,
			From:       cfg.fromEmail,
			OwnerEmail: cfg.orderNotificationEmail,
		}
	}
	inboundHandler := inbound.NewHandler(
		cfg.resendWebhookSecret,
		inboundForwarder,
		inboundStore,
	)
	mux := http.NewServeMux()
	mux.Handle("/api/v1/checkout-sessions", checkoutHandler)
	mux.Handle("/v1/checkout-sessions", checkoutHandler)
	mux.Handle("/api/v1/stripe/webhook", webhookHandler)
	mux.Handle("/v1/stripe/webhook", webhookHandler)
	mux.Handle("/api/v1/resend/inbound", inboundHandler)
	mux.Handle("/v1/resend/inbound", inboundHandler)
	mux.Handle("/", apiHandler)
	var handler http.Handler = mux
	if cfg.staticDir != "" {
		staticMux := http.NewServeMux()
		staticMux.Handle("/api/v1/checkout-sessions", checkoutHandler)
		staticMux.Handle("/v1/checkout-sessions", checkoutHandler)
		staticMux.Handle("/api/v1/stripe/webhook", webhookHandler)
		staticMux.Handle("/v1/stripe/webhook", webhookHandler)
		staticMux.Handle("/api/v1/resend/inbound", inboundHandler)
		staticMux.Handle("/v1/resend/inbound", inboundHandler)
		staticMux.Handle("/api/", apiHandler)
		staticMux.Handle("/v1/", apiHandler)
		staticMux.Handle("/healthz", apiHandler)
		staticMux.Handle("/", http.FileServer(http.Dir(cfg.staticDir)))
		handler = staticMux
	}
	server := &http.Server{
		Addr: ":" + cfg.port, Handler: handler,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-shutdown
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(stopCtx)
	}()
	slog.Info("subscriber API listening", "port", cfg.port, "memory_store", cfg.memoryStore, "log_email", cfg.logEmail)
	err = server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

type config struct {
	port, projectID, tokenSecret, subscriberIDSecret       string
	publicAPIURL, confirmedURL, resendAPIKey, fromEmail    string
	replyToEmail, resendWebhookSecret, resendInboundAPIKey string
	turnstileSecret, staticDir                             string
	stripeSecretKey, stripeWebhookSecret                   string
	shopSuccessURL, shopCancelURL, orderNotificationEmail  string
	allowedOrigins                                         []string
	memoryStore, logEmail, challengeRequired               bool
	resendInboundEnabled                                   bool
}

func loadConfig() (config, error) {
	cfg := config{
		port: env("PORT", "8080"), projectID: os.Getenv("GOOGLE_CLOUD_PROJECT"),
		tokenSecret: strings.TrimSpace(os.Getenv("TOKEN_SECRET")), subscriberIDSecret: strings.TrimSpace(os.Getenv("SUBSCRIBER_ID_SECRET")),
		publicAPIURL: env("PUBLIC_API_URL", "http://localhost:8080"),
		confirmedURL: env("CONFIRMED_URL", "http://localhost:8000/confirmed.html"),
		resendAPIKey: strings.TrimSpace(os.Getenv("RESEND_API_KEY")), fromEmail: os.Getenv("FROM_EMAIL"),
		replyToEmail:        strings.TrimSpace(os.Getenv("REPLY_TO_EMAIL")),
		resendWebhookSecret: strings.TrimSpace(os.Getenv("RESEND_WEBHOOK_SECRET")),
		resendInboundAPIKey: strings.TrimSpace(os.Getenv("RESEND_INBOUND_API_KEY")),
		turnstileSecret:     strings.TrimSpace(os.Getenv("TURNSTILE_SECRET")),
		stripeSecretKey:     strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		stripeWebhookSecret: strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		orderNotificationEmail: env(
			"ORDER_NOTIFICATION_EMAIL",
			"constantine@aitrailblazer.com",
		),
		shopSuccessURL: env(
			"SHOP_SUCCESS_URL",
			"https://mirrorloopai.com/shop.html?checkout=success&session_id={CHECKOUT_SESSION_ID}",
		),
		shopCancelURL: env(
			"SHOP_CANCEL_URL",
			"https://mirrorloopai.com/shop.html?checkout=cancelled",
		),
		staticDir:      strings.TrimSpace(os.Getenv("STATIC_DIR")),
		allowedOrigins: splitCSV(env("ALLOWED_ORIGINS", "http://localhost:8000")),
		memoryStore:    truthy(env("MEMORY_STORE", "true")), logEmail: truthy(env("LOG_EMAIL", "true")),
		challengeRequired:    truthy(env("CHALLENGE_REQUIRED", "false")),
		resendInboundEnabled: truthy(env("RESEND_INBOUND_ENABLED", "false")),
	}
	if len(cfg.tokenSecret) < 32 || len(cfg.subscriberIDSecret) < 32 {
		return config{}, errors.New("TOKEN_SECRET and SUBSCRIBER_ID_SECRET must each contain at least 32 characters")
	}
	if !cfg.memoryStore && cfg.projectID == "" {
		return config{}, errors.New("GOOGLE_CLOUD_PROJECT is required when MEMORY_STORE is false")
	}
	if !cfg.logEmail && (cfg.resendAPIKey == "" || cfg.fromEmail == "") {
		return config{}, errors.New("RESEND_API_KEY and FROM_EMAIL are required when LOG_EMAIL is false")
	}
	if cfg.challengeRequired && cfg.turnstileSecret == "" {
		return config{}, errors.New("TURNSTILE_SECRET is required when CHALLENGE_REQUIRED is true")
	}
	if cfg.stripeSecretKey != "" && cfg.stripeWebhookSecret == "" {
		return config{}, errors.New("STRIPE_WEBHOOK_SECRET is required when checkout is configured")
	}
	if cfg.resendInboundEnabled && (cfg.resendWebhookSecret == "" || cfg.resendInboundAPIKey == "") {
		return config{}, errors.New("RESEND_WEBHOOK_SECRET and RESEND_INBOUND_API_KEY are required when inbound forwarding is enabled")
	}
	return cfg, nil
}

func env(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
func truthy(value string) bool { return strings.EqualFold(value, "true") || value == "1" }
func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
