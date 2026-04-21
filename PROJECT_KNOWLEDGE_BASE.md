# Fabrar ERP - Project Knowledge Base

Questo documento serve come Context Prompt fondamentale per assistenti AI e programmatori esterni. Descrive a 360 gradi l'architettura, le decisioni tecniche, e le convenzioni di sviluppo per il progetto Fabrar ERP.

---

## 1. Panoramica e Scopo del Progetto (Project Overview)

**Fabrar ERP** (noto internamente anche come *rendicontazione-bot*) è un sistema ERP ibrido (Web SPA + Bot Telegram) progettato per la gestione operativa e finanziaria dei cantieri. 

L'obiettivo principale è automatizzare e tracciare la rendicontazione di ore di manodopera, consumi di materiali e spese generali. 
Attraverso un'integrazione robusta con Telegram, i lavoratori sul campo possono inserire dati (spesso tramite OCR o form conversazionali). Questi dati confluiscono in un pannello di controllo dove Project Manager (HR/Admin) possono monitorare in tempo reale KPI finanziari, il "burn rate" rispetto ai budget preventivati e suddividere i costi attraverso una Work Breakdown Structure (WBS).

---

## 2. Architettura e Tech Stack

Il progetto segue un paradigma Architetturale **Monolitico Modulare** ("Full-Stack Monolith"), separando visivamente la Single Page Application (SPA) ma servendola (in produzione) tramite lo stesso server Node.js che espone le API REST e i WebSocket.

### Linguaggi e Framework Principali
- **Backend**: Node.js (moduli ES6), Express.js.
- **Database e ORM**: PostgreSQL 16 con Prisma ORM (`@prisma/client`).
- **Frontend**: React 19, Vite, React Router DOM, React Query (gestione stato server locale).
- **Styling**: TailwindCSS v4, Framer Motion (animazioni), Recharts (grafici).
- **Bot/AI Integration**: Webhook nativo di Telegram, OpenAI API (per OCR intelligente ed estrazione JSON dai messaggi).

### Decisioni Architetturali (Perché questo Stack?)
- **Prisma + Postgres**: Abbandonato SQLite per Postgres a causa della necessità di maggior concorrenza e tipizzazione forte per calcoli finanziari accurati (`Decimal`). Prisma fornisce type-safety e migrazioni dichiarative.
- **Bot come Webhook Node.js**: Gestire il Bot Telegram dalla stessa base di codice del backend ERP assicura che gli inserimenti sul campo sfruttino gli stessi Model (Prisma) e la stessa validazione centralizzata (Zod).
- **React Query**: Scelto al posto di Redux per delegare la complessità dello stato asincrono e la cache delle richieste API.
- **WebSockets (`socket.io`)**: Fornisce al pannello ERP aggiornamenti live quando il bot Telegram inserisce nuovi dati.

---

## 3. Struttura del Progetto e Moduli Core

La codebase è divisa prevalentemente in due macro-aree: Backend (`src`) e Frontend (`frontend`).

```text
/ (Root)
├── backend/ (src/)                   # Logica di Business Server-Side
│   ├── app.js / server.js            # Entry Point (Bootstrap Express, Sockets, Cron)
│   ├── routes/                       # Definizione endpoint REST e Webhook
│   ├── controllers/                  # Logica applicativa (es. cantieri.controller.js)
│   ├── db/                           # Prisma client e data layer helpers
│   ├── cron/ / sockets/              # Job di background, gestione real-time
│   └── middlewares/ / schemas/       # Zod schemas, auth middleware (JWT)
├── frontend/                         # Logica di Presentazione / SPA
│   ├── src/main.jsx / App.jsx        # Entry Point Frontend (Router, QueryProvider)
│   ├── components/                   # Elementi UI riutilizzabili (Tailwind)
│   ├── hooks/ / lib/ / pages/        # Custom hooks, utilita', view complete
│   └── vite.config.js                # Setup di build e dev proxy proxy verso l'API
├── prisma/                           # Data Models
│   └── schema.prisma                 # Definizione schema Postgres e Relazioni
└── docker-compose.yml                # Setup di infrastruttura (Backend + Postgres)
```

- **Business Logic vs Presentazione**: Tutta la logica di calcolo dei costi, KPI e validazione risiede nei *Controller* del backend e nei moduli *DB helpers*. Il frontend consuma JSON formattati.
- **Servizio Statico**: In produzione, Express (`app.js`) serve `frontend/dist/` in unione all'esposizione delle `/api/` e `/telegram/webhook/`.

---

## 4. Flusso dei Dati e Gestione dello Stato (Data Flow)

