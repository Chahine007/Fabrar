import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeOptionalText, parseIdParam, round2, toNumber } from "../utils/helpers.js";
import { getProjectFinancials } from "../domain/finance/financeService.js";
import { ensureWbsBelongsToCantiere } from "../domain/shared/linkValidators.js";
import { canAccessCantiere } from "../domain/shared/accessControl.js";

const MUTABLE_INSTALLMENT_STATUSES = ["PENDING"];
const INVOICE_STATUSES = ["DRAFT", "ISSUED"];

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalPositiveInt(value) {
  if (value == null || value === "") return null;
  return parsePositiveInt(value);
}

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseDateValue(value, fieldName, { allowNull = true } = {}) {
  if (value == null || value === "") {
    if (allowNull) return null;
    throw new Error(`${fieldName} obbligatorio.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} non valido.`);
  }

  return parsed;
}

function parseDecimalValue(value, fieldName, { allowNull = false, min = null, max = null } = {}) {
  if (value == null || value === "") {
    if (allowNull) return null;
    throw new Error(`${fieldName} obbligatorio.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} non valido.`);
  }

  if (min != null && parsed < min) {
    throw new Error(`${fieldName} non può essere minore di ${min}.`);
  }

  if (max != null && parsed > max) {
    throw new Error(`${fieldName} non può essere maggiore di ${max}.`);
  }

  return parsed;
}

function normalizeEnumValue(value, allowedValues, fallback = null) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : null;
}

function mapInvoice(invoice) {
  return {
    ...invoice,
    importo_totale: round2(toNumber(invoice.importo_totale)),
    rate: Array.isArray(invoice.rate)
      ? invoice.rate.map((installment) => ({
          ...installment,
          percentuale: installment.percentuale == null ? null : round2(toNumber(installment.percentuale)),
          importo_previsto: round2(toNumber(installment.importo_previsto)),
        }))
      : invoice.rate,
  };
}

function mapInstallment(installment) {
  return {
    ...installment,
    percentuale: installment.percentuale == null ? null : round2(toNumber(installment.percentuale)),
    importo_previsto: round2(toNumber(installment.importo_previsto)),
    fattura: installment.fattura ? mapInvoice(installment.fattura) : null,
  };
}

async function ensureCantiereExists(prisma, cantiereId) {
  const cantiere = await prisma.cantiere.findUnique({
    where: { id: cantiereId },
    select: {
      id: true,
      nome: true,
      budget: true,
      valore_contratto: true,
    },
  });

  return cantiere;
}

async function ensureBillingAccess(prisma, user, cantiereId) {
  return canAccessCantiere(prisma, user, cantiereId, {
    globalRoles: ["ADMIN"],
    ownerRoles: ["PROJECT_MANAGER"],
  });
}

async function ensureDocumentBelongsToCantiere(prisma, documentId, cantiereId) {
  if (documentId == null) return true;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      cantiere_id: cantiereId,
    },
    select: { id: true },
  });

  return Boolean(document);
}

function buildBillingInclude() {
  return {
    wbs_node: {
      select: {
        id: true,
        nome: true,
        parent_id: true,
      },
    },
    fattura: {
      include: {
        documento: {
          select: {
            id: true,
            name: true,
            file_path: true,
            type: true,
            numero_fattura: true,
            data_emissione: true,
          },
        },
      },
    },
  };
}

function buildInvoiceInclude() {
  return {
    documento: {
      select: {
        id: true,
        name: true,
        file_path: true,
        type: true,
        numero_fattura: true,
        data_emissione: true,
      },
    },
    rate: {
      include: {
        wbs_node: {
          select: {
            id: true,
            nome: true,
            parent_id: true,
          },
        },
      },
      orderBy: [{ data_scadenza_prevista: "asc" }, { id: "asc" }],
    },
  };
}

