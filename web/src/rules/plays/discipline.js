/**
 * Sanciones, tiempos y capitanía en juego.
 * @module src/rules/plays/discipline.js
 */

import { PHASE, SIDES, STAFF_TITLES, rival, isSide } from "../constants.js"
import { isShirt } from "../shirts.js"
import { deny } from "../violation.js"
import { TEXT } from "../messages.js"
import { awardRally } from "./rally.js"

/** Fases en las que se aceptan sanciones: preparación, set en juego y entre sets. */
const SANCTION_PHASES = Object.freeze([PHASE.live, PHASE.break, PHASE.setup])

/** Niveles que dan punto y saque al rival (FIVB 16.2 y 21.3.1.2). */
const POINT_LEVELS = Object.freeze(["penalty", "delayPenalty"])

/**
 * Sanción de conducta o de demora (FIVB 16 y 21). El destinatario es un dorsal, un rol del
 * cuerpo técnico o "team". Cada equipo tiene una sola amonestación por conducta en el partido
 * y solo la gasta otra amonestación: tras una expulsión o un castigo se puede amonestar a otro
 * miembro (Casebook FIVB, caso 6.07). Con la demora pasa lo mismo, y su castigo exige la
 * amonestación previa. Un castigo fuera del set en juego espera al inicio del siguiente set.
 * La expulsión saca al jugador del set y la descalificación del partido; si estaba en pista
 * hay que sustituirlo para poder seguir, salvo que fuera el líbero, que sale sin más.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, target, level}
 * @param {string|null} at marca de tiempo ISO
 */
export function sanction(match, play, at) {
    const period = match.current
    if (!SANCTION_PHASES.includes(match.phase)) {
        deny(TEXT.matchOver)
    }
    const { side, target, level } = play
    const onPlayer = isShirt(target)
    if (onPlayer && !match.teams[side].find(target)) {
        deny(TEXT.notListed(target))
    }
    if (!onPlayer && target !== "team" && !STAFF_TITLES[target]) {
        deny(TEXT.whoIsSanctioned)
    }
    if (level === "warning" && match.warned[side]) {
        deny(TEXT.warningUsed)
    }
    if (level === "delayWarning" && match.delayWarned[side]) {
        deny(TEXT.delayWarningUsed)
    }
    if (level === "delayPenalty" && !match.delayWarned[side]) {
        deny(TEXT.firstDelayIsWarning)
    }
    match.sanctions.push({
        side,
        target,
        level,
        period: period.number,
        ...period.scoreFor(side),
        at,
    })
    if (level === "warning") {
        match.warned[side] = true
    }
    if (level === "delayWarning") {
        match.delayWarned[side] = true
    }
    if (POINT_LEVELS.includes(level)) {
        givePenaltyPoint(match, rival(side), level, at)
    }
    if (onPlayer && (level === "expulsion" || level === "disqualification")) {
        sendOff(match, period, side, target, level, at)
    }
}

/**
 * Punto de castigo para el rival: inmediato con el set en juego, o pendiente hasta el inicio
 * del siguiente set.
 * @param {Match} match partido
 * @param {"home"|"away"} receiver lado que recibe el punto
 * @param {string} level nivel de la sanción, que pasa a ser la causa del punto
 * @param {string|null} at marca de tiempo ISO
 */
function givePenaltyPoint(match, receiver, level, at) {
    if (match.phase === PHASE.live) {
        awardRally(match, receiver, level, at)
        return
    }
    match.pendingPenalties.push({ side: receiver, level })
}

/**
 * Aparta a un jugador expulsado o descalificado. El líbero en pista sale y vuelve su jugador,
 * sin contar como reemplazo para la jugada completada; un jugador en pista queda pendiente de
 * sustitución.
 * @param {Match} match partido
 * @param {Period} period periodo actual
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal sancionado
 * @param {string} level expulsion o disqualification
 * @param {string|null} at marca de tiempo ISO
 */
