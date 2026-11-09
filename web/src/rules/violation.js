/**
 * Error de reglamento. Separa las jugadas ilegales, cuyo texto se enseña al anotador, de los
 * fallos de programación, que no deben confundirse con una regla.
 * @module src/rules/violation.js
 */

/**
 * Jugada rechazada por el reglamento. El mensaje es el texto visible en castellano y llega a la
 * interfaz sin retoques.
 */
export class RuleViolation extends Error {
    /**
     * Crea la infracción con su texto.
     * @param {string} text motivo visible
     */
    constructor(text) {
        super(text)
        this.name = "RuleViolation"
    }
}

/**
 * Corta la jugada en curso lanzando una RuleViolation. Existe para que cada comprobación quede
 * en una sola línea legible; nunca devuelve.
 * @param {string} text motivo visible
 * @returns {never}
 */
export function deny(text) {
    throw new RuleViolation(text)
}
