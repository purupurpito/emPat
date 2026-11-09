/**
 * Constructores cortos de jugadas para que las pruebas se lean como un acta: rally("home") en
 * lugar del objeto completo. No validan nada; solo dan la forma del contrato.
 * @module tests/support/plays.mjs
 */

/**
 * Tanto para un lado.
 * @param {string} side lado
 * @returns {object}
 */
export function rally(side) {
    return { kind: "rally", side }
}

/**
 * Tiempo de descanso.
 * @param {string} side lado
 * @returns {object}
 */
export function timeout(side) {
    return { kind: "timeout", side }
}

/**
 * Sustitución, regular salvo que se pida excepcional.
 * @param {string} side lado
 * @param {unknown} leaving sale
 * @param {unknown} entering entra
 * @param {boolean} [exceptional] si es excepcional
 * @returns {object}
 */
export function substitution(side, leaving, entering, exceptional = false) {
    const play = { kind: "substitution", side, leaving, entering }
    if (exceptional) {
        play.exceptional = true
    }
    return play
}

/**
 * Entrada del líbero por un jugador o por el otro líbero.
 * @param {string} side lado
 * @param {unknown} libero líbero que entra
 * @param {unknown} leaving quien sale
 * @returns {object}
 */
export function liberoIn(side, libero, leaving) {
    return { kind: "liberoIn", side, libero, leaving }
}

/**
 * Salida del líbero.
 * @param {string} side lado
 * @returns {object}
 */
export function liberoOut(side) {
    return { kind: "liberoOut", side }
}

/**
 * Líbero que no puede seguir, con redesignación opcional.
 * @param {string} side lado
 * @param {unknown} libero líbero impedido
 * @param {unknown} [successor] jugador redesignado
 * @returns {object}
 */
export function liberoUnfit(side, libero, successor) {
    const play = { kind: "liberoUnfit", side, libero }
    if (successor !== undefined) {
        play.successor = successor
    }
    return play
}

/**
 * Sanción.
 * @param {string} side lado sancionado
 * @param {unknown} target dorsal, rol o "team"
 * @param {string} level nivel
 * @returns {object}
 */
export function sanction(side, target, level) {
    return { kind: "sanction", side, target, level }
}

/**
 * Designación de capitán en juego.
 * @param {string} side lado
 * @param {unknown} shirt dorsal
 * @returns {object}
 */
export function actingCaptain(side, shirt) {
    return { kind: "actingCaptain", side, shirt }
}

/**
 * Formación inicial.
 * @param {string} side lado
 * @param {unknown[]} shirts dorsales de las zonas I a VI
 * @returns {object}
 */
export function lineup(side, shirts) {
    return { kind: "lineup", side, shirts }
}

/**
 * Falta de rotación, con el marcador del infractor en el momento de la falta si se conoce.
 * @param {string} side lado infractor
 * @param {unknown} [rollbackTo] marcador del infractor al cometerla
 * @returns {object}
 */
export function rotationFault(side, rollbackTo) {
    const play = { kind: "rotationFault", side }
    if (rollbackTo !== undefined) {
        play.rollbackTo = rollbackTo
    }
    return play
}

/**
 * Equipo incompleto o que no se presenta.
 * @param {string} side lado que pierde
 * @param {string} [reason] motivo
 * @returns {object}
 */
export function forfeit(side, reason) {
    const play = { kind: "forfeit", side }
    if (reason !== undefined) {
        play.reason = reason
    }
    return play
}

/**
 * Marca a mano del set completo de un jugador.
 * @param {string} side lado
 * @param {unknown} shirt dorsal
 * @param {number} period set
 * @param {boolean} value si lo completó
 * @returns {object}
 */
export function fullSetMark(side, shirt, period, value) {
    return { kind: "fullSetMark", side, shirt, period, value }
}
