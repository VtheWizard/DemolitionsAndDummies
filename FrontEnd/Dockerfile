FROM node:22.14.0-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM nginx:1.27.4-bookworm
COPY --from=builder /app/dist /usr/share/nginx/html