export const getProjectBilling = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parseIdParam(req.params.cantiereId ?? req.params.id ?? req.query.cantiere_id);

  if (!cantiereId) {
    return res.status(400).json({ error: "ID cantiere non valido." });
  }

  const cantiere = await ensureCantiereExists(prisma, cantiereId);
  if (!cantiere) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }
  if (!(await ensureBillingAccess(prisma, req.user, cantiereId))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const [rate, fatture, financials] = await Promise.all([
    prisma.rata.findMany({
      where: { cantiere_id: cantiereId },
      include: buildBillingInclude(),
      orderBy: [{ data_scadenza_prevista: "asc" }, { id: "asc" }],
    }),
    prisma.fattura.findMany({
      where: { cantiere_id: cantiereId },
      include: buildInvoiceInclude(),
      orderBy: [{ data_emissione: "desc" }, { id: "desc" }],
    }),
    getProjectFinancials(cantiereId),
  ]);

  res.json({
    cantiere: {
      id: cantiere.id,
      nome: cantiere.nome,
      totale_contratto: financials.totaleContratto,
    },
    summary: {
      totale_contratto: financials.totaleContratto,
      totale_fatturato: financials.totaleFatturato,
      totale_incassato: financials.totaleIncassato,
      da_fatturare: financials.daFatturare,
    },
    rate: rate.map(mapInstallment),
    fatture: fatture.map(mapInvoice),
  });
});

export const createInstallment = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parseIdParam(req.params.cantiereId ?? req.body.cantiere_id);

  if (!cantiereId) {
    return res.status(400).json({ error: "ID cantiere non valido." });
  }

  const cantiere = await ensureCantiereExists(prisma, cantiereId);
  if (!cantiere) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }
  if (!(await ensureBillingAccess(prisma, req.user, cantiereId))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const nome = normalizeOptionalText(req.body.nome);
  if (!nome) {
    return res.status(400).json({ error: "Il nome della rata è obbligatorio." });
  }

  const wbsNodeId = parseOptionalPositiveInt(req.body.wbs_node_id);
  if (!(await ensureWbsBelongsToCantiere(prisma, wbsNodeId, cantiereId))) {
    return res.status(400).json({ error: "Nodo WBS non valido per questo cantiere." });
  }

  const status = normalizeEnumValue(req.body.stato, MUTABLE_INSTALLMENT_STATUSES, "PENDING");
  if (!status) {
    return res.status(400).json({ error: "Le rate possono essere create solo in stato PENDING." });
  }

  let importoPrevisto;
  let percentuale;
  let dataScadenzaPrevista;

  try {
    importoPrevisto = parseDecimalValue(req.body.importo_previsto, "importo_previsto", { min: 0 });
    percentuale = parseDecimalValue(req.body.percentuale, "percentuale", { allowNull: true, min: 0, max: 100 });
    dataScadenzaPrevista = parseDateValue(req.body.data_scadenza_prevista, "data_scadenza_prevista", { allowNull: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const installment = await prisma.rata.create({
    data: {
      cantiere_id: cantiereId,
      wbs_node_id: wbsNodeId,
      nome,
      percentuale,
      importo_previsto: importoPrevisto,
      data_scadenza_prevista: dataScadenzaPrevista,
      stato: status,
    },
    include: buildBillingInclude(),
  });

  res.status(201).json(mapInstallment(installment));
});

export const updateInstallment = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const installmentId = parseIdParam(req.params.installmentId ?? req.params.id);

  if (!installmentId) {
    return res.status(400).json({ error: "ID rata non valido." });
  }

  const existing = await prisma.rata.findUnique({
    where: { id: installmentId },
    select: {
      id: true,
      cantiere_id: true,
      wbs_node_id: true,
      fattura_id: true,
      stato: true,
    },
  });

  if (!existing) {
    return res.status(404).json({ error: "Rata non trovata." });
  }
  if (!(await ensureBillingAccess(prisma, req.user, existing.cantiere_id))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const data = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "nome")) {
    const nome = normalizeOptionalText(req.body.nome);
    if (!nome) {
      return res.status(400).json({ error: "Il nome della rata non può essere vuoto." });
    }
    data.nome = nome;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "percentuale")) {
    try {
      data.percentuale = parseDecimalValue(req.body.percentuale, "percentuale", { allowNull: true, min: 0, max: 100 });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "importo_previsto")) {
    try {
      data.importo_previsto = parseDecimalValue(req.body.importo_previsto, "importo_previsto", { min: 0 });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "data_scadenza_prevista")) {
    try {
      data.data_scadenza_prevista = parseDateValue(req.body.data_scadenza_prevista, "data_scadenza_prevista", { allowNull: true });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "stato")) {
    const status = normalizeEnumValue(req.body.stato, MUTABLE_INSTALLMENT_STATUSES, null);
    if (!status) {
      return res.status(400).json({ error: "Lo stato rata è gestito dal flusso di fatturazione." });
    }
    if (existing.stato !== "PENDING" || existing.fattura_id != null) {
      return res.status(409).json({ error: "Rata già collegata al flusso di fatturazione." });
    }
    data.stato = status;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "wbs_node_id")) {
    const wbsNodeId = parseOptionalPositiveInt(req.body.wbs_node_id);
    if (!(await ensureWbsBelongsToCantiere(prisma, wbsNodeId, existing.cantiere_id))) {
      return res.status(400).json({ error: "Nodo WBS non valido per questo cantiere." });
    }
    data.wbs_node_id = wbsNodeId;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Nessun campo valido da aggiornare." });
  }

  const updated = await prisma.rata.update({
    where: { id: installmentId },
    data,
    include: buildBillingInclude(),
  });

  res.json(mapInstallment(updated));
});

