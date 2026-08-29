package analytics

import (
	"context"
	"time"

	"cloud.google.com/go/firestore"
)

type FirestoreRecorder struct {
	client *firestore.Client
}

func NewFirestoreRecorder(client *firestore.Client) *FirestoreRecorder {
	return &FirestoreRecorder{client: client}
}

func (r *FirestoreRecorder) Record(ctx context.Context, event Event, at time.Time) error {
	field, err := FieldName(event)
	if err != nil {
		return err
	}
	at = at.UTC()
	values := map[string]any{
		field:       firestore.Increment(1),
		"updatedAt": at,
	}
	dailyValues := map[string]any{
		field:       firestore.Increment(1),
		"date":      at.Format("2006-01-02"),
		"updatedAt": at,
	}
	batch := r.client.Batch()
	batch.Set(r.client.Collection("analytics_totals").Doc("current"), values, firestore.MergeAll)
	batch.Set(r.client.Collection("analytics_daily").Doc(at.Format("2006-01-02")), dailyValues, firestore.MergeAll)
	_, err = batch.Commit(ctx)
	return err
}

func ReadTotals(ctx context.Context, client *firestore.Client) (Totals, error) {
	snapshot, err := client.Collection("analytics_totals").Doc("current").Get(ctx)
	if err != nil {
		return Totals{}, err
	}
	var totals Totals
	if err := snapshot.DataTo(&totals); err != nil {
		return Totals{}, err
	}
	return totals, nil
}
