import { Router } from "express";
import rateLimit from "express-rate-limit";
import { verifyToken, DASHBOARD_ROLES } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
    createEmployeeSchema,
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
import { createEmployee } from "../controllers/employee.controller.js";

const router = Router();

const cvParseLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 ora
    max: 20, // Max 20 richieste per IP all'ora
    message: { error: "Limite elaborazione CV raggiunto (max 20/ora)." },
});

router.use(["/api/employees", "/api/admin/employees"], verifyToken);

router.get("/api/employees", authorizeRoles(...DASHBOARD_ROLES), listEmployees);
router.post("/api/employees", authorizeRoles("ADMIN", "HR"), validate(createEmployeeSchema), createEmployee);
router.get("/api/admin/employees/:id/timeline", authorizeRoles(...DASHBOARD_ROLES), validate(employeeIdSchema), getEmployeeTimeline);
router.patch("/api/admin/employees/:id", authorizeRoles("ADMIN", "HR"), validate(updateEmployeeSchema), updateEmployeeCtrl);
router.post("/api/admin/employees/parse-cv", authorizeRoles("ADMIN", "HR"), cvParseLimiter, validate(parseCvSchema), parseCv);

export default router;
