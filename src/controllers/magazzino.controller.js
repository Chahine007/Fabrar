import { getDb } from "../db/index.js";
import { processDischarge, processCarico } from "../domain/magazzino/warehouseService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination, positiveCursor } from "../utils/pagination.js";

export const createMovimento = asyncHandler(async (req, res) => {
    const prisma     = getDb();
    const userId     = req.user?.id;
    const employeeId = req.user?.employee_id;

    if (!userId) return res.status(401).json({ error: 'Utente non identificato per l\'operazione.' });

    const { tipo_movimento } = req.body;

    if (tipo_movimento === 'SCARICO_CANTIERE') {
        await processDischarge(prisma, req.body, userId, employeeId);
    } else if (tipo_movimento === 'CARICO') {
        await processCarico(prisma, req.body, userId);
    } else {
        return res.status(400).json({ error: `Tipo movimento '${tipo_movimento}' non supportato.` });
    }

    res.status(201).json({ message: 'Movimento registrato con successo' });
});

export const getArticoli = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const articoli = await prisma.articolo.findMany({
        include: {
            fornitore_default: true,
            giacenze: { include: { ubicazione: true } }
        }
    });
    res.json(articoli);
});

export const createArticolo = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const {
        codice_sku,
        descrizione,
        unita_misura,
        costo_medio = 0,
        scorta_minima = 0,
        categoria = null,
        fornitore_default_id = null,
    } = req.body;

    const articolo = await prisma.articolo.create({
        data: {
            codice_sku,
            descrizione,
            unita_misura,
            costo_medio,
            scorta_minima: Number(scorta_minima) || 0,
            categoria,
            fornitore_default_id: fornitore_default_id ? Number(fornitore_default_id) : null,
        },
        include: { fornitore_default: true },
    });
    res.status(201).json(articolo);
});

export const getUbicazioni = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const ubicazioni = await prisma.ubicazione.findMany();
    res.json(ubicazioni);
});

export const createUbicazione = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { codice, descrizione } = req.body;
    const ubicazione = await prisma.ubicazione.create({
        data: { codice, descrizione }
    });
    res.status(201).json(ubicazione);
});

export const getGiacenze = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 250, maxLimit: 500 });
    const cursor = positiveCursor(req.query.cursor);
    const giacenze = await prisma.giacenza.findMany({
        include: { articolo: true, ubicazione: true },
        orderBy: { id: 'asc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: offset }),
    });
    res.json(giacenze);
});

export const getMovimentiCantiere = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { cantiere_id } = req.params;
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 500 });
    const cursor = positiveCursor(req.query.cursor);
    
    if (!cantiere_id) {
        return res.status(400).json({ error: "cantiere_id mancante." });
    }

    const movimenti = await prisma.movimentoMagazzino.findMany({
        where: { cantiere_id: Number(cantiere_id), tipo_movimento: 'SCARICO_CANTIERE' },
        include: { 
            articolo: true,
            ubicazione_da: true,
            wbs_node: true,
            task: true,
            documento: true,
            fornitore: true,
            esecutore: {
                include: { employee: true }
            }
        },
        orderBy: [{ data_movimento: 'desc' }, { id: 'desc' }],
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: offset }),
    });

    res.json(movimenti);
});
