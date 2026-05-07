# Stage 1: Build the frontend
FROM node:22-bullseye-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: Build the backend
FROM node:22-bullseye-slim AS backend-build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
COPY . .
# Copy built frontend assets to the public directory
COPY --from=frontend-build /app/frontend/dist ./public
RUN npx prisma generate && npm prune --production

# Stage 3: Runtime
FROM node:22-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -d /etc/apt/keyrings \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg \
  && echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt bullseye-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-16 ffmpeg \
  && apt-get purge -y --auto-remove gnupg \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=backend-build --chown=app:app /app /app
USER app

EXPOSE 3000
CMD ["node", "src/server.js"]
