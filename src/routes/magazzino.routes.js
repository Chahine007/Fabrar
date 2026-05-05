import express from "express";
import { verifyTokenAndRole } from "../middleware/auth.js";
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
const WAREHOUSE_MUTATION_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN"];

const requireAuth = verifyTokenAndRole();
const requireWarehouseMutationRole = verifyTokenAndRole(WAREHOUSE_MUTATION_ROLES);

router.get("/articoli", requireAuth, getArticoli);
router.post("/articoli", requireWarehouseMutationRole, createArticolo);
router.get("/ubicazioni", requireAuth, getUbicazioni);
router.post("/ubicazioni", requireWarehouseMutationRole, createUbicazione);
router.get("/giacenze", requireAuth, getGiacenze);
router.get("/cantiere/:cantiere_id", requireAuth, getMovimentiCantiere);
router.post("/movimenti", requireWarehouseMutationRole, createMovimento);

export default router;
