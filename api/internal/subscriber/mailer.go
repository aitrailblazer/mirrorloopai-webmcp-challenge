package subscriber

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type LogMailer struct{}

func (LogMailer) SendConfirmation(_ context.Context, _ string, link string) error {
	slog.Info("local confirmation email generated", "verification_link", link)
	return nil
}

func (LogMailer) SendReflection(_ context.Context, record Record, unsubscribeURL string) error {
	slog.Info("local reflection email generated", "subscriber_id", record.ID, "archetype", record.Result.Dominant.Name, "unsubscribe_link", unsubscribeURL)
	return nil
}

func (LogMailer) SendBuyerOrderReceived(
	_ context.Context,
	orderID, email string,
	items []string,
) error {
	slog.Info("local buyer order acknowledgement generated",
		"order_id", orderID, "email", email, "item_count", len(items))
	return nil
}

func (LogMailer) SendOwnerOrderNotification(
	_ context.Context,
	orderID, email string,
	items []string,
) error {
	slog.Info("local owner order notification generated",
		"order_id", orderID, "buyer_email", email, "item_count", len(items))
	return nil
}

type ResendMailer struct {
	APIKey     string
	From       string
	ReplyTo    string
	OwnerEmail string
	HTTPClient *http.Client
}

func (m ResendMailer) SendConfirmation(ctx context.Context, email, link string) error {
	message := confirmationEmail(link)
	return m.send(ctx, email, message)
}

func (m ResendMailer) SendReflection(ctx context.Context, record Record, unsubscribeURL string) error {
	message := reflectionEmail(record.Result, unsubscribeURL)
	return m.send(ctx, record.Email, message)
}

func (m ResendMailer) SendBuyerOrderReceived(
	ctx context.Context,
	orderID, email string,
	items []string,
) error {
	return m.sendWithKey(
		ctx,
		email,
		orderReceivedEmail(orderID, items),
		"mirrorloop-"+orderID+"-buyer",
		m.ReplyTo,
	)
}

func (m ResendMailer) SendOwnerOrderNotification(
	ctx context.Context,
	orderID, email string,
	items []string,
) error {
	if strings.TrimSpace(m.OwnerEmail) == "" {
		return errors.New("order notification email is not configured")
	}
	return m.sendWithKey(
		ctx,
		strings.TrimSpace(m.OwnerEmail),
		ownerOrderEmail(orderID, email, items),
		"mirrorloop-"+orderID+"-owner",
		email,
	)
}

type emailMessage struct {
	subject string
	html    string
	text    string
}

func confirmationEmail(link string) emailMessage {
	escapedLink := html.EscapeString(link)
	content := `
<p style="margin:0 0 20px;color:#d8d2e1;font-size:16px;line-height:1.65">You asked us to email the reflection you requested after completing the quiz.</p>
<div style="margin:0 0 24px;padding:18px;border:1px solid #38304d;border-radius:14px;background:#151221">
  <p style="margin:0 0 8px;color:#ffffff;font-size:16px;line-height:1.55"><strong>Confirming does two things:</strong></p>
  <ol style="margin:0;padding-left:22px;color:#d8d2e1;font-size:16px;line-height:1.65">
    <li>It sends your saved MIRROR//LOOP reflection.</li>
    <li>It joins you to the launch list for occasional App Store release and product updates.</li>
  </ol>
</div>
<p style="margin:0 0 22px;color:#d8d2e1;font-size:16px;line-height:1.65">For your protection, the link opens a review page. Nothing is confirmed until you choose confirm on that page.</p>
<p style="margin:0 0 26px"><a href="` + escapedLink + `" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#f0bc63;color:#18111f;font-weight:700;text-decoration:none">Review and confirm</a></p>
<p style="margin:0 0 10px;color:#a9a2b7;font-size:13px;line-height:1.55">If the button does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 24px;overflow-wrap:anywhere;color:#d8d2e1;font-size:13px;line-height:1.55"><a href="` + escapedLink + `" style="color:#f4cf8b">` + escapedLink + `</a></p>
<p style="margin:0;color:#a9a2b7;font-size:13px;line-height:1.55">This link expires in 48 hours. You can unsubscribe from the launch list at any time. If you did not request this reflection, ignore this message and nothing will be activated.</p>`

	text := `MIRROR//LOOP

Confirm your reflection

You asked us to email the reflection you requested after completing the quiz.

Confirming does two things:
1. It sends your saved MIRROR//LOOP reflection.
2. It joins you to the launch list for occasional App Store release and product updates.

For your protection, the link opens a review page. Nothing is confirmed until you choose confirm on that page.

Review and confirm:
` + link + `

This link expires in 48 hours. You can unsubscribe from the launch list at any time. If you did not request this reflection, ignore this message and nothing will be activated.`

	return emailMessage{
		subject: "Confirm your MIRROR//LOOP reflection",
		html:    emailDocument("Confirm your address to receive your reflection and join the MIRROR//LOOP launch list.", "Confirm your reflection", content),
		text:    text,
	}
}

