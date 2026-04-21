import logger from "../logger.js";

export const errorHandler = (err, req, res, next) => {
    // Logga l'errore per il debug interno
    logger.error({
        err,
        path: req.path,
        method: req.method
    }, "Errore non gestito intercettato dal middleware globale");

    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || "Si è verificato un errore imprevisto sul server.";

    res.status(statusCode).json({
        error: statusCode === 500 && process.env.NODE_ENV === "production"
            ? "Si è verificato un errore interno del server." // Non esponiamo info tecniche in produzione
            : message,
    });
};