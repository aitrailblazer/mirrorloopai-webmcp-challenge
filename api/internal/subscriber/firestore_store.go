package subscriber

import (
	"context"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type FirestoreStore struct {
	client *firestore.Client
}

func NewFirestoreStore(client *firestore.Client) *FirestoreStore {
	return &FirestoreStore{client: client}
}

func (s *FirestoreStore) UpsertPending(ctx context.Context, record Record) error {
	ref := s.client.Collection("subscribers").Doc(record.ID)
	return s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		switch {
		case status.Code(err) == codes.NotFound:
			return tx.Create(ref, record)
		case err != nil:
			return err
		}
		var existing Record
		if err := snapshot.DataTo(&existing); err != nil {
			return err
		}
		record.CreatedAt = existing.CreatedAt
		if existing.Status == "active" {
			record.Status = "active"
			record.ConfirmedAt = existing.ConfirmedAt
			record.PendingExpiresAt = nil
		}
		return tx.Set(ref, record)
	})
}

func (s *FirestoreStore) Confirm(ctx context.Context, id string, now time.Time) (Record, bool, error) {
	ref := s.client.Collection("subscribers").Doc(id)
	var result Record
	var activated bool
	err := s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshot, err := tx.Get(ref)
		if err != nil {
			return err
		}
		if err := snapshot.DataTo(&result); err != nil {
			return err
		}
		if result.Status == "active" {
			return nil
		}
		result.Status = "active"
		result.ConfirmedAt = now
		result.UpdatedAt = now
		result.PendingExpiresAt = nil
		activated = true
		return tx.Set(ref, result)
	})
	return result, activated, err
}

func (s *FirestoreStore) Unsubscribe(ctx context.Context, id string, now time.Time) error {
	ref := s.client.Collection("subscribers").Doc(id)
	_, err := ref.Update(ctx, []firestore.Update{
		{Path: "status", Value: "unsubscribed"},
		{Path: "unsubscribedAt", Value: now},
		{Path: "updatedAt", Value: now},
	})
	if status.Code(err) == codes.NotFound {
		return nil
	}
	return err
}
