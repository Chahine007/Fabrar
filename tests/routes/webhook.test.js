import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireWebhookSetupSecret } from '../../src/routes/webhook.js';

function buildResponse() {
  return {
    status: vi.fn(function status() { return this; }),
    json: vi.fn(function json() { return this; }),
  };
}

function buildRequest(headers = {}) {
  return {
    header: vi.fn((name) => headers[name]),
  };
}

describe('webhook setup auth middleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('rifiuta /set-webhook in produzione senza secret valido', () => {
    process.env.NODE_ENV = 'production';
    process.env.SET_WEBHOOK_SECRET = 'setup-secret';
    const req = buildRequest({ 'X-Webhook-Setup-Secret': 'wrong' });
    const res = buildResponse();
    const next = vi.fn();

    requireWebhookSetupSecret(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Forbidden' });
  });

  it('accetta /set-webhook con service secret valido', () => {
    process.env.NODE_ENV = 'production';
    process.env.SET_WEBHOOK_SECRET = 'setup-secret';
    const req = buildRequest({ 'X-Webhook-Setup-Secret': 'setup-secret' });
    const res = buildResponse();
    const next = vi.fn();

    requireWebhookSetupSecret(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('permette setup locale senza secret quando non e produzione', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SET_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_SECRET;
    const req = buildRequest();
    const res = buildResponse();
    const next = vi.fn();

    requireWebhookSetupSecret(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
