import asyncHandler from "express-async-handler";
import { getDb } from "../db/index.js";
import { processDischarge, processCarico } from "../domain/magazzino/warehouseService.js";
import { DomainError } from "../domain/shared/DomainError.js";

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
    const giacenze = await prisma.giacenza.findMany({
        include: { articolo: true, ubicazione: true }
    });
    res.json(giacenze);
});

export const getMovimentiCantiere = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const { cantiere_id } = req.params;
    
    if (!cantiere_id) {
        return res.status(400).json({ error: "cantiere_id mancante." });
    }

    const movimenti = await prisma.movimentoMagazzino.findMany({
        where: { cantiere_id: Number(cantiere_id), tipo_movimento: 'SCARICO_CANTIERE' },
        include: { 
            articolo: true,
            ubicazione_da: true,
            wbs_node: true,
            documento: true,
            fornitore: true,
            esecutore: {
                include: { employee: true }
            }
        },
        orderBy: { data_movimento: 'desc' }
    });

    res.json(movimenti);
});