**Dal Campo (Telegram) al DB:**
1. Il dipendente invia un messaggio/foto via Telegram.
2. Il webhook `express` (`/telegram/webhook`) cattura l'evento.
3. Se contiene dati complessi, passa l'input all'OpenAI API per decodifica strutturata o lo gestisce nei servizi Telegram.
4. I dati sono validati, associati ad un Cantiere e/o Nodo WBS, e salvati via Prisma (come `Report` o `Spesa`).

**Dal DB all'Utente (Dashboard):**
1. React invoca l'API (`/api/cantieri/:id`). React Query gestisce cache e pending state.
2. Il Controller (es. `getDetails` o `getWbsTree`) interroga PostgreSQL.
3. *Calcolo Aggregato*: Il Controller estrae i dataset (Report di ore + Costo orario dipendente e Spese materiali) e **calcola a runtime** il "burn rate", i margini, e i rollup sugli alberi WBS.
4. Il frontend riceve il payload, e lo decodifica per la visualizzazione (Recharts). L'albero del budget è calcolato dal basso verso l'alto (rollup iterativo).

**Gestione dello Stato Frontend**:  
Stato Server gestito da **React Query** (`@tanstack/react-query`). Stato UI Locale gestito da **React Hooks** (`useState`/`useReducer`). Non ci sono state-manager globali verbosi (come Redux).

---

## 5. Convenzioni di Codice e Pattern (Development Guidelines)

- **Naming Conventions**: 
  - Codice JS/Node: `camelCase` per variabili e funzioni.
  - Livello Data/DB: `snake_case` rigoroso (es. `cantiere_id`, `stato_validazione`, `budget_preventivato`). I payload API restituiscono i nomi del database esattamente come mappati su Prisma, per cui il JSON frontend sarà in `snake_case`.
- **Validazione e Tipizzazione**: Validazione esterna/di input affidata interamente a **Zod** middleware prima che il request tocchi il controller.
- **Controller Pattern (`asyncHandler`)**: Tutte le rotte Express sono wrappate in `asyncHandler` che si occupa del try/catch globale inoltrando gli errori al middleware `next()`. (Evita boilerplate try/catch ovunque).
- **Logging ed Errori**: Utilizzo centrale di **Pino** (`pino-http`). Errori inaspettati triggerano una finalizzazione (exit 1) protetta (`SIGTERM` handling per chiudere prima le socket del DB ed evitare leak).

---

## 6. Istruzioni di Setup e Deployment

L'esecuzione del progetto è standardizzata su Docker usando una `docker-compose.yml` che tira su Express e database, unitamente a volumi per i backup.

### Variabili D'Ambiente (`.env`)
Il sistema crasha istantaneamente se mancano queste chiavi primarie:
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET`
- `OPENAI_API_KEY`
- `BASE_URL`
- `JWT_SECRET`
- `PRISMA_DB_URL`

### Comandi Locali (Sviluppo)
- **Backend**: `npm run dev` (accende `nodemon` sulla cartella `src`)
- **Frontend**: Da dentro `/frontend`, eseguire `npm run dev` (Vite dev server con proxy automatico implementato su porta 3000 dal `vite.config.js`).
- **Database Setup**: `npx prisma migrate dev` e successiva `npx prisma generate`.
- **Admin**: `npm run seed:admin` per il primo setup.

---

## 7. Debito Tecnico e Limitazioni Note (Per Nuovi Dev)

1. **Collo di Bottiglia Computazionale (WBS/Cantieri)**: Attualmente, funzioni come `getFinancialTimeline` o costruzioni del WBS rollup caricano un grosso blocco in memoria per cantiere (tutti i `report_entries` e e le liste tariffe `Employee`) per poi eseguire array `reduce()` logici in NodeJS. Con l'aumento dei dati cronologici questo diventerà un overhead. *Priorità Refactoring:* Spostare queste aggregazioni su query SQL native (o View Prisma PostgreSQL) per massimizzare la performance.
2. **Limitazione Livelli WBS**: L'albero strutturale della WBS (Work Breakdown Structure) è limitato a un massimo di 3 livelli (`Root` -> `Fase` -> `Sottofase`) da validazione middleware. Se servissero nested WBS più estese, va ricablata la logica di profondità (`controllers/cantieri.controller.js`).
3. **Mancanza di E2E Test**: Presente Vitest (`tests/`), ma concentrarsi in futuro su end-to-end frontend per evitare regressioni lato React Router.
4. **Deploy Singolo**: La cartella è una mix di backend e frontend. In ottica di scalabilità (es. Kubernetes), potrebbe convenire sganciare il frontend da `express.static` servendolo da una CDN vera, alleggerendo l'app Node da compiti di file-serving.