func reflectionEmail(result Result, unsubscribeURL string) emailMessage {
	primary := result.Dominant
	if canonical, ok := Archetypes[result.DominantCode]; ok {
		primary = canonical
	}
	copy := ReflectionCopies[result.DominantCode]
	name := html.EscapeString(primary.Name)
	domain := html.EscapeString(primary.Domain)
	summary := html.EscapeString(copy.Summary)
	prompt := html.EscapeString(copy.Prompt)
	escapedUnsubscribeURL := html.EscapeString(unsubscribeURL)

	var evidenceHTML, evidenceText string
	if result.DominantCount > 0 {
		evidenceHTML = fmt.Sprintf(`<p style="margin:10px 0 0;color:#a9a2b7;font-size:14px;line-height:1.55">This response appeared <strong style="color:#ffffff">%d of 12 times</strong> in your choices.</p>`, result.DominantCount)
		evidenceText = fmt.Sprintf("\nThis response appeared %d of 12 times in your choices.\n", result.DominantCount)
	}

	var supportingHTML, supportingText string
	if result.SecondaryCode != "" && result.SecondaryCount > 0 {
		secondary := result.Secondary
		if canonical, ok := Archetypes[result.SecondaryCode]; ok {
			secondary = canonical
		}
		secondaryCopy := ReflectionCopies[result.SecondaryCode]
		supportingHTML = fmt.Sprintf(`
<div style="margin:0 0 24px;padding:18px;border:1px solid #38304d;border-radius:14px;background:#151221">
  <p style="margin:0 0 6px;color:#f0bc63;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Also present in your answers</p>
  <h2 style="margin:0 0 8px;color:#ffffff;font-family:Georgia,serif;font-size:22px;line-height:1.25">%s</h2>
  <p style="margin:0 0 8px;color:#d8d2e1;font-size:15px;line-height:1.6">%s</p>
  <p style="margin:0;color:#a9a2b7;font-size:13px;line-height:1.55">This response appeared %d of 12 times.</p>
</div>`, html.EscapeString(secondary.Name), html.EscapeString(secondaryCopy.Summary), result.SecondaryCount)
		supportingText = fmt.Sprintf(`
Also present in your answers: %s
%s
This response appeared %d of 12 times.
`, secondary.Name, secondaryCopy.Summary, result.SecondaryCount)
	}

	content := fmt.Sprintf(`
<p style="margin:0 0 6px;color:#f0bc63;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Your current response pattern</p>
<h2 style="margin:0 0 6px;color:#ffffff;font-family:Georgia,serif;font-size:30px;line-height:1.15">%s</h2>
<p style="margin:0 0 18px;color:#f4cf8b;font-size:15px;line-height:1.5">%s</p>
<p style="margin:0;color:#d8d2e1;font-size:17px;line-height:1.65">%s</p>
%s
<div style="margin:24px 0;padding:18px;border-left:3px solid #f0bc63;background:#151221">
  <p style="margin:0 0 6px;color:#f0bc63;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Try this today</p>
  <p style="margin:0;color:#ffffff;font-size:17px;line-height:1.65">%s</p>
</div>
%s
<p style="margin:0 0 18px;color:#d8d2e1;font-size:15px;line-height:1.65">You are now on the MIRROR//LOOP launch list. We will send occasional App Store release and product updates—not a daily newsletter. You can reply to this email if you need help.</p>
<p style="margin:0 0 18px;color:#a9a2b7;font-size:13px;line-height:1.55">This is a reflective snapshot based on 12 choices. It is not a diagnosis, prediction, or fixed identity.</p>
<p style="margin:0;color:#a9a2b7;font-size:13px;line-height:1.55"><a href="%s" style="color:#f4cf8b">Review or unsubscribe from the launch list</a></p>`,
		name, domain, summary, evidenceHTML, prompt, supportingHTML, escapedUnsubscribeURL)

	text := fmt.Sprintf(`MIRROR//LOOP

Your current response pattern: %s
%s

%s
%s
Try this today:
%s
%s
You are now on the MIRROR//LOOP launch list. We will send occasional App Store release and product updates—not a daily newsletter. You can reply to this email if you need help.

This is a reflective snapshot based on 12 choices. It is not a diagnosis, prediction, or fixed identity.

Review or unsubscribe from the launch list:
%s`, primary.Name, primary.Domain, copy.Summary, evidenceText, copy.Prompt, supportingText, unsubscribeURL)

	return emailMessage{
		subject: fmt.Sprintf("Your MIRROR//LOOP reflection: %s", primary.Name),
		html:    emailDocument(copy.Summary, "Your MIRROR//LOOP reflection", content),
		text:    text,
	}
}

