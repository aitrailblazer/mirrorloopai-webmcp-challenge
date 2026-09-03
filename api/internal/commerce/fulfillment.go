package commerce

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

const fulfillmentLinkLifetime = 6*24*time.Hour + 23*time.Hour

type OrderItem struct {
	SKU         string
	Name        string
	DownloadURL string
	ExpiresAt   time.Time
}

type FulfillmentProvider interface {
	Prepare(context.Context, []OrderItem, time.Time) ([]OrderItem, error)
}

type GCSFulfillmentProvider struct {
	client *storage.Client
	bucket string
}

func NewGCSFulfillmentProvider(
	ctx context.Context,
	bucket string,
) (*GCSFulfillmentProvider, error) {
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, errors.New("fulfillment bucket is required")
	}
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("create fulfillment storage client: %w", err)
	}
	return &GCSFulfillmentProvider{client: client, bucket: bucket}, nil
}

func (p *GCSFulfillmentProvider) Close() error {
	return p.client.Close()
}

func (p *GCSFulfillmentProvider) Prepare(
	ctx context.Context,
	items []OrderItem,
	now time.Time,
) ([]OrderItem, error) {
	prepared := make([]OrderItem, len(items))
	copy(prepared, items)
	expiresAt := now.UTC().Add(fulfillmentLinkLifetime)
	for index := range prepared {
		object, filename, ok := fulfillmentObject(prepared[index].SKU)
		if !ok {
			continue
		}
		if _, err := p.client.Bucket(p.bucket).Object(object).Attrs(ctx); err != nil {
			return nil, fmt.Errorf(
				"verify fulfillment object for %s: %w",
				prepared[index].SKU,
				err,
			)
		}
		signedURL, err := p.client.Bucket(p.bucket).SignedURL(
			object,
			&storage.SignedURLOptions{
				Scheme:  storage.SigningSchemeV4,
				Method:  http.MethodGet,
				Expires: expiresAt,
				QueryParameters: url.Values{
					"response-content-disposition": {
						fmt.Sprintf(`attachment; filename="%s"`, filename),
					},
					"response-content-type": {"application/zip"},
				},
			},
		)
		if err != nil {
			return nil, fmt.Errorf(
				"sign fulfillment object for %s: %w",
				prepared[index].SKU,
				err,
			)
		}
		prepared[index].DownloadURL = signedURL
		prepared[index].ExpiresAt = expiresAt
	}
	return prepared, nil
}

func fulfillmentObject(sku string) (object, filename string, ok bool) {
	parts := strings.Split(sku, "-")
	if len(parts) != 3 || parts[0] != "arc" {
		return "", "", false
	}
	arc, err := strconv.Atoi(parts[1])
	if err != nil || arc < 1 || arc > 12 {
		return "", "", false
	}
	edition := parts[2]
	if edition != "mono" && edition != "color" {
		return "", "", false
	}
	editionLabel := strings.ToUpper(edition[:1]) + edition[1:]
	return "editions/v1/" + sku + ".zip",
		fmt.Sprintf("MIRRORLOOP-ARC%02d-%s-Edition.zip", arc, editionLabel),
		true
}
