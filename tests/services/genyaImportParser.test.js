import { beforeEach, describe, expect, it, vi } from 'vitest';
import readExcelFile from 'read-excel-file/node';
import {
  parseExpenseRowsFromUploadedFile,
  parseExpenseRowsFromXlsx,
} from '../../src/services/genyaImportParser.js';

vi.mock('read-excel-file/node', () => ({
  default: vi.fn(),
}));

describe('Genya import parser XLSX', () => {
  beforeEach(() => {
    vi.mocked(readExcelFile).mockReset();
  });

  it('parsa il primo foglio XLSX valido usando lo stesso mapping del CSV semplice', async () => {
    vi.mocked(readExcelFile).mockResolvedValue([
      { sheet: 'Note', data: [['Export vuoto']] },
      {
        sheet: 'Fatture',
        data: [
          ['Elenco documenti'],
          ['Elenco documenti presenti in Fattura SMART'],
          [],
          ['Numero', 'Suffisso', 'Anno', 'Data', 'Numero Rif.', 'Data Rif.', 'Tipo Documento', 'Fornitore', 'Totale'],
          [0, null, 2026, 46125, '202622153469', 46121, null, 'Volkswagen Bank GMBH', 702.66],
        ],
      },
    ]);

    const rows = await parseExpenseRowsFromXlsx(Buffer.from('xlsx'), 2);

    expect(rows).toEqual([
      expect.objectContaining({
        cantiere_id: 2,
        timestamp_utc: '46125',
        fattura_rif: '202622153469',
        fornitore: 'Volkswagen Bank GMBH',
        importo: '702.66',
      }),
    ]);
  });

  it('rifiuta XLSX senza header Genya valido', async () => {
    vi.mocked(readExcelFile).mockResolvedValue([{ sheet: 'Foglio1', data: [['Nome', 'Valore'], ['A', 'B']] }]);

    await expect(parseExpenseRowsFromXlsx(Buffer.from('xlsx'), 2)).resolves.toEqual([]);
  });

  it('rifiuta file caricati con estensione non supportata', async () => {
    await expect(parseExpenseRowsFromUploadedFile({
      originalname: 'fattura.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    }, 2)).rejects.toThrow('Formato file non supportato');
  });
});