func orderReceivedEmail(orderID string, items []string) emailMessage {
	escapedOrderID := html.EscapeString(orderID)
	var htmlItems strings.Builder
	var textItems strings.Builder
	for _, item := range items {
		htmlItems.WriteString("<li style=\"margin:0 0 8px\">")
		htmlItems.WriteString(html.EscapeString(item))
		htmlItems.WriteString("</li>")
		textItems.WriteString("- ")
		textItems.WriteString(item)
		textItems.WriteString("\n")
	}
	content := `
<p style="margin:0 0 20px;color:#d8d2e1;font-size:17px;line-height:1.65">Thank you. Stripe has confirmed your MIRROR//LOOP payment.</p>
<div style="margin:0 0 24px;padding:18px;border:1px solid #38304d;border-radius:14px;background:#151221">
  <p style="margin:0 0 8px;color:#f0bc63;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Please wait while we prepare your files</p>
  <p style="margin:0;color:#ffffff;font-size:17px;line-height:1.65">Your digital edition will be delivered separately to this email address within 24 hours.</p>
</div>
<p style="margin:0 0 10px;color:#ffffff;font-size:16px"><strong>Your order</strong></p>
<ul style="margin:0 0 22px;padding-left:22px;color:#d8d2e1;font-size:15px;line-height:1.55">` + htmlItems.String() + `</ul>
<p style="margin:0 0 18px;color:#a9a2b7;font-size:13px;line-height:1.55">Order reference: ` + escapedOrderID + `</p>
<p style="margin:0;color:#a9a2b7;font-size:13px;line-height:1.55">If the files have not arrived after 24 hours, reply to this email. Do not send payment-card information.</p>`
	text := `MIRROR//LOOP

Thank you. Stripe has confirmed your payment.

PLEASE WAIT WHILE WE PREPARE YOUR FILES
Your digital edition will be delivered separately to this email address within 24 hours.

Your order:
` + textItems.String() + `
Order reference: ` + orderID + `

If the files have not arrived after 24 hours, reply to this email. Do not send payment-card information.`
	return emailMessage{
		subject: "Thank you — your MIRROR//LOOP order is confirmed",
		html: emailDocument(
			"Payment received. Please wait while we prepare your MIRROR//LOOP files.",
			"Your order is confirmed",
			content,
		),
		text: text,
	}
}

