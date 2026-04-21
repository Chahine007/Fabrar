/**
 * Middleware di validazione generico basato su Zod.
 * Valida params, query e body della richiesta rispetto allo schema fornito.
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        const validated = await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Aggiorna req con i dati validati e trasformati (coercizione tipi)
        req.body = validated.body;
        req.query = validated.query;
        req.params = validated.params;

        next();
    } catch (error) {
        if (error.name === "ZodError") {
            const details = error.errors.map((e) => ({
                path: e.path.join("."),
                message: e.message,
            }));
            return res.status(400).json({
                error: "Dati non validi.",
                details,
            });
        }
        next(error);
    }
};
