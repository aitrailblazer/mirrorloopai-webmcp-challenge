package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"cloud.google.com/go/firestore"
	"mirrorloopai.com/web/api/internal/analytics"
)

func main() {
	projectID := flag.String("project", os.Getenv("GOOGLE_CLOUD_PROJECT"), "Google Cloud project ID")
	flag.Parse()
	if *projectID == "" {
		log.Fatal("set --project or GOOGLE_CLOUD_PROJECT")
	}

	ctx := context.Background()
	client, err := firestore.NewClient(ctx, *projectID)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	totals, err := analytics.ReadTotals(ctx, client)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("MIRROR//LOOP aggregate conversion funnel")
	fmt.Printf("Quiz starts: %d\n", totals.QuizStarted)
	fmt.Printf("Quiz completions: %d\n", totals.QuizCompleted)
	fmt.Printf("Confirmed subscriptions: %d\n", totals.SubscriptionsConfirmed)
	fmt.Printf("Quiz completion rate: %.1f%%\n", percentage(totals.QuizCompleted, totals.QuizStarted))
	fmt.Printf("Completion-to-confirmation rate: %.1f%%\n", percentage(totals.SubscriptionsConfirmed, totals.QuizCompleted))
	fmt.Printf("Updated: %s\n", totals.UpdatedAt.UTC().Format("2006-01-02 15:04:05 UTC"))
}

func percentage(numerator, denominator int64) float64 {
	if denominator == 0 {
		return 0
	}
	return 100 * float64(numerator) / float64(denominator)
}
