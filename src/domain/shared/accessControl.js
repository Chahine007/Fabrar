import { normalizeRole } from "../../middleware/auth.js";

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
