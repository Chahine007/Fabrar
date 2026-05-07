import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getBiJobCosting, getBiOverview, getDataQuality } from "../domain/bi/biService.js";

export const getOverview = asyncHandler(async (_req, res) => {
  const prisma = getDb();
  const overview = await getBiOverview(prisma);
  res.json(overview);
});

export const getJobCosting = asyncHandler(async (req, res) => {
  const prisma = getDb();
  const data = await getBiJobCosting(prisma, { cantiereId: req.query.cantiere_id });
  res.json(data);
});

export const getDataQualityReport = asyncHandler(async (_req, res) => {
  const prisma = getDb();
  const report = await getDataQuality(prisma);
  res.json(report);
});
