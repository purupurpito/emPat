/**
 * Jugadas que mueven el marcador o el turno de juego, y los dos pasos internos que comparten:
 * sumar un punto y cerrar un set.
 * @module src/rules/plays/rally.js
 */

import { PHASE, rival, isSide } from "../constants.js"
import { deny } from "../violation.js"
import { TEXT } from "../messages.js"
import { Period } from "../period.js"

/**
 * Punto para un lado tras una jugada. Sin causa explícita cuenta como jugada normal.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, cause?}
 * @param {string|null} at marca de tiempo ISO
 */
export function rally(match, play, at) {
    if (!isSide(play.side)) {
        deny(TEXT.whichTeamScores)
    }
    awardRally(match, play.side, play.cause || "play", at)
}

/**
 * Jugada repetida (doble falta, interferencia externa): no suma punto, solo se apunta con el
 * marcador del momento.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada
 * @param {string|null} at marca de tiempo ISO
 */
export function replayRally(match, play, at) {
    if (match.phase !== PHASE.live) {
        deny(TEXT.replayNeedsLive)
    }
    const period = match.current
    period.replays.push({ home: period.score.home, away: period.score.away, at })
}

/**
 * Falta de rotación o sacador incorrecto (FIVB 7.7): punto y saque para el rival. Si se sabe
 * cuántos puntos tenía el infractor al cometerla (rollbackTo), se anulan los que ganó después
 * (FIVB 7.7.2); los del rival se quedan. La anulación no corrige turnos ni jugadas contadas.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, rollbackTo?}
 * @param {string|null} at marca de tiempo ISO
 */
export function rotationFault(match, play, at) {
    if (match.phase !== PHASE.live) {
        deny(TEXT.noteNeedsLive)
    }
    const side = play.side
    if (!isSide(side)) {
        deny(TEXT.whichTeamFaulted)
    }
    const period = match.current
    let voided = 0
    if (hasRollback(play.rollbackTo)) {
        voided = rollBack(period, side, play.rollbackTo)
    }
    match.rotationFaults.push({
        side,
        period: period.number,
        own: period.score[side],
        rival: period.score[rival(side)],
        voided,
        at,
    })
    awardRally(match, rival(side), "rotationFault", at)
}

/**
 * Indica si la falta trae el marcador del momento en que se cometió.
 * @param {unknown} value campo rollbackTo
 * @returns {boolean}
 */
function hasRollback(value) {
    return value !== null && value !== undefined && value !== ""
}

/**
 * Devuelve el marcador del infractor al momento de la falta y marca como anulados sus puntos
 * posteriores en el registro.
 * @param {Period} period periodo en juego
 * @param {"home"|"away"} side infractor
 * @param {unknown} value puntos que tenía al cometer la falta
 * @returns {number} puntos anulados
 */
function rollBack(period, side, value) {
    const keep = +value
    const reached = period.score[side]
    if (!Number.isInteger(keep) || keep < 0 || keep > reached) {
        deny(TEXT.badRollback(reached))
    }
    let seen = 0
    for (const entry of period.rallyLog) {
        if (entry.side !== side) {
            continue
        }
        seen += 1
        if (seen > keep) {
            entry.voided = true
        }
    }
    period.score[side] = keep
    return reached - keep
}

/**
 * Equipo incompleto o no presentado (FIVB 6.4): el rival gana todo lo que falta. Se empiezan
 * los sets pendientes y se llenan de puntos sin rotar, sin turnos y sin contar jugadas; los
 * castigos pendientes y las sustituciones obligadas dejan de tener sentido.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, reason}
 * @param {string|null} at marca de tiempo ISO
 */
export function forfeit(match, play, at) {
    const side = play.side
    if (!isSide(side)) {
        deny(TEXT.whichTeam)
    }
    if (match.phase === PHASE.over) {
        deny(TEXT.matchOver)
    }
    const winner = rival(side)
    const current = match.current
    let reason = "shortHanded"
    if (play.reason === "noShow") {
        reason = "noShow"
    }
    match.forfeit = {
        side,
        reason,
        period: current.number,
        home: current.score.home,
        away: current.score.away,
        at,
    }
    match.pendingPenalties = []
    while (match.phase !== PHASE.over) {
        fillPeriod(match, match.current, side, winner, at)
    }
}

/**
 * Da por jugado un set entero a favor de winner.
 * @param {Match} match partido
 * @param {Period} period set que se completa
 * @param {"home"|"away"} loser equipo que no puede seguir
 * @param {"home"|"away"} winner rival que se lleva el set
 * @param {string|null} at marca de tiempo ISO
 */
