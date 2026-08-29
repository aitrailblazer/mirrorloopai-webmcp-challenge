package main

import (
	"strings"
	"testing"
)

func TestLoadConfigTrimsSecretValues(t *testing.T) {
	t.Setenv("TOKEN_SECRET", "  01234567890123456789012345678901\n")
	t.Setenv("SUBSCRIBER_ID_SECRET", "\tabcdefghijklmnopqrstuvwxyz123456  ")
	t.Setenv("RESEND_API_KEY", "  resend-key\n")
	t.Setenv("TURNSTILE_SECRET", "  turnstile-key\n")
	t.Setenv("FROM_EMAIL", "MIRROR//LOOP <reflection@mirrorloopai.com>")
	t.Setenv("LOG_EMAIL", "false")
	t.Setenv("CHALLENGE_REQUIRED", "true")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.tokenSecret != "01234567890123456789012345678901" ||
		cfg.subscriberIDSecret != "abcdefghijklmnopqrstuvwxyz123456" ||
		cfg.resendAPIKey != "resend-key" ||
		cfg.turnstileSecret != "turnstile-key" {
		t.Fatal("secret-bearing configuration values were not trimmed")
	}
}

func TestLoadConfigRequiresWebhookSecretWithCheckout(t *testing.T) {
	t.Setenv("TOKEN_SECRET", "01234567890123456789012345678901")
	t.Setenv("SUBSCRIBER_ID_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("STRIPE_SECRET_KEY", "rk_live_example")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "")
	t.Setenv("LOG_EMAIL", "true")
	t.Setenv("CHALLENGE_REQUIRED", "false")

	_, err := loadConfig()
	if err == nil || !strings.Contains(err.Error(), "STRIPE_WEBHOOK_SECRET") {
		t.Fatalf("error=%v", err)
	}
}

func TestLoadConfigRequiresResendWebhookSecretWithInbound(t *testing.T) {
	t.Setenv("TOKEN_SECRET", "01234567890123456789012345678901")
	t.Setenv("SUBSCRIBER_ID_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("LOG_EMAIL", "true")
	t.Setenv("CHALLENGE_REQUIRED", "false")
	t.Setenv("RESEND_INBOUND_ENABLED", "true")
	t.Setenv("RESEND_WEBHOOK_SECRET", "")
	t.Setenv("RESEND_INBOUND_API_KEY", "inbound-key")

	_, err := loadConfig()
	if err == nil || !strings.Contains(err.Error(), "RESEND_WEBHOOK_SECRET") {
		t.Fatalf("error=%v", err)
	}
}

func TestLoadConfigRequiresResendInboundAPIKeyWithInbound(t *testing.T) {
	t.Setenv("TOKEN_SECRET", "01234567890123456789012345678901")
	t.Setenv("SUBSCRIBER_ID_SECRET", "abcdefghijklmnopqrstuvwxyz123456")
	t.Setenv("LOG_EMAIL", "true")
	t.Setenv("CHALLENGE_REQUIRED", "false")
	t.Setenv("RESEND_INBOUND_ENABLED", "true")
	t.Setenv("RESEND_WEBHOOK_SECRET", "webhook-secret")
	t.Setenv("RESEND_INBOUND_API_KEY", "")

	_, err := loadConfig()
	if err == nil || !strings.Contains(err.Error(), "RESEND_INBOUND_API_KEY") {
		t.Fatalf("error=%v", err)
	}
}
