import { describe, expect, it } from 'vitest';
import {
  createArticoloSchema,
  createMovimentoSchema,
  createUbicazioneSchema,
  getMovimentiCantiereSchema,
} from '../../src/schemas/magazzino.schema.js';

describe('magazzino schemas', () => {
  it('accetta un articolo valido e normalizza i tipi numerici', () => {
    const parsed = createArticoloSchema.parse({
      params: {},
      query: {},
      body: {
        codice_sku: 'SKU-1',
        descrizione: 'Cemento',
        unita_misura: 'sacco',
        costo_medio: '4.5',
        scorta_minima: '10',
        fornitore_default_id: '2',
      },
    });

    expect(parsed.body.costo_medio).toBe(4.5);
    expect(parsed.body.scorta_minima).toBe(10);
    expect(parsed.body.fornitore_default_id).toBe(2);
  });

  it('accetta una ubicazione valida', () => {
    const parsed = createUbicazioneSchema.parse({
      params: {},
      query: {},
      body: { codice: 'A1', descrizione: '' },
    });

    expect(parsed.body.descrizione).toBeNull();
  });

  it('accetta un carico valido', () => {
    const parsed = createMovimentoSchema.parse({
      params: {},
      query: {},
      body: {
        tipo_movimento: 'CARICO',
        articolo_id: '1',
        quantita: '5',
        ubicazione_a_id: '2',
        costo_acquisto: '12.5',
      },
    });

    expect(parsed.body.articolo_id).toBe(1);
    expect(parsed.body.quantita).toBe(5);
    expect(parsed.body.costo_acquisto).toBe(12.5);
  });

  it('accetta uno scarico cantiere valido', () => {
    const parsed = createMovimentoSchema.parse({
      params: {},
      query: {},
      body: {
        tipo_movimento: 'SCARICO_CANTIERE',
        articolo_id: 1,
        quantita: 3,
        ubicazione_da_id: 2,
        cantiere_id: 4,
        wbs_node_id: '',
      },
    });

    expect(parsed.body.wbs_node_id).toBeNull();
  });

  it('rifiuta tipo_movimento non supportato e quantita non positiva', () => {
    const result = createMovimentoSchema.safeParse({
      params: {},
      query: {},
      body: {
        tipo_movimento: 'RESO',
        articolo_id: 1,
        quantita: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rifiuta un carico senza ubicazione di destinazione', () => {
    const result = createMovimentoSchema.safeParse({
      params: {},
      query: {},
      body: {
        tipo_movimento: 'CARICO',
        articolo_id: 1,
        quantita: 1,
        costo_acquisto: 1,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rifiuta uno scarico cantiere senza cantiere_id', () => {
    const result = createMovimentoSchema.safeParse({
      params: {},
      query: {},
      body: {
        tipo_movimento: 'SCARICO_CANTIERE',
        articolo_id: 1,
        quantita: 1,
        ubicazione_da_id: 2,
      },
    });

    expect(result.success).toBe(false);
  });

  it('valida il parametro cantiere_id per lo storico movimenti', () => {
    const parsed = getMovimentiCantiereSchema.parse({
      params: { cantiere_id: '12' },
      query: {},
      body: {},
    });

    expect(parsed.params.cantiere_id).toBe(12);
  });
});
