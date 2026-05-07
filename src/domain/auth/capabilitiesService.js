import { AppRole } from "../../constants.js";
import { normalizeRole } from "../../middleware/auth.js";

export const CAPABILITIES = Object.freeze({
  DASHBOARD_READ: "dashboard:read",
  DATA_ENTRY_READ: "data_entry:read",
  PROJECT_READ: "projects:read",
  PROJECT_WRITE: "projects:write",
  TASK_READ: "tasks:read",
  TASK_WRITE: "tasks:write",
  MESSAGES_READ: "messages:read",
  HR_READ: "hr:read",
  HR_WRITE: "hr:write",
  AUDIT_APPROVE: "audit:approve",
  TIMESHEET_SELF_WRITE: "timesheets:self:write",
  WAREHOUSE_READ: "warehouse:read",
  WAREHOUSE_WRITE: "warehouse:write",
  SUPPLIERS_READ: "suppliers:read",
  SUPPLIERS_WRITE: "suppliers:write",
  MATERIAL_REQUEST_READ: "material_requests:read",
  MATERIAL_REQUEST_WRITE: "material_requests:write",
  ACCOUNTING_READ: "accounting:read",
  ACCOUNTING_WRITE: "accounting:write",
  BILLING_READ: "billing:read",
  BILLING_WRITE: "billing:write",
  DOCUMENT_READ: "documents:read",
  DOCUMENT_WRITE: "documents:write",
  WORKFLOW_TRANSITION: "workflow:transition",
});

const ROLE_CAPABILITIES = Object.freeze({
  [AppRole.ADMIN]: Object.values(CAPABILITIES),
  [AppRole.HR]: [
    CAPABILITIES.PROJECT_READ,
    CAPABILITIES.DATA_ENTRY_READ,
    CAPABILITIES.TASK_READ,
    CAPABILITIES.TASK_WRITE,
    CAPABILITIES.MESSAGES_READ,
    CAPABILITIES.HR_READ,
    CAPABILITIES.HR_WRITE,
    CAPABILITIES.AUDIT_APPROVE,
    CAPABILITIES.WAREHOUSE_READ,
    CAPABILITIES.SUPPLIERS_READ,
    CAPABILITIES.MATERIAL_REQUEST_READ,
    CAPABILITIES.MATERIAL_REQUEST_WRITE,
    CAPABILITIES.ACCOUNTING_READ,
    CAPABILITIES.ACCOUNTING_WRITE,
    CAPABILITIES.DOCUMENT_READ,
    CAPABILITIES.DOCUMENT_WRITE,
    CAPABILITIES.WORKFLOW_TRANSITION,
  ],
  [AppRole.PROJECT_MANAGER]: [
    CAPABILITIES.PROJECT_READ,
    CAPABILITIES.DATA_ENTRY_READ,
    CAPABILITIES.PROJECT_WRITE,
    CAPABILITIES.TASK_READ,
    CAPABILITIES.TASK_WRITE,
    CAPABILITIES.MESSAGES_READ,
    CAPABILITIES.WAREHOUSE_READ,
    CAPABILITIES.MATERIAL_REQUEST_READ,
    CAPABILITIES.MATERIAL_REQUEST_WRITE,
    CAPABILITIES.BILLING_READ,
    CAPABILITIES.BILLING_WRITE,
    CAPABILITIES.DOCUMENT_READ,
    CAPABILITIES.DOCUMENT_WRITE,
    CAPABILITIES.WORKFLOW_TRANSITION,
  ],
  [AppRole.WAREHOUSEMAN]: [
    CAPABILITIES.PROJECT_READ,
    CAPABILITIES.DATA_ENTRY_READ,
    CAPABILITIES.TASK_READ,
    CAPABILITIES.MESSAGES_READ,
    CAPABILITIES.WAREHOUSE_READ,
    CAPABILITIES.WAREHOUSE_WRITE,
    CAPABILITIES.SUPPLIERS_READ,
    CAPABILITIES.SUPPLIERS_WRITE,
    CAPABILITIES.MATERIAL_REQUEST_READ,
    CAPABILITIES.MATERIAL_REQUEST_WRITE,
    CAPABILITIES.DOCUMENT_READ,
    CAPABILITIES.DOCUMENT_WRITE,
    CAPABILITIES.WORKFLOW_TRANSITION,
  ],
  [AppRole.WORKER]: [
    CAPABILITIES.PROJECT_READ,
    CAPABILITIES.DATA_ENTRY_READ,
    CAPABILITIES.TASK_READ,
    CAPABILITIES.TASK_WRITE,
    CAPABILITIES.MESSAGES_READ,
    CAPABILITIES.TIMESHEET_SELF_WRITE,
    CAPABILITIES.MATERIAL_REQUEST_READ,
    CAPABILITIES.MATERIAL_REQUEST_WRITE,
    CAPABILITIES.DOCUMENT_READ,
  ],
});

const EMPLOYEE_ROLE_ALIASES = Object.freeze({
  OPERAIO: AppRole.WORKER,
  WORKER: AppRole.WORKER,
  ADMIN: AppRole.ADMIN,
  HR: AppRole.HR,
  PROJECT_MANAGER: AppRole.PROJECT_MANAGER,
  PM: AppRole.PROJECT_MANAGER,
  WAREHOUSEMAN: AppRole.WAREHOUSEMAN,
  MAGAZZINIERE: AppRole.WAREHOUSEMAN,
});

export function normalizeAppRole(role, fallback = AppRole.WORKER) {
  const normalized = normalizeRole(role, null);
  if (!normalized) return fallback;
  return EMPLOYEE_ROLE_ALIASES[normalized] ?? normalized;
}

export function getCapabilitiesForRole(role) {
  const normalizedRole = normalizeAppRole(role, AppRole.WORKER);
  return [...new Set(ROLE_CAPABILITIES[normalizedRole] ?? ROLE_CAPABILITIES[AppRole.WORKER])];
}

function removeSensitiveCapabilities(capabilities) {
  return capabilities.filter((capability) => (
    !capability.endsWith(":write") &&
    capability !== CAPABILITIES.AUDIT_APPROVE &&
    capability !== CAPABILITIES.WORKFLOW_TRANSITION
  ));
}

export async function getEffectiveUserCapabilities(prisma, userPayload) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userPayload?.id) },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      is_active: true,
      employee: {
        select: {
          id: true,
          nome: true,
          cognome: true,
          ruolo: true,
          attivo: true,
        },
      },
    },
  });

  if (!user || user.is_active !== 1) return null;
  const role = normalizeAppRole(user.role);
  const employeeRole = normalizeAppRole(user.employee?.ruolo, null);
  const roleMismatch = Boolean(employeeRole && employeeRole !== role);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      employee_id: user.employee?.id ?? null,
      employee: user.employee,
    },
    role,
    employee_role: employeeRole,
    role_mismatch: roleMismatch,
    capabilities: roleMismatch
      ? removeSensitiveCapabilities(getCapabilitiesForRole(role))
      : getCapabilitiesForRole(role),
  };
}
