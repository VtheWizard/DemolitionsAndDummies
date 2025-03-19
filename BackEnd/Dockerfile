FROM golang:1.23.2 AS builder
WORKDIR /app
COPY . .
RUN go build -o server

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/server .
CMD ["./server"]
