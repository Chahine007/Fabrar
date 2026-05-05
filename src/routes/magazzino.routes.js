import express from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
    createArticoloSchema,
    createMovimentoSchema,
    createUbicazioneSchema,
    getMovimentiCantiereSchema,
} from "../schemas/magazzino.schema.js";
import { 
    createMovimento, 
    getArticoli, 
    createArticolo,
    getUbicazioni, 
    createUbicazione,
    getGiacenze,
    getMovimentiCantiere
} from "../controllers/magazzino.controller.js";

const router = express.Router();
const WAREHOUSE_MUTATION_ROLES = ["ADMIN", "PROJECT_MANAGER", "WAREHOUSEMAN"];

const requireAuth = verifyTokenAndRole();
const requireWarehouseMutationRole = verifyTokenAndRole(WAREHOUSE_MUTATION_ROLES);

router.get("/articoli", requireAuth, getArticoli);
router.post("/articoli", requireWarehouseMutationRole, validate(createArticoloSchema), createArticolo);
router.get("/ubicazioni", requireAuth, getUbicazioni);
router.post("/ubicazioni", requireWarehouseMutationRole, validate(createUbicazioneSchema), createUbicazione);
router.get("/giacenze", requireAuth, getGiacenze);
router.get("/cantiere/:cantiere_id", requireAuth, validate(getMovimentiCantiereSchema), getMovimentiCantiere);
router.post("/movimenti", requireWarehouseMutationRole, validate(createMovimentoSchema), createMovimento);

export default router;
