import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  analyzeGenericInvoiceOcr,
  analyzeSpesaOcr,
  confirmGenericInvoiceOcr,
  confirmSpesaOcr,
  matchSpesaOcr,
} from "../domain/logistica/speseOcrService.js";

export const analyzeSpesaOcrController = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await analyzeSpesaOcr(prisma, {
    spesaId: req.params.spesaId,
    file: req.file,
    user: req.user,
  });

  res.json(result);
});

export const analyzeGenericInvoiceOcrController = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await analyzeGenericInvoiceOcr(prisma, {
    file: req.file,
    cantiereId: req.body.cantiere_id ?? req.body.cantiereId ?? req.query.cantiere_id ?? null,
    user: req.user,
  });

  res.json(result);
});

export const confirmSpesaOcrController = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await confirmSpesaOcr(prisma, {
    spesaId: req.params.spesaId,
    documentId: req.body.document_id ?? req.body.documentId ?? null,
    lines: req.body.lines ?? req.body.righe_materiali ?? [],
    ubicazioneId: req.body.ubicazione_id ?? req.body.ubicazioneId ?? null,
    user: req.user,
  });

  res.json(result);
});

export const confirmGenericInvoiceOcrController = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await confirmGenericInvoiceOcr(prisma, {
    upload: req.body.upload ?? null,
    ocrPayload: req.body.ocrPayload ?? req.body.ocr_payload ?? {},
    lines: req.body.lines ?? req.body.righe_materiali ?? [],
    spesaId: req.body.spesa_id ?? req.body.spesaId ?? null,
    cantiereId: req.body.cantiere_id ?? req.body.cantiereId ?? null,
    ubicazioneId: req.body.ubicazione_id ?? req.body.ubicazioneId ?? null,
    user: req.user,
  });

  res.json(result);
});

export const matchSpesaOcrController = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const result = await matchSpesaOcr(prisma, {
    ocrPayload: req.body.ocrPayload ?? req.body.ocr_payload ?? req.body,
    cantiereId: req.body.cantiere_id ?? req.body.cantiereId ?? null,
    user: req.user,
  });

  res.json(result);
});
