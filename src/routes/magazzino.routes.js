import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
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

// Tutte le rotte magazzino richiedono autenticazione
router.use(verifyToken);

router.get("/articoli", getArticoli);
router.post("/articoli", authorizeRoles(...WAREHOUSE_MUTATION_ROLES), createArticolo);
router.get("/ubicazioni", getUbicazioni);
router.post("/ubicazioni", authorizeRoles(...WAREHOUSE_MUTATION_ROLES), createUbicazione);
router.get("/giacenze", getGiacenze);
router.get("/cantiere/:cantiere_id", getMovimentiCantiere);
router.post("/movimenti", authorizeRoles(...WAREHOUSE_MUTATION_ROLES), createMovimento);

export default router;
