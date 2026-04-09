#!/bin/sh
set -e

if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "Missing TELEGRAM_BOT_TOKEN"
  exit 1
fi

if [ -z "$BASE_URL" ]; then
  echo "Missing BASE_URL"
  exit 1
fi

WEBHOOK_URL="${BASE_URL%/}/telegram/webhook"

PAYLOAD="{\"url\":\"$WEBHOOK_URL\"}"

if [ -n "$TELEGRAM_SECRET" ]; then
  PAYLOAD="{\"url\":\"$WEBHOOK_URL\",\"secret_token\":\"$TELEGRAM_SECRET\"}"
fi

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

printf "\n"
