/**
 * Descripción legible de una jugada para el registro y las confirmaciones.
 * @module src/app/describe.js
 */

import { isShirt, rival, STAFF_TITLES } from "../rules/index.js"
import { PLAY_PHRASES, SANCTION_LABELS } from "./constants.js"

/**
 * Nombre de un lado tal como está en los datos. Sin nombre se queda en undefined dentro de la
 * frase, igual que en el resto de textos que usan el nombre crudo.
 * @param {object} info datos del encuentro
 * @param {string} side lado
 * @returns {string|undefined}
 */
function sideName(info, side) {
    if (side === "home") {
        return info.homeName
    }
    return info.awayName
}

/**
 * Complemento "al …" de una sanción según a quién va dirigida.
 * @param {unknown} target dorsal, rol del cuerpo técnico o "team"
 * @returns {string}
 */
function sanctionTarget(target) {
    if (isShirt(target)) {
        return PLAY_PHRASES.sanctionShirt(target)
    }
    if (target === "team") {
        return PLAY_PHRASES.sanctionTeam
    }
    return PLAY_PHRASES.sanctionStaff(STAFF_TITLES[target])
}

/**
 * Paréntesis con la causa de un punto que no sale de un rally normal. Una causa sin nombre
 * conocido se muestra tal cual.
 * @param {unknown} cause causa guardada en la jugada
 * @returns {string} cadena vacía si no hay causa que mostrar
 */
function causeText(cause) {
    if (!cause || cause === "play") {
        return ""
    }
    return PLAY_PHRASES.causes[cause] || cause
}

/**
 * Frase corta que resume una jugada. Del partido solo lee los nombres, así que sirve igual con
 * la jugada aplicada o deshecha. Un tipo desconocido se describe con su nombre.
 * @param {object} play jugada
 * @param {Match} match partido de referencia (de él salen los nombres)
 * @returns {string}
 */
export function describePlay(play, match) {
    const info = match.info
    const team = sideName(info, play.side)
    const phrases = PLAY_PHRASES
    switch (play.kind) {
        case "rally":
            return phrases.rally(team, causeText(play.cause))
        case "timeout":
            return phrases.timeout(team)
        case "substitution":
            return phrases.substitution(team, play)
        case "liberoIn":
            return phrases.liberoIn(team, play)
        case "liberoOut":
            return phrases.liberoOut(team)
        case "sanction": {
            const label = SANCTION_LABELS[play.level]
            return phrases.sanction(label, sanctionTarget(play.target), team)
        }
        case "improper":
            return phrases.improper(team)
        case "startPeriod":
            return phrases.startPeriod
        case "toss":
            return phrases.toss
        case "lineup":
            return phrases.lineup(team)
        case "note":
            return phrases.note
        case "sign":
            return phrases.sign
        case "openGolden":
            return phrases.openGolden
        case "actingCaptain":
            return phrases.actingCaptain(team, play)
        case "replayRally":
            return phrases.replayRally
        case "rotationFault": {
            const other = sideName(info, rival(play.side))
            return phrases.rotationFault(team, other, play.rollbackTo)
        }
        case "forfeit":
            if (play.reason === "noShow") {
                return phrases.noShow(team)
            }
            return phrases.shortHanded(team)
        case "liberoUnfit":
            return phrases.liberoUnfit(team, play)
        case "fullSetMark":
            return phrases.fullSetMark(team, play)
        case "roster":
            return phrases.roster(team)
        default:
            return play.kind
    }
}
