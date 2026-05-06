/**
 * warehouseService — regole di business per i movimenti di magazzino.
 */
import { Prisma } from '@prisma/client';
import { DomainError } from '../shared/DomainError.js';
import { ValidationStatus } from '../../constants.js';
import { domainBus, EVENTS } from '../events/domainBus.js';

const DEFAULT_LOCATION_CODES = ["DEFAULT", "PRINCIPALE"];

function emitWarehouseDischarged(eventPayload) {
    domainBus.emit(EVENTS.WAREHOUSE_DISCHARGED, eventPayload);
}

function normalizeSku(value) {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function normalizeMaterialText(value) {
    const text = String(value ?? "").trim();
    return text || null;
}

function parsePositiveDecimal(value) {
    if (value == null || value === "") return null;
    let normalized = value;
    if (typeof value === "string") {
        const cleaned = value.trim().replace(/[^\d,.-]/g, "");
        const lastComma = cleaned.lastIndexOf(",");
        const lastDot = cleaned.lastIndexOf(".");

        if (lastComma !== -1 && lastDot !== -1) {
            const decimalSeparator = lastComma > lastDot ? "," : ".";
            const thousandSeparator = decimalSeparator === "," ? "." : ",";
            normalized = cleaned
                .replace(new RegExp(`\\${thousandSeparator}`, "g"), "")
                .replace(decimalSeparator, ".");
        } else if (lastComma !== -1) {
            normalized = cleaned.replace(",", ".");
        } else {
            normalized = cleaned;
        }
    }
    try {
        const decimal = new Prisma.Decimal(normalized);
        return decimal.gt(0) ? decimal : null;
    } catch {
        return null;
    }
}

export function normalizeAutomaticLoadLine(line = {}) {
    const codiceSku = normalizeSku(line.codice_sku ?? line.sku ?? line.codice_articolo ?? line.cod_articolo);
    const descrizione = normalizeMaterialText(
        line.descrizione_articolo ?? line.descrizione_materiale ?? line.descrizione ?? line.articolo ?? line.prodotto ?? line.nome
    );
    const quantita = parsePositiveDecimal(line.quantita ?? line.qty ?? line.qta);
    const importoRiga = parsePositiveDecimal(line.importo_riga ?? line.valore_riga ?? line.importo ?? line.valore_totale ?? line.prezzo_totale);
    let costoUnitario = parsePositiveDecimal(line.costo_unitario ?? line.prezzo_unitario);

    if (!costoUnitario && importoRiga && quantita) {
        costoUnitario = importoRiga.div(quantita);
    }

    return {
        codice_sku: codiceSku,
        descrizione: descrizione || codiceSku,
        unita_misura: normalizeMaterialText(line.unita_misura ?? line.unita ?? line.um) || "pz",
        quantita,
        costo_unitario: costoUnitario,
        raw: line,
    };
}

export async function getDefaultWarehouseLocation(tx) {
    return tx.ubicazione.findFirst({
        where: {
            codice: { in: DEFAULT_LOCATION_CODES },
        },
        orderBy: { id: "asc" },
    });
}

async function validateDischargeTarget(tx, { cantiere_id, wbs_node_id, task_id, documento_id }) {
    const cantiere = await tx.cantiere.findFirst({
        where: { id: cantiere_id, attivo: 1 },
        select: { id: true },
    });
    if (!cantiere) {
        throw new DomainError('Cantiere non trovato o non attivo.', 'INVALID_CANTIERE');
    }

    if (wbs_node_id) {
        const wbsNode = await tx.wbsNode.findFirst({
            where: { id: wbs_node_id, cantiere_id },
            select: { id: true },
        });
        if (!wbsNode) {
            throw new DomainError('Nodo WBS non appartenente al cantiere.', 'INVALID_WBS');
        }
    }

    if (task_id) {
        const task = await tx.task.findFirst({
            where: { id: task_id, cantiere_id },
            select: { id: true },
        });
        if (!task) {
            throw new DomainError('Task non appartenente al cantiere.', 'INVALID_TASK');
        }
    }

    if (documento_id) {
        const document = await tx.document.findFirst({
            where: { id: documento_id, cantiere_id },
            select: { id: true },
        });
        if (!document) {
            throw new DomainError('Documento non appartenente al cantiere.', 'INVALID_DOCUMENT');
        }
    }
}

export async function createDischargeInTransaction(tx, payload, userId, employeeId, options = {}) {
    const { articolo_id, quantita, ubicazione_da_id, cantiere_id, wbs_node_id, task_id, documento_id } = payload;

    if (!ubicazione_da_id || !cantiere_id) {
        throw new DomainError('Mancano ubicazione_da_id o cantiere_id.', 'MISSING_FIELDS');
    }
    if (!employeeId) {
        throw new DomainError('Utente non collegato a un dipendente.', 'MISSING_EMPLOYEE');
    }

    const qty = new Prisma.Decimal(quantita);
    if (qty.lte(0)) throw new DomainError('La quantità deve essere > 0.', 'INVALID_QTY');

    const articolo = await tx.articolo.findUnique({ where: { id: articolo_id } });
    if (!articolo) throw new DomainError('Articolo non trovato.', 'NOT_FOUND');

    await validateDischargeTarget(tx, { cantiere_id, wbs_node_id, task_id, documento_id });

    const giacenza = await tx.giacenza.findUnique({
        where: { articolo_id_ubicazione_id: { articolo_id, ubicazione_id: ubicazione_da_id } },
        select: { id: true },
    });
    if (!giacenza) {
        throw new DomainError('Giacenza insufficiente.', 'INSUFFICIENT_STOCK');
    }

    const updated = await tx.giacenza.updateMany({
        where: {
            id: giacenza.id,
            quantita_disponibile: { gte: qty },
        },
        data: {
            quantita_disponibile: { decrement: qty },
        },
    });
    if (updated.count !== 1) {
        throw new DomainError('Giacenza insufficiente.', 'INSUFFICIENT_STOCK');
    }

    const costo        = articolo.costo_medio;
    const valoreTotale = costo.mul(qty);

    let targetWbsNodeId = wbs_node_id ?? null;
    if (!targetWbsNodeId) {
        const root = await tx.wbsNode.findFirst({ where: { cantiere_id, parent_id: null } });
        if (root) targetWbsNodeId = root.id;
    }

    const movimento = await tx.movimentoMagazzino.create({
        data: {
            tipo_movimento: 'SCARICO_CANTIERE',
            articolo_id, quantita: qty,
            ubicazione_da_id, cantiere_id,
            wbs_node_id:    targetWbsNodeId,
            task_id:        task_id ?? null,
            costo_unitario: costo,
            valore_totale:  valoreTotale,
            esecutore_id:   userId,
            documento_id:   documento_id ?? null,
        },
    });

    const descrizione = options.description
        ?? `Scarico Magazzino: ${articolo.descrizione} (${articolo.codice_sku})`;

    // Regola di business: scarico genera Spesa APPROVED per Job Costing
    const spesa = await tx.spesa.create({
        data: {
            employee_id:       employeeId,
            cantiere_id,
            wbs_node_id:       targetWbsNodeId,
            task_id:           task_id ?? null,
            importo:           valoreTotale,
            descrizione,
            quantita:          qty,
            fonte:             'MAGAZZINO',
            stato_validazione: ValidationStatus.APPROVED,
        },
    });

    const eventPayload = {
        cantiereId:  cantiere_id,
        wbsNodeId:   targetWbsNodeId,
        spesaId:     spesa.id,
        movimentoId: movimento.id,
    };

    return { movimento, spesa, wbsNodeId: targetWbsNodeId, eventPayload };
}

export async function processDischarge(prisma, payload, userId, employeeId) {
    const result = await prisma.$transaction(async (tx) => {
        const discharge = await createDischargeInTransaction(tx, payload, userId, employeeId);
        return {
            movimentoId: discharge.movimento.id,
            spesaId: discharge.spesa.id,
            wbsNodeId: discharge.wbsNodeId,
            eventPayload: discharge.eventPayload,
        };
    });

    // Emetti DOPO il commit della transazione (mai dentro $transaction)
    emitWarehouseDischarged(result.eventPayload);

    return {
        movimentoId: result.movimentoId,
        spesaId: result.spesaId,
        wbsNodeId: result.wbsNodeId,
    };
}

export async function processCarico(prisma, payload, userId) {
    const { articolo_id, quantita, ubicazione_a_id, costo_acquisto, documento_id, fornitore_id } = payload;

    if (!ubicazione_a_id || costo_acquisto === undefined) {
        throw new DomainError('Mancano ubicazione_a_id o costo_acquisto.', 'MISSING_FIELDS');
    }
    const qty = new Prisma.Decimal(quantita);
    if (qty.lte(0)) throw new DomainError('La quantità deve essere > 0.', 'INVALID_QTY');

    return prisma.$transaction(async (tx) => {
        const articolo = await tx.articolo.findUnique({ where: { id: articolo_id } });
        if (!articolo) throw new DomainError('Articolo non trovato.', 'NOT_FOUND');

        const costoAcq     = new Prisma.Decimal(costo_acquisto);
        const valoreTotale = costoAcq.mul(qty);

        await tx.giacenza.upsert({
            where:  { articolo_id_ubicazione_id: { articolo_id, ubicazione_id: ubicazione_a_id } },
            update: { quantita_disponibile: { increment: qty } },
            create: { articolo_id, ubicazione_id: ubicazione_a_id, quantita_disponibile: qty, quantita_riservata: 0 },
        });

        // Ricalcolo CMP globale
        const agg = await tx.giacenza.aggregate({
            where: { articolo_id },
            _sum:  { quantita_disponibile: true, quantita_riservata: true },
        });
        const qTot   = (agg._sum.quantita_disponibile ?? new Prisma.Decimal(0))
                        .add(agg._sum.quantita_riservata ?? new Prisma.Decimal(0));
        const qOld   = qTot.minus(qty);
        const cmpOld = articolo.costo_medio;
        const cmpNew = qTot.greaterThan(0)
            ? qOld.mul(cmpOld).add(qty.mul(costoAcq)).div(qTot)
            : cmpOld;

        await tx.articolo.update({ where: { id: articolo_id }, data: { costo_medio: cmpNew } });

        await tx.movimentoMagazzino.create({
            data: {
                tipo_movimento: 'CARICO',
                articolo_id, quantita: qty,
                ubicazione_a_id,
                costo_unitario: costoAcq,
                valore_totale:  valoreTotale,
                esecutore_id:   userId,
                documento_id:   documento_id ?? null,
                fornitore_id:   fornitore_id ?? null,
            },
        });
    });
}

export async function upsertArticleAndCreateLoadMovement(tx, line, context) {
    const normalized = normalizeAutomaticLoadLine(line);
    const ubicazioneId = context.ubicazioneId ?? null;
    const userId = context.userId ?? null;

    if (!normalized.codice_sku) {
        return { status: "reconcile", reason: "SKU_MISSING", line: normalized.raw };
    }
    if (!normalized.quantita || !normalized.costo_unitario) {
        return { status: "reconcile", reason: "QTY_OR_COST_MISSING", line: normalized.raw };
    }
    if (!ubicazioneId) {
        return { status: "skipped", reason: "DEFAULT_LOCATION_MISSING", line: normalized.raw };
    }
    if (!userId) {
        return { status: "skipped", reason: "USER_MISSING", line: normalized.raw };
    }

    const existingArticle = await tx.articolo.findUnique({
        where: { codice_sku: normalized.codice_sku },
    });

    const articolo = existingArticle ?? await tx.articolo.create({
        data: {
            codice_sku: normalized.codice_sku,
            descrizione: normalized.descrizione,
            unita_misura: normalized.unita_misura,
            costo_medio: normalized.costo_unitario,
        },
    });

    const valoreTotale = normalized.costo_unitario.mul(normalized.quantita);

    await tx.giacenza.upsert({
        where: {
            articolo_id_ubicazione_id: {
                articolo_id: articolo.id,
                ubicazione_id: ubicazioneId,
            },
        },
        update: {
            quantita_disponibile: { increment: normalized.quantita },
        },
        create: {
            articolo_id: articolo.id,
            ubicazione_id: ubicazioneId,
            quantita_disponibile: normalized.quantita,
            quantita_riservata: 0,
        },
    });

    const agg = await tx.giacenza.aggregate({
        where: { articolo_id: articolo.id },
        _sum: { quantita_disponibile: true, quantita_riservata: true },
    });
    const qTot = (agg._sum.quantita_disponibile ?? new Prisma.Decimal(0))
        .add(agg._sum.quantita_riservata ?? new Prisma.Decimal(0));
    const qOld = qTot.minus(normalized.quantita);
    const cmpOld = articolo.costo_medio;
    const cmpNew = qTot.greaterThan(0)
        ? qOld.mul(cmpOld).add(normalized.quantita.mul(normalized.costo_unitario)).div(qTot)
        : cmpOld;

    await tx.articolo.update({
        where: { id: articolo.id },
        data: {
            costo_medio: cmpNew,
            ...(existingArticle ? {} : {
                descrizione: normalized.descrizione,
                unita_misura: normalized.unita_misura,
            }),
        },
    });

    const movimento = await tx.movimentoMagazzino.create({
        data: {
            tipo_movimento: "CARICO",
            articolo_id: articolo.id,
            quantita: normalized.quantita,
            ubicazione_a_id: ubicazioneId,
            costo_unitario: normalized.costo_unitario,
            valore_totale: valoreTotale,
            esecutore_id: userId,
            documento_id: context.documentoId ?? null,
            fornitore_id: context.fornitoreId ?? null,
        },
    });

    return {
        status: "loaded",
        articolo,
        movimento,
        articleCreated: !existingArticle,
    };
}
