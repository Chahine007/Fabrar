# Rendicontazione Telegram Bot (SQLite, single-file)

## Avvio rapido

1. Prerequisiti
   - Docker Desktop installato (Windows 10 Pro/11 o Linux)
   - cloudflared installato e autenticato
   - Dominio su Cloudflare (es. myfabdar.com)

2. Setup Cloudflare Tunnel (una volta sola)
```bash
cloudflared tunnel create myfabdar-tunnel
# Crea config.yml in ~/.cloudflared/
cloudflared tunnel route dns myfabdar-tunnel gestionale.myfabdar.com
cloudflared service install
```

3. Configurazione .env
```bash
cp .env.example .env
# Imposta TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, BASE_URL
```

4. Avvio
```bash
docker compose up -d --build
```

5. Webhook (una volta sola, dopo il primo avvio)
```powershell
# Windows PowerShell
Invoke-WebRequest -Method POST -Uri http://localhost:3000/set-webhook
```

6. Verifica
https://gestionale.myfabdar.com/health
→ `{"ok":true,"time":"..."}`

7. Accesso dashboard
https://gestionale.myfabdar.com

8. Arresto
```bash
docker compose down
```

## Configurazione bot Telegram

1. Apri Telegram e parla con @BotFather.
2. Crea un nuovo bot con `/newbot`.
3. Copia il token e inseriscilo in `.env` come `TELEGRAM_BOT_TOKEN`.

## Configurazione OpenAI

1. Crea una API key OpenAI.
2. Inseriscila in `.env` come `OPENAI_API_KEY`.

## Webhook Telegram

Il webhook punta a `BASE_URL/telegram/webhook`.

L'infrastruttura usa Cloudflare Tunnel per esporre in modo sicuro il bot su rete pubblica senza Nginx o reverse proxy complessi. HTTPS è gestito trasparentemente. Telegram invierà le notifiche degli eventi a questo endpoint. Configuralo inviando una `POST` a `/set-webhook` (vedi Avvio rapido).

## Autenticazione dashboard

La dashboard e le API richiedono l'autenticazione JWT. Le credenziali iniziali di amministrazione sono definite in `.env` da `DASH_USER` e `DASH_PASS`.

## Export CSV (admin)

Endpoint:

```
GET /admin/export.csv
```

Richiede JWT Bearer token se attiva tramite dashboard.

## Persistenza dati e Backup

Il database SQLite viene salvato in `./data/app.db`.

I backup automatici notturni (alle 03:00) sono generati nella stessa cartella e mantenuti per `BACKUP_RETENTION_DAYS` (default 7).
Configurando `ONEDRIVE_BACKUP_PATH` in `.env`, una copia dei file di backup sarà esportata automaticamente sul percorso OneDrive (o qualsiasi directory Windows indicata) all'avvio o creazione.

## Arresto
```bash
docker compose down
```

## Note operative

- Il bot accetta messaggi testuali e vocali.
- Per i vocali, Telegram limita il download a 20 MB.
- La conferma del report avviene rispondendo coi pulsanti o `/edit`.