func ownerOrderEmail(orderID, buyerEmail string, items []string) emailMessage {
	var htmlItems strings.Builder
	var textItems strings.Builder
	for _, item := range items {
		htmlItems.WriteString("<li style=\"margin:0 0 8px\">")
		htmlItems.WriteString(html.EscapeString(item))
		htmlItems.WriteString("</li>")
		textItems.WriteString("- ")
		textItems.WriteString(item)
		textItems.WriteString("\n")
	}
	content := `
<p style="margin:0 0 18px;color:#d8d2e1;font-size:17px;line-height:1.65">A paid order needs digital fulfillment.</p>
<div style="margin:0 0 24px;padding:18px;border:1px solid #38304d;border-radius:14px;background:#151221">
  <p style="margin:0 0 8px;color:#a9a2b7;font-size:13px">Buyer</p>
  <p style="margin:0 0 16px;color:#ffffff;font-size:16px">` + html.EscapeString(buyerEmail) + `</p>
  <p style="margin:0 0 8px;color:#a9a2b7;font-size:13px">Stripe Checkout Session</p>
  <p style="margin:0;color:#ffffff;font-size:14px;overflow-wrap:anywhere">` + html.EscapeString(orderID) + `</p>
</div>
<p style="margin:0 0 10px;color:#ffffff;font-size:16px"><strong>Files to deliver</strong></p>
<ul style="margin:0;padding-left:22px;color:#d8d2e1;font-size:15px;line-height:1.55">` + htmlItems.String() + `</ul>`
	text := `MIRROR//LOOP

NEW PAID ORDER — FULFILLMENT REQUIRED

Buyer: ` + buyerEmail + `
Stripe Checkout Session: ` + orderID + `

Files to deliver:
` + textItems.String()
	return emailMessage{
		subject: "MIRROR//LOOP order received — action needed",
		html: emailDocument(
			"A paid MIRROR//LOOP order needs digital fulfillment.",
			"New paid order",
			content,
		),
		text: text,
	}
}

func emailDocument(preheader, heading, content string) string {
	return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0912;color:#ffffff;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">` + html.EscapeString(preheader) + `</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#0b0912"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#100d19;border:1px solid #2e2840;border-radius:18px">
    <tr><td style="padding:32px">
      <p style="margin:0 0 22px;color:#f0bc63;font-size:13px;font-weight:700;letter-spacing:.16em">MIRROR//LOOP</p>
      <h1 style="margin:0 0 22px;color:#ffffff;font-family:Georgia,serif;font-size:34px;line-height:1.15">` + html.EscapeString(heading) + `</h1>
      ` + content + `
    </td></tr>
  </table>
</td></tr></table>
</body>
</html>`
}

func (m ResendMailer) send(ctx context.Context, to string, message emailMessage) error {
	return m.sendWithKey(ctx, to, message, "", m.ReplyTo)
}

func (m ResendMailer) sendWithKey(
	ctx context.Context,
	to string,
	message emailMessage,
	idempotencyKey string,
	replyTo string,
) error {
	if m.APIKey == "" || m.From == "" {
		return errors.New("email provider is not configured")
	}
	payload := map[string]any{
		"from":    strings.TrimSpace(m.From),
		"to":      []string{to},
		"subject": message.subject,
		"html":    message.html,
		"text":    message.text,
	}
	if replyTo != "" {
		payload["reply_to"] = strings.TrimSpace(replyTo)
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.APIKey)
	req.Header.Set("Content-Type", "application/json")
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	client := m.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("email provider returned %s", resp.Status)
	}
	return nil
}
