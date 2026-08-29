package inbound

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	resendAPIBase      = "https://api.resend.com"
	maxAttachmentBytes = 20 << 20
	maxTotalBytes      = 30 << 20
)

type ResendForwarder struct {
	APIKey     string
	From       string
	OwnerEmail string
	HTTPClient *http.Client
}

type receivedEmail struct {
	ID          string               `json:"id"`
	To          []string             `json:"to"`
	From        string               `json:"from"`
	Subject     string               `json:"subject"`
	HTML        string               `json:"html"`
	Text        string               `json:"text"`
	Attachments []receivedAttachment `json:"attachments"`
}

type receivedAttachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	ContentID   string `json:"content_id"`
}

type attachmentDownload struct {
	DownloadURL string `json:"download_url"`
}

func (f ResendForwarder) Forward(ctx context.Context, emailID string) error {
	if strings.TrimSpace(f.APIKey) == "" ||
		strings.TrimSpace(f.From) == "" ||
		strings.TrimSpace(f.OwnerEmail) == "" {
		return errors.New("inbound forwarding is not configured")
	}
	emailID = strings.TrimSpace(emailID)
	if emailID == "" {
		return errors.New("received email ID is required")
	}
	var message receivedEmail
	if err := f.getJSON(
		ctx,
		"/emails/receiving/"+url.PathEscape(emailID),
		&message,
	); err != nil {
		return err
	}
	attachments, err := f.attachments(ctx, emailID, message.Attachments)
	if err != nil {
		return err
	}
	recipient := strings.Join(message.To, ", ")
	subject := strings.TrimSpace(message.Subject)
	if subject == "" {
		subject = "(no subject)"
	}
	payload := map[string]any{
		"from":        strings.TrimSpace(f.From),
		"to":          []string{strings.TrimSpace(f.OwnerEmail)},
		"reply_to":    strings.TrimSpace(message.From),
		"subject":     "[mirrorloopai.com → " + recipient + "] " + subject,
		"text":        inboundTextHeader(message.From, recipient) + message.Text,
		"html":        inboundHTMLHeader(message.From, recipient) + message.HTML,
		"attachments": attachments,
	}
	return f.postJSON(
		ctx,
		"/emails",
		payload,
		"mirrorloop-inbound-"+emailID,
	)
}

func (f ResendForwarder) attachments(
	ctx context.Context,
	emailID string,
	metadata []receivedAttachment,
) ([]map[string]string, error) {
	result := make([]map[string]string, 0, len(metadata))
	total := 0
	for _, attachment := range metadata {
		var download attachmentDownload
		path := "/emails/receiving/" + url.PathEscape(emailID) +
			"/attachments/" + url.PathEscape(attachment.ID)
		if err := f.getJSON(ctx, path, &download); err != nil {
			return nil, err
		}
		content, err := f.download(ctx, download.DownloadURL)
		if err != nil {
			return nil, err
		}
		total += len(content)
		if total > maxTotalBytes {
			return nil, errors.New("inbound attachments exceed forwarding limit")
		}
		item := map[string]string{
			"filename":     attachment.Filename,
			"content":      base64.StdEncoding.EncodeToString(content),
			"content_type": attachment.ContentType,
		}
		if attachment.ContentID != "" {
			item["content_id"] = strings.Trim(attachment.ContentID, "<>")
		}
		result = append(result, item)
	}
	return result, nil
}

func (f ResendForwarder) getJSON(
	ctx context.Context,
	path string,
	target any,
) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, resendAPIBase+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(f.APIKey))
	resp, err := f.client().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("Resend API returned %s", resp.Status)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, maxWebhookBytes)).Decode(target)
}

func (f ResendForwarder) postJSON(
	ctx context.Context,
	path string,
	payload any,
	idempotencyKey string,
) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		resendAPIBase+path,
		bytes.NewReader(body),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(f.APIKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", idempotencyKey)
	resp, err := f.client().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Resend API returned %s", resp.Status)
	}
	return nil
}

func (f ResendForwarder) download(ctx context.Context, rawURL string) ([]byte, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return nil, errors.New("invalid attachment download URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := f.client().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		return nil, fmt.Errorf("attachment download returned %s", resp.Status)
	}
	content, err := io.ReadAll(io.LimitReader(resp.Body, maxAttachmentBytes+1))
	if err != nil {
		return nil, err
	}
	if len(content) > maxAttachmentBytes {
		return nil, errors.New("inbound attachment exceeds forwarding limit")
	}
	return content, nil
}

func (f ResendForwarder) client() *http.Client {
	if f.HTTPClient != nil {
		return f.HTTPClient
	}
	return &http.Client{Timeout: 12 * time.Second}
}

func inboundTextHeader(from, to string) string {
	return "Forwarded from: " + from + "\nOriginally sent to: " + to + "\n\n"
}

func inboundHTMLHeader(from, to string) string {
	return `<div style="margin:0 0 20px;padding:14px;border:1px solid #ddd;border-radius:8px">` +
		`<strong>Forwarded from:</strong> ` + html.EscapeString(from) + `<br>` +
		`<strong>Originally sent to:</strong> ` + html.EscapeString(to) + `</div>`
}
