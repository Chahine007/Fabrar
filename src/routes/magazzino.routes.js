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

// Tutte le rotte magazzino richiedono autenticazione
router.use(verifyTokenAndRole());

router.get("/articoli", getArticoli);
router.post("/articoli", createArticolo);
router.get("/ubicazioni", getUbicazioni);
router.post("/ubicazioni", createUbicazione);
router.get("/giacenze", getGiacenze);
router.get("/cantiere/:cantiere_id", getMovimentiCantiere);
router.post("/movimenti", createMovimento);

export default router;
