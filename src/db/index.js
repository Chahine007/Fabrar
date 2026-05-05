import './shared.js';

export { initDb, getDb } from './client.js';
export { parseDateOnly, formatDateOnly } from './date.js';

export {
  findEmployeeByTelegramId,
  createEmployee,
  updateEmployee,
  listEmployees,
  employeeHasTariffa,
  listEmployeesWithPendingDrafts,
  getEmployeesWithoutReport,
  createTariffa,
} from './employees.js';

export {
  findReportForDate,
  findReportForToday,
  upsertReport,
  insertMessageLog,
  getAuditLogs,
  listReports,
  listReportsWithEntries,
  ensureDailyReportHeader,
  updateReportCantiere,
  createReportEntry,
  upsertReportEntry,
  getReportEntryById,
  listReportEntriesByReportId,
  listReportEntriesByEmployeeAndDate,
  updateReportEntry,
  deleteReportEntry,
  deleteReportEntriesByReportId,
  getReportById,
  updateReportHeader,
} from './reports.js';

export {
  insertSpesa,
  getSpesaById,
  updateSpesa,
  deleteSpesaById,
} from './expenses.js';

export {
  cantiereExists,
  getCantieriAttivi,
  getCantieriStatus,
  getAllCantieri,
  createCantiere,
  toggleCantiere,
  getCantieriConCoordinate,
  updateCantiere,
} from './cantieri.js';

export {
  findUserByUsername,
  findUserById,
  findUserByEmployeeId,
  listUsers,
  createUser,
  updateUser,
  updateUserLastLogin,
  deactivateUser,
  deleteUserById,
} from './users.js';

export {
  getPricebookById,
  listPricebook,
  createPricebookItem,
  updatePricebookItem,
  deletePricebookItem,
} from './pricebook.js';

export {
  getWbsNodesByCantiere,
  createWbsNode,
  updateWbsNode,
  deleteWbsNode,
  getWbsBurnData,
  getWbsFasiAttive,
} from './wbs.js';
