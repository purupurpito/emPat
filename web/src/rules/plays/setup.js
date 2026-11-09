/**
 * Jugadas de preparación: inscripción, sorteo, alineación, inicio de set, desempate y marcas de
 * set completo.
 * @module src/rules/plays/setup.js
 */

import { CATEGORY_NAMES, PHASE, SIDES } from "../constants.js"
import { isValidShirt, normalizeShirt } from "../shirts.js"
import { deny } from "../violation.js"
import { TEXT } from "../messages.js"
import { Team } from "../team.js"
import { Period } from "../period.js"
import { awardRally } from "./rally.js"

/** Jugadores en el acta cuando el formato tiene líbero y cuando no (circulares federativas). */
const ROSTER_CAP = Object.freeze({ withLibero: 14, withoutLibero: 12 })

/** Oficiales permitidos además del primer entrenador (FIVB 4.1.1 y normas federativas). */
const EXTRA_STAFF = 3

/**
 * Inscribe o sustituye la plantilla de un lado (FIVB 4.1). Solo en preparación. Las
 * comprobaciones van en este orden: dorsales válidos, sin repetir, un capitán, categorías,
 * dos líberos, tope de jugadores, tope de oficiales y líbero desactivado. El líbero puede ser
 * capitán (FIVB 5.1).
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, name, players, staff}
 */
export function roster(match, play) {
    if (match.phase !== PHASE.setup) {
        deny(TEXT.rosterClosed)
    }
    const players = play.players
    const invalid = players.find((player) => !isValidShirt(player.shirt))
    if (invalid) {
        deny(TEXT.badShirt(invalid.shirt, invalid.name))
    }
    const shirts = players.map((player) => normalizeShirt(player.shirt))
    if (new Set(shirts).size !== shirts.length) {
        deny(TEXT.repeatedShirts)
    }
    if (players.filter((player) => player.captain).length > 1) {
        deny(TEXT.oneCaptain)
    }
    // Letra de categoría inferior junto al nombre: Y, J, C, I o A.
    const miscategorised = players.find((player) => hasUnknownCategory(player))
    if (miscategorised) {
        deny(TEXT.badCategory(miscategorised.shirt))
    }
    if (players.filter((player) => player.libero).length > 2) {
        deny(TEXT.twoLiberos)
    }
    const settings = match.settings
    const cap = rosterCap(settings)
    if (players.length > cap) {
        deny(TEXT.rosterTooLong(cap, settings.liberoAllowed))
    }
    const staff = play.staff || []
    if (staff.filter((member) => member.role !== "coach" && member.name).length > EXTRA_STAFF) {
        deny(TEXT.staffTooLong)
    }
    if (!settings.liberoAllowed && players.some((player) => player.libero)) {
        deny(TEXT.liberoDisabled)
    }
    let previousName = null
    if (!play.name) {
        previousName = match.teams[play.side].name
    }
    match.teams[play.side] = Team.fromPlay(play, previousName)
}

/**
 * Indica si un jugador trae una letra de categoría que no existe.
 * @param {object} player jugador de la plantilla
 * @returns {boolean}
 */
function hasUnknownCategory(player) {
    if (!player.category) {
        return false
    }
    return !CATEGORY_NAMES[player.category]
}

/**
 * Tope de jugadores en el acta: el del ajuste rosterLimit si lo hay, si no según el líbero.
 * @param {object} settings ajustes del partido
 * @returns {number}
 */
function rosterCap(settings) {
    if (settings.rosterLimit) {
        return settings.rosterLimit
    }
    if (settings.liberoAllowed) {
        return ROSTER_CAP.withLibero
    }
    return ROSTER_CAP.withoutLibero
}

/**
 * Registra el sorteo: quién saca y quién queda a la izquierda (FIVB 7.1). Solo hay sorteo para
 * el primer set, para el decisivo y para el desempate.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {server, left}
 * @param {string|null} at marca de tiempo ISO
 */
export function toss(match, play, at) {
    const period = match.current
    const waiting = match.phase === PHASE.setup || match.phase === PHASE.break
    if (!waiting || period.startedAt) {
        deny(TEXT.tossTooLate)
    }
    if (match.phase === PHASE.break && !period.decider) {
        deny(TEXT.tossOnlyDecider)
    }
    period.firstServer = play.server
    period.leftSide = play.left
    match.tosses.push({ period: period.number, server: play.server, left: play.left, at })
}