function fillPeriod(match, period, loser, winner, at) {
    if (!period.startedAt) {
        period.startedAt = at
        if (!match.startedAt) {
            match.startedAt = at
        }
        if (!period.firstServer) {
            period.firstServer = winner
        }
        if (!period.leftSide) {
            period.leftSide = "home"
        }
        period.serving = winner
    }
    match.phase = PHASE.live
    period.mustReplace = { home: [], away: [] }
    const goal = Math.max(match.targetOf(period), period.score[loser] + 2)
    while (period.score[winner] < goal) {
        period.score[winner] += 1
        period.rallyLog.push({
            side: winner,
            home: period.score.home,
            away: period.score.away,
            cause: "forfeit",
            at,
        })
    }
    // Aquí el cambio de campo se comprueba con >= y no deja rastro en automatic, porque los
    // puntos llegan de golpe y nadie cambia de campo de verdad.
    if (period.decider && !period.switched) {
        if (period.score[winner] >= match.settings.deciderSwitch) {
            period.switched = true
            period.leftSide = rival(period.leftSide)
        }
    }
    closePeriod(match, at)
}

/**
 * Suma un punto con todos sus efectos, en este orden: marcador y jugada contada (un castigo o
 * una falta también completan jugada, FIVB 6.1.3), registro, cambio de saque con rotación si
 * ganó quien recibía (FIVB 7.6.1), cambio de campo del decisivo (FIVB 18.2.2) y cierre de set
 * (FIVB 6.1.2).
 * @param {Match} match partido que se modifica
 * @param {"home"|"away"} side quién gana
 * @param {string} cause causa del punto
 * @param {string|null} at marca de tiempo ISO
 */
export function awardRally(match, side, cause, at) {
    const period = match.current
    if (match.phase !== PHASE.live) {
        deny(TEXT.notLive)
    }
    if (period.mustReplace.home.length || period.mustReplace.away.length) {
        deny(TEXT.replaceSanctionedFirst)
    }
    period.score[side] += 1
    period.rallyCount += 1
    period.rallyLog.push({ side, home: period.score.home, away: period.score.away, cause, at })
    if (period.serving !== side) {
        period.closeTurn(period.serving)
        period.rotate(side, match, at)
        period.serving = side
        period.openTurn(side)
    }
    if (reachesSwitch(match, period, side)) {
        period.switched = true
        period.leftSide = rival(period.leftSide)
        match.automatic.push({ kind: "courtSwitch", period: period.number, at })
    }
    const own = period.score[side]
    if (own >= match.targetOf(period) && own - period.score[rival(side)] >= 2) {
        closePeriod(match, at)
    }
}

/**
 * Indica si este punto provoca el único cambio de campo del set decisivo.
 * @param {Match} match partido
 * @param {Period} period periodo en juego
 * @param {"home"|"away"} side quién acaba de puntuar
 * @returns {boolean}
 */
function reachesSwitch(match, period, side) {
    if (!period.decider || period.switched) {
        return false
    }
    return period.score[side] === match.settings.deciderSwitch
}

/**
 * Cierra el set en curso. Gana quien va por delante, que es siempre quien acaba de cerrarlo.
 * El desempate termina el partido sin sumar sets; si no, se suma el set y o se acaba el
 * partido o se abre el siguiente periodo, que cambia de campo y de primer saque salvo en el
 * decisivo, donde manda un sorteo nuevo.
 * @param {Match} match partido que se modifica
 * @param {string|null} at marca de tiempo ISO
 */
export function closePeriod(match, at) {
    const period = match.current
    let winner = "away"
    if (period.score.home > period.score.away) {
        winner = "home"
    }
    period.winner = winner
    period.endedAt = at
    period.closeTurn("home")
    period.closeTurn("away")
    if (period.isGolden) {
        match.golden.winner = winner
        finish(match, at)
        return
    }
    match.setsWon[winner] += 1
    if (match.setsWon[winner] === match.setsToWin) {
        finish(match, at)
        return
    }
    const number = period.number + 1
    const next = new Period(number, number === match.settings.bestOf)
    if (!next.decider) {
        next.leftSide = rival(period.leftSide)
        next.firstServer = rival(period.firstServer)
    }
    match.periods.push(next)
    match.phase = PHASE.break
}

/**
 * Da el partido por terminado.
 * @param {Match} match partido
 * @param {string|null} at marca de tiempo ISO
 */
function finish(match, at) {
    match.phase = PHASE.over
    match.endedAt = at
}
