/**
 * Inviluppa le funzioni asincrone dei controller per passare automaticamente
 * gli errori al middleware globale (evitando i try/catch sparsi).
 */
export const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);