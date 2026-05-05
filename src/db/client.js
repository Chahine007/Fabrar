import pkg from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import logger from '../logger.js';
import dotenv from 'dotenv';

const { PrismaClient } = pkg;

dotenv.config();

function parseEnvInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.PRISMA_DB_URL,
  max: parseEnvInt(process.env.PG_POOL_MAX, 10),
  idleTimeoutMillis: parseEnvInt(process.env.PG_POOL_IDLE_MS, 10000),
  connectionTimeoutMillis: parseEnvInt(process.env.PG_POOL_CONNECT_TIMEOUT_MS, 10000),
});

const adapter = new PrismaPg(pool, {
  disposeExternalPool: true,
  onPoolError: (err) => logger.error({ err, event: "pg_pool_error" }, "pg_pool_error"),
  onConnectionError: (err) => logger.error({ err, event: "pg_connection_error" }, "pg_connection_error"),
});

const prisma = new PrismaClient({ adapter });
let prismaClosed = false;

prisma.close = async () => {
  if (prismaClosed) return;
  prismaClosed = true;
  await prisma.$disconnect();
};

export async function initDb() {
  await prisma.$connect();
  logger.info({ event: "db_ready" }, "db_ready (PostgreSQL Prisma)");
  return prisma;
}

export function getDb() {
  return prisma;
}
