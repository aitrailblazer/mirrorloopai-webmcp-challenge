FROM golang:1.25.13-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY api ./api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/subscriber-api ./api/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/subscriber-api /subscriber-api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/subscriber-api"]
