import express from "express";
import { getDataQualityReport, getJobCosting, getOverview } from "../controllers/bi.controller.js";
import { verifyTokenAndRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/overview", verifyTokenAndRole(["ADMIN", "HR", "PROJECT_MANAGER"]), getOverview);
router.get("/job-costing", verifyTokenAndRole(["ADMIN", "HR", "PROJECT_MANAGER"]), getJobCosting);
router.get("/data-quality", verifyTokenAndRole(["ADMIN", "HR"]), getDataQualityReport);

export default router;