/**
 * Fija los seis titulares de un lado para el set, de la zona I a la VI (FIVB 7.3). En preparación
 * exige que los dos equipos tengan al menos seis jugadores que no sean líberos.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, shirts}
 */
export function lineup(match, play) {
    const period = match.current
    if (period.startedAt) {
        deny(TEXT.periodStarted)
    }
    if (match.phase === PHASE.setup) {
        for (const side of SIDES) {
            const fielders = match.teams[side].players.filter((player) => !player.libero)
            if (fielders.length < 6) {
                deny(TEXT.needSixPlayers)
            }
        }
    }
    const shirts = play.shirts
    if (!Array.isArray(shirts) || shirts.length !== 6) {
        deny(TEXT.lineupSize)
    }
    if (new Set(shirts).size !== 6) {
        deny(TEXT.lineupRepeats)
    }
    const side = play.side
    for (const shirt of shirts) {
        const player = match.teams[side].find(shirt)
        if (!player) {
            deny(TEXT.notListed(shirt))
        }
        if (player.libero) {
            deny(TEXT.liberoStarter(shirt))
        }
        if (match.disqualified[side].has(shirt) || match.outForMatch[side].has(shirt)) {
            deny(TEXT.cannotPlay(shirt))
        }
    }
    period.lineup[side] = [...shirts]
    period.rotation[side] = [...shirts]
}

/**
 * Pone en juego el set preparado: abre el primer turno de saque y aplica, uno a uno, los
 * castigos que quedaron pendientes entre sets (FIVB 16.2). Si un castigo cierra el set, los
 * siguientes se descartan.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada
 * @param {string|null} at marca de tiempo ISO
 */
export function startPeriod(match, play, at) {
    const period = match.current
    if (match.phase !== PHASE.setup && match.phase !== PHASE.break) {
        deny(TEXT.alreadyLive)
    }
    if (!period.lineup.home || !period.lineup.away) {
        deny(TEXT.missingLineups)
    }
    if (!period.firstServer || !period.leftSide) {
        deny(missingTossText(period))
    }
    period.startedAt = at
    if (!match.startedAt) {
        match.startedAt = at
    }
    period.serving = period.firstServer
    period.openTurn(period.serving)
    match.phase = PHASE.live
    for (const pending of match.pendingPenalties.splice(0)) {
        if (match.phase === PHASE.live) {
            awardRally(match, pending.side, pending.level, at)
        }
    }
}

/**
 * Mensaje cuando falta el saque inicial: el primer set y el decisivo necesitan sorteo; los
 * demás solo saber quién saca.
 * @param {Period} period periodo que se quiere empezar
 * @returns {string}
 */
function missingTossText(period) {
    if (period.number === 1 || period.decider) {
        return TEXT.missingToss
    }
    return TEXT.missingServer
}

/**
 * Abre el set de desempate tras un partido terminado: decisivo, con sorteo propio y sin contar
 * en los sets ganados. No cabe si el partido acabó por incomparecencia o equipo incompleto.
 * @param {Match} match partido que se modifica
 */
export function openGolden(match) {
    if (match.phase !== PHASE.over || match.forfeit) {
        deny(TEXT.goldenNotYet)
    }
    if (match.golden) {
        deny(TEXT.goldenPlayed)
    }
    const golden = new Period(match.current.number + 1, true)
    golden.isGolden = true
    match.periods.push(golden)
    match.golden = { period: golden.number, winner: null }
    match.phase = PHASE.break
    match.endedAt = null
}

/**
 * Corrige a mano si un jugador cumple el set completo en un periodo ya empezado. La marca
 * manual manda sobre el cálculo automático.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, shirt, period, value}
 */
export function fullSetMark(match, play) {
    const period = match.periods.find((candidate) => candidate.number === play.period)
    if (!period || !period.startedAt) {
        deny(TEXT.periodNotPlayed)
    }
    if (!match.teams[play.side].find(play.shirt)) {
        deny(TEXT.notListed(play.shirt))
    }
    const marks = match.fullSetMarks[play.side]
    marks[play.shirt] ??= {}
    marks[play.shirt][play.period] = Boolean(play.value)
}
