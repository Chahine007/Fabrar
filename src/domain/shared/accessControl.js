import { normalizeRole } from "../../middleware/auth.js";
import { AppRole } from "../../constants.js";

function normalizePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRoleList(roles) {
  return new Set(roles.map((role) => normalizeRole(role, null)).filter(Boolean));
}

export async function canAccessCantiere(prisma, user, cantiereId, options = {}) {
  const normalizedCantiereId = normalizePositiveInt(cantiereId);
  if (!normalizedCantiereId) return false;

  const role = normalizeRole(user?.role, null);
  const userId = normalizePositiveInt(user?.id);
  if (!role || !userId) return false;

  const globalRoles = normalizeRoleList(options.globalRoles ?? ["ADMIN"]);
  if (globalRoles.has(role)) return true;

  const warehouseRoles = normalizeRoleList(options.warehouseRoles ?? []);
  if (warehouseRoles.has(role)) {
    const cantiere = await prisma.cantiere.findFirst({
      where: {
        id: normalizedCantiereId,
        ...(options.allowInactiveWarehouse ? {} : { attivo: 1 }),
      },
      select: { id: true },
    });
    return Boolean(cantiere);
  }

  if (role === AppRole.WORKER && options.allowWorkerTasks !== false) {
    const employeeId = normalizePositiveInt(user?.employee_id);
    if (!employeeId) return false;
    const cantiere = await prisma.cantiere.findFirst({
      where: {
        id: normalizedCantiereId,
        tasks: { some: { assignee_id: employeeId } },
      },
      select: { id: true },
    });
    if (cantiere) return true;
  }

  const ownerRoles = normalizeRoleList(options.ownerRoles ?? ["PROJECT_MANAGER"]);
  if (!ownerRoles.has(role)) return false;

  const ownerConditions = [{ pm_id: userId }];
  if (options.allowSiteManager !== false) {
    ownerConditions.push({ site_manager_id: userId });
  }

  const cantiere = await prisma.cantiere.findFirst({
    where: {
      id: normalizedCantiereId,
      OR: ownerConditions,
    },
    select: { id: true },
  });

  return Boolean(cantiere);
}

export function buildCantiereAccessWhere(user, options = {}) {
  const role = normalizeRole(user?.role, null);
  const userId = normalizePositiveInt(user?.id);
  const employeeId = normalizePositiveInt(user?.employee_id);

  const globalRoles = normalizeRoleList(options.globalRoles ?? ["ADMIN"]);
  if (role && globalRoles.has(role)) {
    return options.activeOnly ? { attivo: 1 } : {};
  }

  const warehouseRoles = normalizeRoleList(options.warehouseRoles ?? []);
  if (role && warehouseRoles.has(role)) {
    return options.allowInactiveWarehouse ? {} : { attivo: 1 };
  }

  const ownerRoles = normalizeRoleList(options.ownerRoles ?? ["PROJECT_MANAGER"]);
  if (role && userId && ownerRoles.has(role)) {
    return {
      ...(options.activeOnly ? { attivo: 1 } : {}),
      OR: [
        { pm_id: userId },
        ...(options.allowSiteManager === false ? [] : [{ site_manager_id: userId }]),
      ],
    };
  }

  if (role === AppRole.WORKER && employeeId && options.allowWorkerTasks !== false) {
    return {
      ...(options.activeOnly === false ? {} : { attivo: 1 }),
      tasks: { some: { assignee_id: employeeId } },
    };
  }

  return { id: -1 };
}

export async function getAccessibleCantiere(prisma, user, cantiereId, options = {}) {
  const normalizedCantiereId = normalizePositiveInt(cantiereId);
  if (!normalizedCantiereId) return null;

  const role = normalizeRole(user?.role, null);
  const userId = normalizePositiveInt(user?.id);
  if (!role || !userId) return null;

  const select = options.select ?? { id: true };
  const globalRoles = normalizeRoleList(options.globalRoles ?? ["ADMIN"]);
  if (globalRoles.has(role)) {
    return prisma.cantiere.findUnique({
      where: { id: normalizedCantiereId },
      select,
    });
  }

  const ownerRoles = normalizeRoleList(options.ownerRoles ?? ["PROJECT_MANAGER"]);
  if (!ownerRoles.has(role)) return null;

  const ownerConditions = [{ pm_id: userId }];
  if (options.allowSiteManager !== false) {
    ownerConditions.push({ site_manager_id: userId });
  }

  return prisma.cantiere.findFirst({
    where: {
      id: normalizedCantiereId,
      OR: ownerConditions,
    },
    select,
  });
}
