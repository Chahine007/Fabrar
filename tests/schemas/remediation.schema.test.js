import { describe, expect, it } from 'vitest';
import { createInstallmentSchema, createInvoiceSchema } from '../../src/schemas/billing.schema.js';
import {
  createMaterialRequestSchema,
  fulfillMaterialRequestSchema,
  updateMaterialRequestStatusSchema,
} from '../../src/schemas/materialRequests.schema.js';
import { createSupplierSchema, updateSupplierSchema } from '../../src/schemas/suppliers.schema.js';
import { changePasswordSchema, updateUserSettingsSchema } from '../../src/schemas/user.schema.js';
import { updateGpsSchema } from '../../src/schemas/cantiere.schema.js';
import {
  parseCantiereIdFromReferer,
  parseExpenseRowsFromCsv,
  parseImportedMoney,
  parseImportedTimestamp,
} from '../../src/controllers/expenses.controller.js';

describe('remediation HTTP schemas', () => {
  it('valida billing installments e invoice payload', () => {
    expect(createInstallmentSchema.parse({
      params: { cantiereId: '3' },
      query: {},
      body: { nome: 'SAL 1', importo_previsto: '1000', percentuale: '20' },
    }).body.importo_previsto).toBe(1000);

    expect(createInvoiceSchema.parse({
      params: { cantiereId: 3 },
      query: {},
      body: { stato: 'ISSUED', installment_ids: ['1', 2] },
    }).body.installment_ids).toEqual([1, 2]);

    expect(createInstallmentSchema.safeParse({
      params: { cantiereId: 3 },
      query: {},
      body: { nome: 'SAL 2', importo_previsto: 1000, stato: 'PAID' },
    }).success).toBe(false);

    expect(createInvoiceSchema.safeParse({
      params: { cantiereId: 3 },
      query: {},
      body: { stato: 'PAID', importo_totale: 1000 },
    }).success).toBe(false);
  });

  it('rifiuta richieste materiali senza righe e status FULFILLED sul cambio stato', () => {
    expect(createMaterialRequestSchema.safeParse({
      params: {},
      query: {},
      body: { cantiere_id: 1, righe: [] },
    }).success).toBe(false);

    expect(updateMaterialRequestStatusSchema.safeParse({
      params: { id: 1 },
      query: {},
      body: { status: 'FULFILLED' },
    }).success).toBe(false);

    expect(fulfillMaterialRequestSchema.parse({
      params: { id: '4' },
      query: {},
      body: {},
    }).params.id).toBe(4);
  });

  it('valida fornitori, settings utente, password e GPS', () => {
    expect(createSupplierSchema.safeParse({
      params: {},
      query: {},
      body: { ragione_sociale: '' },
    }).success).toBe(false);

    expect(updateSupplierSchema.parse({
      params: { id: '2' },
      query: {},
      body: { email: '' },
    }).body.email).toBeNull();

    expect(updateUserSettingsSchema.safeParse({
      params: {},
      query: {},
      body: { preferences: { theme: 'dark' } },
    }).success).toBe(true);

    expect(changePasswordSchema.safeParse({
      params: {},
      query: {},
      body: { currentPassword: 'old', newPassword: 'short' },
    }).success).toBe(false);

    expect(updateGpsSchema.safeParse({
      params: { id: 1 },
      query: {},
      body: { lat: 95, lng: 9 },
    }).success).toBe(false);
  });

  it('parsa CSV Genya con separatore punto e virgola, importi decimali italiani e cantiere fallback', () => {
    const rows = parseExpenseRowsFromCsv(
      'Data;Importo;Fornitore;Descrizione\n05/05/2026;"1.234,56";Rossi Srl;"Materiali, minuteria"',
      7
    );

    expect(rows).toEqual([
      {
        timestamp_utc: '05/05/2026',
        importo: '1.234,56',
        fornitore: 'Rossi Srl',
        descrizione: 'Materiali, minuteria',
        cantiere_id: 7,
      },
    ]);
    expect(parseImportedMoney(rows[0].importo)).toBe(1234.56);
  });

  it('parsa export Genya con righe introduttive e ricava il cantiere dal referer progetto', () => {
    const cantiereId = parseCantiereIdFromReferer('https://gestionale.myfabdar.com/projects/2');
    const rows = parseExpenseRowsFromCsv(
      [
        'Export Genya spese',
        'Generato il;05/05/2026',
        'Data Documento;Totale Documento;Fornitore Ragione Sociale;Causale',
        '05/05/2026;"824,00";Bianchi Srl;Nolo attrezzatura',
      ].join('\n'),
      cantiereId
    );

    expect(cantiereId).toBe(2);
    expect(rows).toEqual([
      {
        timestamp_utc: '05/05/2026',
        importo: '824,00',
        fornitore: 'Bianchi Srl',
        descrizione: 'Nolo attrezzatura',
        cantiere_id: 2,
      },
    ]);
  });

  it('rifiuta CSV senza cantiere quando non esiste fallback di progetto', () => {
    const rows = parseExpenseRowsFromCsv('Data;Importo\n05/05/2026;100,00');
    expect(rows).toEqual([]);
  });

  it('parsa il CSV Genya semplice allegato con date seriali Excel e riferimento fattura', () => {
    const rows = parseExpenseRowsFromCsv([
      '"Elenco documenti","","","","","","","","","","","","","","","","","","","",""',
      '"Elenco documenti presenti in Fattura SMART","","","","","","","","","","","","","","","","","","","",""',
      '"","","","","","","","","","","","","","","","","","","","",""',
      '"Numero","Suffisso","Anno","Data","Numero Rif.","Data Rif.","Tipo Documento","Fornitore","Codice Fiscale","Partita IVA","Imponibile","Tipo cassa previdenza","Cassa Previdenza","Imposta","Importo Art. 15","Bollo","Totale","Ritenuta","Netto a pagare","Note piede","Stato"',
      '"0","","2026","46125","202622153469","46121","","Volkswagen Bank GMBH","","","","","","","","","702.66","","","",""',
      '"0","","2026","46125","345","46125","","La Baita dei F.lli Mezzogori E C. Sas di Denti Giancarla","","","","","","","","","16.5","","","",""',
      '"0","","2026","46125","217","46125","","MIKI BAR DI RIZZATI MICHELA","","","","","","","","","15","","","",""',
      '"0","","2026","46124","2600Q5V20000066","46123","","CONSORZI AGRARI D\'ITALIA SPA Sede operativa di Verona","","","","","","","","","93.17","","","",""',
      '"0","","2026","46124","412/SV","46112","","SPRINT S.A.S. DI DAL MOLIN FRANCESCA & C.","","","","","","","","","45","","","",""',
      '"0","","2026","46123","336","46122","","La Baita dei F.lli Mezzogori E C. Sas di Denti Giancarla","","","","","","","","","16.5","","","",""',
      '"0","","2026","46123","9751354378","46123","","Action Italy S.R.L","","","","","","","","","22.1","","","",""',
    ].join('\n'), 2);

    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      cantiere_id: 2,
      timestamp_utc: '46125',
      fattura_rif: '202622153469',
      fornitore: 'Volkswagen Bank GMBH',
      importo: '702.66',
      descrizione: 'Documento Genya - rif. 202622153469 - anno 2026',
    });
    expect(parseImportedTimestamp(rows[0].timestamp_utc).toISOString()).toBe('2026-04-13T12:00:00.000Z');
  });

  it('rifiuta il CSV Genya Full allegato quando non contiene importi riga', () => {
    expect(() => parseExpenseRowsFromCsv([
      '"Elenco documenti","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""',
      '"Elenco documenti presenti in Fattura SMART","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""',
      '"","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","",""',
      '"Tipo Documento","Anno","Numero","Suffisso","Data","Numero Rif. fornitore","Data Rif. fornitore","Riferimento","Fornitore","Codice Fiscale","Partita IVA","Scadenza","Pagamento","Numero riga","Codice articolo","Descrizione","Quantità","Unità misura","Prezzo Un.","Sconto (%)","Prezzo Tot.","Aliquota","Tipo riga","Totale (val)","Imponibile (val)","Imposta (val)","Cassa Previdenza","Cassa Previdenza (%)","Cassa Previdenza (val)","Ritenuta","Ritenuta (%)","Ritenuta (val)","Ritenuta imponibile (%)","Causale pagamento ritenuta","Tipologia contributo","Contributo (%)","Contributo (val)","Contributo imponibile (%)","Causale pagamento contributo","Tipo sconto bonus","Sconto bonus (%)","Sconto bonus (val)","Sconto cassa (%)","Sconto cassa (val)","Bollo (val)","Note piede","Stato","Inviato al cliente","Inviato allo studio","Split","Fepa o B2b"',
      '"","2026","0","","46125","","","","Volkswagen Bank GMBH","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","A scadere","","","",""',
    ].join('\n'), 2)).toThrow('Il file dettagliato Genya non contiene importi riga');
  });

  it('parsa un CSV Genya Full quando Prezzo Tot. e valorizzato', () => {
    const rows = parseExpenseRowsFromCsv([
      '"Tipo Documento","Anno","Numero","Suffisso","Data","Numero Rif. fornitore","Data Rif. fornitore","Riferimento","Fornitore","Codice Fiscale","Partita IVA","Scadenza","Pagamento","Numero riga","Codice articolo","Descrizione","Quantità","Unità misura","Prezzo Un.","Sconto (%)","Prezzo Tot.","Aliquota","Tipo riga","Totale (val)","Imponibile (val)","Imposta (val)","Stato"',
      '"Fattura","2026","12","","46125","ABC-12","46125","","Fornitore Test","","","","","1","MAT-1","Materiale ferro","2","PZ","10","","20","22","","","","","A scadere"',
    ].join('\n'), 4);

    expect(rows).toEqual([
      expect.objectContaining({
        cantiere_id: 4,
        timestamp_utc: '46125',
        fattura_rif: 'ABC-12',
        fornitore: 'Fornitore Test',
        descrizione: 'Materiale ferro',
        importo: '20',
      }),
    ]);
  });

  it('non tratta export fatture clienti come import spese Genya', () => {
    const rows = parseExpenseRowsFromCsv([
      '"Tipo Documento","Anno","Numero","Data","Cliente","Numero riga","Descrizione","Prezzo Tot.","Stato"',
      '"Fattura","2026","7","46099","Tahiti Spa","1","Acconto lavori","9242.17","A scadere"',
    ].join('\n'), 2);

    expect(rows).toEqual([]);
  });
});
