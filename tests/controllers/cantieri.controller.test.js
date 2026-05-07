import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/db/index.js';
import { downloadDocument, updateCantiereSettings } from '../../src/controllers/cantieri.controller.js';

vi.mock('../../src/db/index.js', () => ({
  getAllCantieri: vi.fn(),
  createCantiere: vi.fn(),
  toggleCantiere: vi.fn(),
  updateCantiere: vi.fn(),
  getDb: vi.fn(),
  formatDateOnly: vi.fn((value) => value),
  getWbsNodesByCantiere: vi.fn(),
  createWbsNode: vi.fn(),
  updateWbsNode: vi.fn(),
  deleteWbsNode: vi.fn(),
  getWbsBurnData: vi.fn(),
}));

function createResponse() {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
    download: vi.fn(() => res),
  };
  return res;
}

describe('cantieri controller security guards', () => {
  const originalUploadDir = process.env.UPLOAD_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.UPLOAD_DIR = originalUploadDir;
    vi.restoreAllMocks();
  });

  it('aggiorna settings usando solo campi whitelisted', async () => {
    const update = vi.fn().mockResolvedValue({ id: 12, nome: 'Nuovo nome' });
    vi.mocked(getDb).mockReturnValue({
      cantiere: { update },
    });
    const req = {
      params: { id: '12' },
      user: { id: 1, role: 'ADMIN' },
      body: {
        nome: 'Nuovo nome',
        pm_id: 4,
        attivo: 0,
        budget: 999999,
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await updateCantiereSettings(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        nome: 'Nuovo nome',
        pm_id: 4,
      },
    });
    expect(res.json).toHaveBeenCalledWith({ id: 12, nome: 'Nuovo nome' });
  });

  it('rifiuta update settings senza campi whitelisted', async () => {
    const update = vi.fn();
    vi.mocked(getDb).mockReturnValue({
      cantiere: { update },
    });
    const req = {
      params: { id: '12' },
      user: { id: 1, role: 'ADMIN' },
      body: {
        attivo: 0,
        budget: 999999,
      },
    };
    const res = createResponse();
    const next = vi.fn();

    await updateCantiereSettings(req, res, next);

    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Nessuna impostazione valida fornita.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rifiuta download documenti che escono da UPLOAD_DIR', async () => {
    process.env.UPLOAD_DIR = 'C:\\safe\\uploads';
    const existsSpy = vi.spyOn(fs, 'existsSync');
    vi.mocked(getDb).mockReturnValue({
      document: {
        findFirst: vi.fn().mockResolvedValue({
          id: 5,
          cantiere_id: 12,
          file_path: '..\\..\\secret.txt',
          name: 'secret.txt',
        }),
      },
    });
    const req = { params: { id: '12', docId: '5' }, user: { id: 1, role: 'ADMIN' } };
    const res = createResponse();
    const next = vi.fn();

    await downloadDocument(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Percorso documento non autorizzato.' });
    expect(existsSpy).not.toHaveBeenCalled();
    expect(res.download).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
