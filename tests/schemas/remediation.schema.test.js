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
import { parseExpenseRowsFromCsv, parseImportedMoney } from '../../src/controllers/expenses.controller.js';

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
});
