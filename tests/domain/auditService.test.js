import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkUpdateItems } from '../../src/domain/hr/auditService.js';
import { DomainError } from '../../src/domain/shared/DomainError.js';
import { ValidationStatus, AUDIT_TYPE } from '../../src/constants.js';

// ─── Mock Prisma Transaction ───────────────────────────────────────────────────

/**
 * Costruisce un mock di prisma.$transaction che esegue la callback
 * con un client fake (tx). Permette di iniettare risposte per ogni
 * operazione Prisma senza toccare il DB reale.
 */
function buildPrismaMock(txOverrides = {}) {
    const tx = {
        reportEntry: {
            findMany:  vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            update:    vi.fn().mockResolvedValue({}),
        },
        spesa: {
            findMany: vi.fn().mockResolvedValue([]),
            update:   vi.fn().mockResolvedValue({}),
        },
        tariffa: {
            count: vi.fn().mockResolvedValue(1), // default: tariffa presente
        },
        ...txOverrides,
    };

    return {
        $transaction: vi.fn((fn) => fn(tx)),
        _tx: tx, // esposto per le asserzioni nei test
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auditService.bulkUpdateItems', () => {
    describe('formato items esplicito', () => {
        it('approva una ReportEntry con tariffa presente', async () => {
            const prisma = buildPrismaMock({
                reportEntry: {
                    findMany:   vi.fn().mockResolvedValue([]),
                    findUnique: vi.fn().mockResolvedValue({
                        report_id: 1,
                        report: { employee_id: 42 },
                    }),
                    update: vi.fn().mockResolvedValue({}),
                },
            });

            const body = {
                items: [{ id: 10, type: AUDIT_TYPE.ORE, newStatus: ValidationStatus.VERIFIED }],
            };

            const count = await bulkUpdateItems(prisma, body);

            expect(count).toBe(1);
            expect(prisma._tx.reportEntry.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 10 },
                    data:  expect.objectContaining({ stato_validazione: 'VERIFIED' }),
                })
            );
        });

        it('🔒 Policy 4.2 — lancia DomainError se dipendente senza tariffa', async () => {
            const prisma = buildPrismaMock({
                reportEntry: {
                    findMany:   vi.fn().mockResolvedValue([]),
                    findUnique: vi.fn().mockResolvedValue({
                        report_id: 1,
                        report: { employee_id: 99 },
                    }),
                    update: vi.fn().mockResolvedValue({}),
                },
                tariffa: {
                    count: vi.fn().mockResolvedValue(0), // ← nessuna tariffa!
                },
            });

            const body = {
                items: [{ id: 10, type: AUDIT_TYPE.ORE, newStatus: ValidationStatus.VERIFIED }],
            };

            await expect(bulkUpdateItems(prisma, body))
                .rejects
                .toMatchObject({ name: 'DomainError', code: 'MISSING_TARIFFA' });
        });

        it('non verifica la tariffa quando si rifiuta (REJECTED)', async () => {
            const prisma = buildPrismaMock({
                reportEntry: {
                    findMany:   vi.fn().mockResolvedValue([]),
                    findUnique: vi.fn().mockResolvedValue({ report_id: 1, report: { employee_id: 99 } }),
                    update:     vi.fn().mockResolvedValue({}),
                },
                tariffa: { count: vi.fn().mockResolvedValue(0) }, // nessuna tariffa, ma non conta
            });

            const body = {
                items: [{ id: 10, type: AUDIT_TYPE.ORE, newStatus: ValidationStatus.REJECTED }],
            };

            // Non deve lanciare — il rifiuto non richiede tariffa
            await expect(bulkUpdateItems(prisma, body)).resolves.toBe(1);
            expect(prisma._tx.tariffa.count).not.toHaveBeenCalled();
        });

        it('approva una Spesa senza verificare la tariffa', async () => {
            const prisma = buildPrismaMock();
            prisma._tx.tariffa.count = vi.fn().mockResolvedValue(0); // non deve essere chiamata

            const body = {
                items: [{ id: 20, type: AUDIT_TYPE.SPESE, newStatus: ValidationStatus.VERIFIED }],
            };

            await bulkUpdateItems(prisma, body);

            expect(prisma._tx.spesa.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 20 } })
            );
            expect(prisma._tx.tariffa.count).not.toHaveBeenCalled();
        });

        it('lancia DomainError per tipo audit non supportato', async () => {
            const prisma = buildPrismaMock();

            const body = {
                items: [{ id: 5, type: 'unknown_type', newStatus: ValidationStatus.VERIFIED }],
            };

            await expect(bulkUpdateItems(prisma, body))
                .rejects
                .toMatchObject({ name: 'DomainError', code: 'INVALID_TYPE' });
        });
    });

    describe('formato ids + action (risoluzione automatica)', () => {
        it('risolve ids in items tipizzati e li processa', async () => {
            const prisma = buildPrismaMock({
                reportEntry: {
                    findMany:   vi.fn().mockResolvedValue([{ id: 1 }]),
                    findUnique: vi.fn().mockResolvedValue({ report_id: 1, report: { employee_id: 1 } }),
                    update:     vi.fn().mockResolvedValue({}),
                },
                spesa: {
                    findMany: vi.fn().mockResolvedValue([{ id: 2 }]),
                    update:   vi.fn().mockResolvedValue({}),
                },
            });

            const count = await bulkUpdateItems(prisma, { ids: [1, 2], action: 'verify' });

            expect(count).toBe(2);
        });

        it('lancia DomainError se id non trovato né in ore né in spese', async () => {
            const prisma = buildPrismaMock(); // entrambi findMany restituiscono []

            await expect(bulkUpdateItems(prisma, { ids: [999], action: 'verify' }))
                .rejects
                .toMatchObject({ name: 'DomainError', code: 'NOT_FOUND' });
        });

        it('lancia DomainError se ids è vuoto', async () => {
            const prisma = buildPrismaMock();

            await expect(bulkUpdateItems(prisma, { ids: [], action: 'verify' }))
                .rejects
                .toMatchObject({ name: 'DomainError', code: 'INVALID_INPUT' });
        });
    });
});
