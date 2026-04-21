import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyTokenAndRole, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
    employeeIdSchema,
    updateEmployeeSchema,
    parseCvSchema,
} from "../schemas/employees.schema.js";
import {
    listEmployees,
    updateEmployeeCtrl,
    getEmployeeTimeline,
    parseCv,
} from "../controllers/employees.controller.js";

const router = Router();

const cvParseLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 20, // Max 20 richieste per IP all'ora
    message: { error: "Limite elaborazione CV raggiunto (max 20/ora)." },
});

router.use(["/api/employees", "/api/admin/employees"], verifyTokenAndRole(DASHBOARD_ROLES));

router.get("/api/employees", listEmployees);
router.get("/api/admin/employees/:id/timeline", validate(employeeIdSchema), getEmployeeTimeline);
router.patch("/api/admin/employees/:id", validate(updateEmployeeSchema), updateEmployeeCtrl);
router.post("/api/admin/employees/parse-cv", cvParseLimiter, validate(parseCvSchema), parseCv);

export default router;