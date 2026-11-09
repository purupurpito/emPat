/**
 * Fachada pública del motor de reglas. Reúne lo que necesitan la interfaz, el acta impresa y
 * las pruebas, y añade las operaciones que reconstruyen un partido a partir de su lista de
 * jugadas. No toca el DOM ni el almacenamiento: funciona igual en el navegador y en Node.
 * @module src/rules/index.js
 */

import { Match } from "./match.js"
import { RuleViolation } from "./violation.js"
import { captainMissing } from "./plays/discipline.js"

export {
    DEFAULT_SETTINGS,
    CATEGORY_NAMES,
    STAFF_TITLES,
    SIDES,
    PHASE,
    rival,
    isSide,
} from "./constants.js"
export { normalizeShirt, isValidShirt, isShirt } from "./shirts.js"
export { RuleViolation }
export { Match }
export { summarize, fullSetReport, minutesBetween } from "./reports.js"
export { substitutionBlocker } from "./plays/changes.js"

/**
 * Reconstruye el partido aplicando todas las jugadas desde un estado vacío. El estado nunca se
 * guarda: siempre se deriva de la lista, así deshacer es quitar la última.
 * @param {object} settings ajustes del motor
 * @param {object} info datos del encuentro
 * @param {object[]} plays jugadas en orden
 * @returns {Match} partido resultante
 */
export function replay(settings, info, plays) {
    const match = new Match(settings, info)
    for (const play of plays || []) {
        match.apply(play)
    }
    return match
}

/**
 * Recorre las jugadas como replay, pero llama a visit tras cada una. Si visit devuelve true se
 * corta el recorrido. El partido que recibe visit es el objeto vivo: se lee y se copia lo
 * necesario, nunca se guarda la referencia.
 * @param {object} settings ajustes del motor
 * @param {object} info datos del encuentro
 * @param {object[]} plays jugadas en orden
 * @param {(match: Match, index: number) => boolean|void} visit observador de cada paso
 * @returns {Match} partido en el punto en que se cortó o al final
 */
export function walk(settings, info, plays, visit) {
    const match = new Match(settings, info)
    let index = 0
    for (const play of plays || []) {
        match.apply(play)
        if (visit(match, index) === true) {
            break
        }
        index += 1
    }
    return match
}

/**
 * Comprueba si una jugada sería legal sin aplicarla de verdad. Solo convierte en texto las
 * infracciones de reglamento (RuleViolation); cualquier otro error sube tal cual para que un
 * fallo de programación no se disfrace de regla.
 * @param {object} settings ajustes del motor
 * @param {object} info datos del encuentro
 * @param {object[]} plays jugadas ya aceptadas
 * @param {object} candidate jugada a validar
 * @returns {string|null} motivo del rechazo o null si es legal
 */
export function check(settings, info, plays, candidate) {
    try {
        const match = replay(settings, info, plays)
        match.apply(candidate)
    } catch (error) {
        if (error instanceof RuleViolation) {
            return error.message
        }
        throw error
    }
    return null
}

/**
 * Devuelve el último periodo del partido, que es el que está en juego o el que espera a
 * empezar.
 * @param {Match} match partido
 * @returns {Period} periodo actual
 */
export function currentPeriod(match) {
    return match.current
}

/**
 * Lista los seis dorsales en pista de un lado, con el líbero colocado en la zona que ocupa. La
 * rotación interna no lo incluye; esta vista sí, porque es lo que se ve.
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @returns {string[]} seis dorsales, de la zona I a la VI
 */
export function onCourt(period, side) {
    return period.visible(side)
}

/**
 * Indica si hay que designar capitán en juego: partido en juego, equipo con capitán que no es
 * líbero, que no está en pista y sin nadie marcado (FIVB 5.1.2).
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @returns {boolean}
 */
export function needsActingCaptain(match, side) {
    return captainMissing(match, side)
}
