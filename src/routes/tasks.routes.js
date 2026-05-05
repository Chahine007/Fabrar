import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createTaskSchema,
  deleteTaskSchema,
  listTasksSchema,
  updateTaskSchema,
} from "../schemas/tasks.schema.js";
import {
  createTask,
  deleteTask,
  getAllTasks,
  updateTask,
} from "../controllers/tasks.controller.js";

const router = Router();
const TASK_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WORKER"];

function injectCantiereIdInQuery(req, _res, next) {
  req.query = {
    ...req.query,
    cantiere_id: req.params.id,
  };
  next();
}

function injectCantiereIdInBody(req, _res, next) {
  req.body = {
    ...req.body,
    cantiere_id: req.params.id,
  };
  next();
}

router.use(["/api/tasks", "/api/tasks/:taskId", "/api/cantieri/:id/tasks"], verifyToken);

router.get("/api/tasks", authorizeRoles(...TASK_ROLES), validate(listTasksSchema), getAllTasks);
router.post("/api/tasks", authorizeRoles(...TASK_ROLES), validate(createTaskSchema), createTask);
router.patch("/api/tasks/:taskId", authorizeRoles(...TASK_ROLES), validate(updateTaskSchema), updateTask);
router.delete("/api/tasks/:taskId", authorizeRoles(...TASK_ROLES), validate(deleteTaskSchema), deleteTask);

// Alias temporanei per compatibilita con il frontend attuale.
router.get(
  "/api/cantieri/:id/tasks",
  authorizeRoles(...TASK_ROLES),
  injectCantiereIdInQuery,
  validate(listTasksSchema),
  getAllTasks
);

router.post(
  "/api/cantieri/:id/tasks",
  authorizeRoles(...TASK_ROLES),
  injectCantiereIdInBody,
  validate(createTaskSchema),
  createTask
);

export default router;
