# syntax=docker/dockerfile:1

# Use Debian-based image for Prisma and pg_dump compatibility.
FROM node:22-bullseye-slim AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npx prisma generate \
  && npm prune --production

FROM node:22-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl postgresql-client \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build --chown=app:app /app /app
USER app

EXPOSE 3000
CMD ["node", "src/server.js"]
