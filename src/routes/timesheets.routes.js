import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createMyTimeEntrySchema,
  deleteMyTimeEntrySchema,
  updateMyTimeEntrySchema,
} from "../schemas/timesheets.schema.js";
import {
  createMyTimeEntry,
  deleteMyTimeEntry,
  updateMyTimeEntry,
} from "../controllers/timesheets.controller.js";

const router = Router();
const DATA_ENTRY_ROLES = ["WORKER", "PROJECT_MANAGER", "HR", "ADMIN"];

router.use("/api/my-timesheets", verifyToken);

router.post(
  "/api/my-timesheets",
  authorizeRoles(...DATA_ENTRY_ROLES),
  validate(createMyTimeEntrySchema),
  createMyTimeEntry
);

router.patch(
  "/api/my-timesheets/:entryId",
  authorizeRoles(...DATA_ENTRY_ROLES),
  validate(updateMyTimeEntrySchema),
  updateMyTimeEntry
);

router.delete(
  "/api/my-timesheets/:entryId",
  authorizeRoles(...DATA_ENTRY_ROLES),
  validate(deleteMyTimeEntrySchema),
  deleteMyTimeEntry
);

export default router;
