import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { authorizeRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validation.js";
import {
  createRequest,
  fulfillRequest,
  getRequests,
  updateRequestStatus,
} from "../controllers/materialRequests.controller.js";
import {
  createMaterialRequestSchema,
  fulfillMaterialRequestSchema,
  listMaterialRequestsSchema,
  updateMaterialRequestStatusSchema,
} from "../schemas/materialRequests.schema.js";

const router = Router();
const REQUEST_READ_WRITE_ROLES = ["ADMIN", "HR", "PROJECT_MANAGER", "WAREHOUSEMAN", "WORKER"];
const REQUEST_STATUS_ROLES = ["ADMIN", "PROJECT_MANAGER"];
const REQUEST_FULFILL_ROLES = ["ADMIN", "PROJECT_MANAGER", "WAREHOUSEMAN"];

router.use(verifyToken);

router.get("/", authorizeRoles(...REQUEST_READ_WRITE_ROLES), validate(listMaterialRequestsSchema), getRequests);
router.post("/", authorizeRoles(...REQUEST_READ_WRITE_ROLES), validate(createMaterialRequestSchema), createRequest);
router.patch("/:id/status", authorizeRoles(...REQUEST_STATUS_ROLES), validate(updateMaterialRequestStatusSchema), updateRequestStatus);
router.post("/:id/fulfill", authorizeRoles(...REQUEST_FULFILL_ROLES), validate(fulfillMaterialRequestSchema), fulfillRequest);

export default router;
