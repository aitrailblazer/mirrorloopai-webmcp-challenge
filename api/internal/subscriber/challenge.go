package subscriber

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type AllowChallenge struct{}

func (AllowChallenge) Verify(context.Context, string, string) error { return nil }

type TurnstileVerifier struct {
	Secret     string
	HTTPClient *http.Client
}

func (v TurnstileVerifier) Verify(ctx context.Context, token, remoteIP string) error {
	if v.Secret == "" || token == "" {
		return errors.New("challenge token is required")
	}
	form := url.Values{"secret": {v.Secret}, "response": {token}}
	if strings.TrimSpace(remoteIP) != "" {
		form.Set("remoteip", remoteIP)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := v.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || !result.Success {
		return errors.New("challenge verification failed")
	}
	return nil
}
