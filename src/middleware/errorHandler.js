import logger from "../logger.js";

export const errorHandler = (err, req, res, next) => {
    // DomainError → 422 Unprocessable Entity con codice machine-readable
    if (err.name === "DomainError") {
        logger.warn({ code: err.code, message: err.message, path: req.path }, "domain_error");
        return res.status(422).json({ error: err.message, code: err.code });
    }

    logger.error({ err, path: req.path, method: req.method }, "Errore non gestito intercettato dal middleware globale");

    const statusCode = err.status || err.statusCode || 500;
    const message    = err.message || "Si è verificato un errore imprevisto sul server.";

    res.status(statusCode).json({
        error: statusCode === 500 && process.env.NODE_ENV === "production"
            ? "Si è verificato un errore interno del server."
            : message,
    });
};