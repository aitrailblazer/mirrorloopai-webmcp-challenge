package commerce

import "testing"

func TestFulfillmentObjectCoversAllARCEditions(t *testing.T) {
	count := 0
	for sku := range allowedPrices {
		object, filename, ok := fulfillmentObject(sku)
		if !ok {
			continue
		}
		count++
		if object != "editions/v1/"+sku+".zip" {
			t.Fatalf("%s object=%q", sku, object)
		}
		if filename == "" {
			t.Fatalf("%s has no buyer filename", sku)
		}
	}
	if count != 24 {
		t.Fatalf("fulfillment editions=%d, want 24", count)
	}
}

func TestFulfillmentObjectRejectsNonARCProducts(t *testing.T) {
	for _, sku := range []string{
		"",
		"deck-color-visual",
		"arc-00-color",
		"arc-13-mono",
		"arc-01-insight",
		"arc-01-color-extra",
	} {
		if _, _, ok := fulfillmentObject(sku); ok {
			t.Fatalf("accepted %q", sku)
		}
	}
}
