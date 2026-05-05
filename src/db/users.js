import { getDb } from './client.js';
import { normalizeUserRole } from './shared.js';

export async function findUserByUsername(username) {
  return getDb().user.findUnique({ where: { username } });
}

export async function findUserById(id) {
  return getDb().user.findUnique({ where: { id } });
}

export async function findUserByEmployeeId(employeeId) {
  const employee = await getDb().employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });

  return employee?.user ?? null;
}

export async function listUsers() {
  const users = await getDb().user.findMany({
    include: { employee: true },
    orderBy: { username: 'asc' },
  });

  return users.map((user) => ({
    ...user,
    nome: user.employee?.nome,
    cognome: user.employee?.cognome,
  }));
}

export async function createUser({ username, password_hash, email, google_id, role, is_active = 1 }) {
  return getDb().user.create({
    data: {
      username,
      password_hash,
      email,
      google_id,
      role: normalizeUserRole(role, "WORKER"),
      is_active,
    },
  });
}

export async function updateUser(id, fields) {
  const allowed = ["username", "password_hash", "email", "google_id", "role", "is_active"];
  const data = {};

  for (const key of allowed) {
    if (fields[key] !== undefined) data[key] = fields[key];
  }

  if (data.role !== undefined) {
    data.role = normalizeUserRole(data.role, "WORKER");
  }

  if (Object.keys(data).length > 0) {
    await getDb().user.update({ where: { id }, data });
  }
}

export async function updateUserLastLogin(id) {
  await getDb().user.update({
    where: { id },
    data: { last_login_at: new Date() },
  });
}

export async function deactivateUser(id) {
  await getDb().user.update({
    where: { id },
    data: { is_active: 0 },
  });
}

export async function deleteUserById(id) {
  await getDb().user.delete({ where: { id } });
}