export const createInvoice = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const cantiereId = parseIdParam(req.params.cantiereId ?? req.body.cantiere_id);

  if (!cantiereId) {
    return res.status(400).json({ error: "ID cantiere non valido." });
  }

  const cantiere = await ensureCantiereExists(prisma, cantiereId);
  if (!cantiere) {
    return res.status(404).json({ error: "Cantiere non trovato." });
  }
  if (!(await ensureBillingAccess(prisma, req.user, cantiereId))) {
    return res.status(403).json({ error: "Accesso negato al cantiere richiesto." });
  }

  const stato = normalizeEnumValue(req.body.stato, INVOICE_STATUSES, "DRAFT");
  if (!stato) {
    return res.status(400).json({ error: "Stato fattura non valido." });
  }

  const documentoId = parseOptionalPositiveInt(req.body.documento_id);
  if (!(await ensureDocumentBelongsToCantiere(prisma, documentoId, cantiereId))) {
    return res.status(400).json({ error: "Documento non valido per questo cantiere." });
  }

  let dataEmissione;
  try {
    dataEmissione = parseDateValue(req.body.data_emissione, "data_emissione", { allowNull: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const installmentIds = Array.isArray(req.body.installment_ids)
    ? [...new Set(req.body.installment_ids.map(parsePositiveInt).filter(Boolean))]
    : [];

  const result = await prisma.$transaction(async (tx) => {
    let selectedInstallments = [];

    if (installmentIds.length > 0) {
      selectedInstallments = await tx.rata.findMany({
        where: {
          id: { in: installmentIds },
          cantiere_id: cantiereId,
        },
        select: {
          id: true,
          fattura_id: true,
          stato: true,
          importo_previsto: true,
        },
      });

      if (selectedInstallments.length !== installmentIds.length) {
        throw httpError("Una o più rate selezionate non esistono o non appartengono al cantiere.", 400);
      }

      const blocked = selectedInstallments.find(
        (installment) => installment.fattura_id != null || installment.stato !== "PENDING"
      );
      if (blocked) {
        throw httpError(`La rata ${blocked.id} non è fatturabile nello stato corrente.`, 409);
      }
    }

    let importoTotale;
    try {
        importoTotale = parseDecimalValue(
          req.body.importo_totale ??
          (selectedInstallments.length > 0
            ? selectedInstallments.reduce((sum, installment) => sum + toNumber(installment.importo_previsto), 0)
            : null),
        "importo_totale",
        { min: 0 }
      );
    } catch (err) {
      throw new Error(err.message);
    }

    const fattura = await tx.fattura.create({
      data: {
        cantiere_id: cantiereId,
        numero_fattura: normalizeOptionalText(req.body.numero_fattura),
        data_emissione: dataEmissione,
        importo_totale: importoTotale,
        stato,
        documento_id: documentoId,
        note: normalizeOptionalText(req.body.note),
      },
      include: buildInvoiceInclude(),
    });

    if (installmentIds.length > 0) {
      const updatedInstallments = await tx.rata.updateMany({
        where: {
          id: { in: installmentIds },
          cantiere_id: cantiereId,
          fattura_id: null,
          stato: "PENDING",
        },
        data: {
          fattura_id: fattura.id,
          stato: "INVOICED",
        },
      });

      if (updatedInstallments.count !== installmentIds.length) {
        throw httpError("Una o più rate sono già state fatturate da un'altra operazione.", 409);
      }
    }

    return tx.fattura.findUnique({
      where: { id: fattura.id },
      include: buildInvoiceInclude(),
    });
  });

  res.status(201).json(mapInvoice(result));
});
