import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseExpenseRowsFromUploadedFile,
  parseExpenseRowsFromXlsx,
} from '../../src/services/genyaImportParser.js';

async function buildWorkbookBuffer(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row) => worksheet.addRow(row));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('Genya import parser XLSX', () => {
  it('parsa il primo foglio XLSX valido usando lo stesso mapping del CSV semplice', async () => {
    const buffer = await buildWorkbookBuffer([
      { name: 'Note', rows: [['Export vuoto']] },
      {
        name: 'Fatture',
        rows: [
          ['Elenco documenti'],
          ['Elenco documenti presenti in Fattura SMART'],
          [],
          ['Numero', 'Suffisso', 'Anno', 'Data', 'Numero Rif.', 'Data Rif.', 'Tipo Documento', 'Fornitore', 'Totale'],
          [0, null, 2026, 46125, '202622153469', 46121, null, 'Volkswagen Bank GMBH', 702.66],
        ],
      },
    ]);

    const rows = await parseExpenseRowsFromXlsx(buffer, 2);

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
    const buffer = await buildWorkbookBuffer([{ name: 'Foglio1', rows: [['Nome', 'Valore'], ['A', 'B']] }]);

    await expect(parseExpenseRowsFromXlsx(buffer, 2)).resolves.toEqual([]);
  });

  it('trasforma XLSX corrotti/non leggibili in errore 400 di formato', async () => {
    await expect(parseExpenseRowsFromXlsx(Buffer.from('not-an-xlsx'), 2))
      .rejects
      .toThrow('File XLSX Genya non leggibile');
  });

  it('rifiuta file caricati con estensione non supportata', async () => {
    await expect(parseExpenseRowsFromUploadedFile({
      originalname: 'fattura.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF'),
    }, 2)).rejects.toThrow('Formato file non supportato');
  });
});
