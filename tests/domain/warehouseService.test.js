import pkg from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDischargeInTransaction,
  processDischarge,
} from '../../src/domain/magazzino/warehouseService.js';
import { domainBus, EVENTS } from '../../src/domain/events/domainBus.js';
import { ValidationStatus } from '../../src/constants.js';

const { Prisma } = pkg;

function buildTx(overrides = {}) {
  return {
    articolo: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        codice_sku: 'SKU-1',
        descrizione: 'Cemento',
        costo_medio: new Prisma.Decimal(10),
      }),
    },
    giacenza: {
      findUnique: vi.fn().mockResolvedValue({ id: 5 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    wbsNode: {
      findFirst: vi.fn().mockResolvedValue({ id: 9 }),
    },
    movimentoMagazzino: {
      create: vi.fn().mockResolvedValue({ id: 21 }),
    },
    spesa: {
      create: vi.fn().mockResolvedValue({ id: 31 }),
    },
    ...overrides,
  };
}

describe('warehouseService discharge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scala la giacenza con decremento atomico condizionato sulla disponibilita', async () => {
    const tx = buildTx();

    const result = await createDischargeInTransaction(tx, {
      articolo_id: 1,
      quantita: 3,
      ubicazione_da_id: 2,
      cantiere_id: 4,
    }, 7, 8);

    expect(tx.giacenza.updateMany).toHaveBeenCalledWith({
      where: {
        id: 5,
        quantita_disponibile: { gte: expect.any(Prisma.Decimal) },
      },
      data: {
        quantita_disponibile: { decrement: expect.any(Prisma.Decimal) },
      },
    });
    expect(tx.spesa.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employee_id: 8,
        cantiere_id: 4,
        wbs_node_id: 9,
        importo: expect.any(Prisma.Decimal),
        fonte: 'MAGAZZINO',
        stato_validazione: ValidationStatus.APPROVED,
      }),
    });
    expect(result.eventPayload).toEqual({
      cantiereId: 4,
      wbsNodeId: 9,
      spesaId: 31,
      movimentoId: 21,
    });
  });

  it('fallisce senza creare movimento se il decremento condizionato non aggiorna righe', async () => {
    const tx = buildTx({
      giacenza: {
        findUnique: vi.fn().mockResolvedValue({ id: 5 }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    });

    await expect(createDischargeInTransaction(tx, {
      articolo_id: 1,
      quantita: 3,
      ubicazione_da_id: 2,
      cantiere_id: 4,
    }, 7, 8)).rejects.toMatchObject({
      name: 'DomainError',
      code: 'INSUFFICIENT_STOCK',
    });

    expect(tx.movimentoMagazzino.create).not.toHaveBeenCalled();
    expect(tx.spesa.create).not.toHaveBeenCalled();
  });

  it('emette WAREHOUSE_DISCHARGED solo dopo una transazione riuscita', async () => {
    const tx = buildTx();
    const prisma = {
      $transaction: vi.fn((fn) => fn(tx)),
    };
    const emitSpy = vi.spyOn(domainBus, 'emit');

    await processDischarge(prisma, {
      articolo_id: 1,
      quantita: 3,
      ubicazione_da_id: 2,
      cantiere_id: 4,
    }, 7, 8);

    expect(emitSpy).toHaveBeenCalledWith(EVENTS.WAREHOUSE_DISCHARGED, {
      cantiereId: 4,
      wbsNodeId: 9,
      spesaId: 31,
      movimentoId: 21,
    });
  });
});