function sendOff(match, period, side, shirt, level, at) {
    if (level === "expulsion") {
        period.expelled[side].add(shirt)
    } else {
        match.disqualified[side].add(shirt)
    }
    const playing = period.rotation[side]?.includes(shirt)
    const libero = period.libero[side]
    if (libero?.shirt === shirt) {
        period.liberoSwaps[side].push({
            entering: libero.replacing,
            leaving: shirt,
            ...period.scoreFor(side),
            at,
        })
        period.libero[side] = null
        return
    }
    if (playing) {
        period.mustReplace[side].push(shirt)
    }
}

/**
 * Petición improcedente (FIVB 16.1): se cuenta y queda en la lista de sanciones a nombre del
 * equipo. No depende de la fase.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side}
 * @param {string|null} at marca de tiempo ISO
 */
export function improper(match, play, at) {
    const period = match.current
    const side = play.side
    match.improperCount[side]++
    match.sanctions.push({
        side,
        target: "team",
        level: "improper",
        period: period.number,
        ...period.scoreFor(side),
        at,
    })
}

/**
 * Tiempo de descanso (FIVB 15.4), con el tope por set de los ajustes.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side}
 * @param {string|null} at marca de tiempo ISO
 * @throws {TypeError} si el lado no es home ni away
 */
export function timeout(match, play, at) {
    const period = match.current
    if (match.phase !== PHASE.live) {
        deny(TEXT.timeoutNeedsLive)
    }
    const side = play.side
    if (!isSide(side)) {
        throw new TypeError("lado desconocido")
    }
    const taken = period.timeouts[side]
    const limit = match.settings.timeouts
    if (taken.length >= limit) {
        deny(TEXT.timeoutsUsed(limit))
    }
    taken.push({ ...period.scoreFor(side), at })
}

/**
 * Designa capitán en juego cuando el capitán del equipo no está en pista (FIVB 5.1.2): tiene
 * que ser alguien que sí esté en pista, líbero incluido.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, shirt}
 * @param {string|null} at marca de tiempo ISO
 */
export function actingCaptain(match, play, at) {
    const period = match.current
    if (match.phase !== PHASE.live) {
        deny(TEXT.captainNeedsLive)
    }
    const side = play.side
    const captain = match.teams[side].captain()
    if (!captain) {
        deny(TEXT.noCaptain)
    }
    const visible = period.visible(side)
    if (visible.includes(captain.shirt)) {
        deny(TEXT.captainOnCourt(captain.shirt))
    }
    if (!visible.includes(play.shirt)) {
        deny(TEXT.notOnCourt(play.shirt))
    }
    period.actingCaptain[side] = play.shirt
    match.actingCaptains.push({
        side,
        shirt: play.shirt,
        period: period.number,
        ...period.scoreFor(side),
        at,
    })
}

/**
 * Borra la marca de capitán en juego cuando deja de tener sentido: el capitán ha vuelto a la
 * pista o el marcado ha salido de ella. Solo actúa con el set empezado.
 * @param {Match} match partido que se modifica
 */
export function refreshActingCaptain(match) {
    const period = match.current
    if (!period.startedAt) {
        return
    }
    for (const side of SIDES) {
        const visible = period.visible(side)
        const captain = match.teams[side].captain()
        const marked = period.actingCaptain[side]
        const captainBack = captain && visible.includes(captain.shirt)
        if (captainBack || (marked && !visible.includes(marked))) {
            period.actingCaptain[side] = null
        }
    }
}

/**
 * Indica si hay que preguntar quién es el capitán en juego: set en juego, el equipo tiene
 * capitán, no es líbero, no está en pista y nadie lleva la marca.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @returns {boolean}
 */
export function captainMissing(match, side) {
    const period = match.current
    const captain = match.teams[side].captain()
    if (match.phase !== PHASE.live || !captain || captain.libero) {
        return false
    }
    if (period.visible(side).includes(captain.shirt)) {
        return false
    }
    return !period.actingCaptain[side]
}
