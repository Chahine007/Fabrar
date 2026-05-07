import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function cleanNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function compactAlnum(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function normalizeVat(value) {
  const text = compactAlnum(value);
  return text ? text.replace(/^IT/, "") : null;
}

function normalizeIban(value) {
  const text = cleanNullableString(value);
  return text ? text.replace(/\s+/g, "").toUpperCase() : null;
}

function supplierPayload(body) {
  const partitaIva = cleanNullableString(body.partita_iva);
  return {
    ragione_sociale: cleanNullableString(body.ragione_sociale),
    partita_iva: partitaIva,
    partita_iva_normalizzata: cleanNullableString(body.partita_iva_normalizzata) ?? normalizeVat(partitaIva),
    codice_fiscale: cleanNullableString(body.codice_fiscale),
    email: cleanNullableString(body.email),
    telefono: cleanNullableString(body.telefono),
    indirizzo: cleanNullableString(body.indirizzo),
    comune: cleanNullableString(body.comune),
    provincia: cleanNullableString(body.provincia),
    cap: cleanNullableString(body.cap),
    paese: cleanNullableString(body.paese) ?? "IT",
    iban_default: normalizeIban(body.iban_default),
    note: cleanNullableString(body.note),
  };
}

function supplierPatchPayload(body) {
  const allowedFields = [
    "ragione_sociale",
    "partita_iva",
    "partita_iva_normalizzata",
    "codice_fiscale",
    "email",
    "telefono",
    "indirizzo",
    "comune",
    "provincia",
    "cap",
    "paese",
    "iban_default",
    "note",
  ];
  const data = Object.fromEntries(
    allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, field === "iban_default" ? normalizeIban(body[field]) : cleanNullableString(body[field])])
  );
  if (Object.prototype.hasOwnProperty.call(data, "partita_iva") && !data.partita_iva_normalizzata) {
    data.partita_iva_normalizzata = normalizeVat(data.partita_iva);
  }
  return data;
}

export const getAllSuppliers = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const q = cleanNullableString(req.query.q);

  const suppliers = await prisma.fornitore.findMany({
    where: q
      ? {
          OR: [
            { ragione_sociale: { contains: q, mode: "insensitive" } },
            { partita_iva: { contains: q, mode: "insensitive" } },
            { partita_iva_normalizzata: { contains: normalizeVat(q) ?? q, mode: "insensitive" } },
            { codice_fiscale: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { comune: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { ragione_sociale: "asc" },
  });

  res.json(suppliers);
});

export const getSupplierById = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID fornitore non valido." });
  }

  const supplier = await prisma.fornitore.findUnique({
    where: { id },
    include: {
      articoli_default: true,
      movimenti_magazzino: {
        orderBy: { data_movimento: "desc" },
        take: 20,
        include: { articolo: true, documento: true },
      },
      fatture_acquisto: {
        orderBy: { data_documento: "desc" },
        take: 20,
        include: { documento: true, spesa: true },
      },
    },
  });

  if (!supplier) {
    return res.status(404).json({ error: "Fornitore non trovato." });
  }

  res.json(supplier);
});

export const createSupplier = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const data = supplierPayload(req.body);

  if (!data.ragione_sociale) {
    return res.status(400).json({ error: "La ragione sociale è obbligatoria." });
  }

  const supplier = await prisma.fornitore.create({ data });
  res.status(201).json(supplier);
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID fornitore non valido." });
  }

  const data = supplierPatchPayload(req.body);
  if (Object.prototype.hasOwnProperty.call(req.body, "ragione_sociale") && !data.ragione_sociale) {
    return res.status(400).json({ error: "La ragione sociale non può essere vuota." });
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Nessun campo valido da aggiornare." });
  }

  let supplier;
  try {
    supplier = await prisma.fornitore.update({
      where: { id },
      data,
    });
  } catch (err) {
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Fornitore non trovato." });
    }
    throw err;
  }

  res.json(supplier);
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID fornitore non valido." });
  }

  try {
    await prisma.fornitore.delete({ where: { id } });
  } catch (err) {
    if (err?.code === "P2003") {
      return res.status(409).json({
        error: "Impossibile eliminare il fornitore: è collegato ad articoli o movimenti di magazzino.",
      });
    }
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Fornitore non trovato." });
    }
    throw err;
  }

  res.json({ ok: true, id });
});
