import express from "express";
import { runLedgerBackfill } from "../controllers/ledger.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = express.Router();

router.post("/backfill", verifyTokenAndRole(["ADMIN"]), runLedgerBackfill);

export default router;
