/**
 * DomainError — errore lanciato dal layer di dominio.
 * Il middleware errorHandler.js lo intercetta e lo mappa a HTTP 422.
 */
export class DomainError extends Error {
    constructor(message, code = 'DOMAIN_ERROR') {
        super(message);
        this.name = 'DomainError';
        this.code = code;
    }
}
