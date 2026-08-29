.PHONY: test test-go test-web validate fmt vet run-api analytics-report serve-web

test: test-go test-web validate

test-go:
	go test ./...

test-web:
	npm test

validate:
	npm run validate

fmt:
	gofmt -w $$(find api -name '*.go')

vet:
	go vet ./...

run-api:
	set -a; . ./.env; set +a; go run ./api/cmd/server

analytics-report:
	go run ./api/cmd/analytics-report --project="$${PROJECT_ID:-mirrorloopai-com}"

serve-web:
	cd web && python3 -m http.server 8000
