import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  parseExpenseRowsFromUploadedFile,
  parseExpenseRowsFromXlsx,
} from '../../src/services/genyaImportParser.js';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value) {
  if (value == null) return '<c t="s"><v>0</v></c>';
  if (typeof value === 'number') return `<c><v>${value}</v></c>`;
  return `<c t="str"><v>${escapeXml(value)}</v></c>`;
}

async function buildWorkbookBuffer(sheets) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="utf-8"?><x:Types xmlns:x="http://schemas.openxmlformats.org/package/2006/content-types"></x:Types>');
  zip.file('xl/sharedStrings.xml', '<?xml version="1.0" encoding="utf-8"?><x:sst count="1" uniqueCount="1" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si><x:t></x:t></x:si></x:sst>');

  sheets.forEach((sheet, index) => {
    const rows = sheet.rows.map((row) => `<row>${row.map(cellXml).join('')}</row>`).join('');
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  });

  return zip.generateAsync({ type: 'nodebuffer' });
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
