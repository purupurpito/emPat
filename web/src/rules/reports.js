/**
 * Resúmenes calculados del partido para el acta y la pantalla final. No modifican el partido.
 * @module src/rules/reports.js
 */

import { SIDES } from "./constants.js"

/**
 * Minutos redondeados entre dos marcas ISO, o null si falta alguna.
 * @param {string|null} start inicio
 * @param {string|null} end fin
 * @returns {number|null}
 */
export function minutesBetween(start, end) {
    if (!start || !end) {
        return null
    }
    return Math.round((Date.parse(end) - Date.parse(start)) / 60000)
}

/**
 * Cifras de un lado en un set.
 * @param {Period} period set
 * @param {"home"|"away"} side lado
 * @returns {{timeouts: number, substitutions: number, won: number, points: number}}
 */
function sideLine(period, side) {
    let won = 0
    if (period.winner === side) {
        won = 1
    }
    return {
        timeouts: period.timeouts[side].length,
        // Las excepcionales no cuentan para el tope, pero sí en el total del acta (FIVB 15.7).
        substitutions: period.substitutions[side].length,
        won,
        points: period.score[side],
    }
}

/**
 * Suma una cifra de un lado en todas las filas.
 * @param {object[]} rows filas del cuadro
 * @param {"home"|"away"} side lado
 * @param {string} field cifra
 * @returns {number}
 */
function addUp(rows, side, field) {
    let total = 0
    for (const row of rows) {
        total += row[side][field]
    }
    return total
}

/**
 * Hora de fin del último set normal terminado, o undefined si no hay ninguno.
 * @param {Match} match partido
 * @returns {string|undefined}
 */
function lastRegularEnd(match) {
    const finished = match.periods.filter((period) => !period.isGolden && period.endedAt)
    return finished.at(-1)?.endedAt
}

/**
 * Cuadro de resultados: una fila por set empezado que no sea el desempate (incluido el que
 * está en juego), totales, horas y ganador. El desempate va aparte y no suma a los totales;
 * solo aparece cuando ha empezado. Un set sin duración cuenta 0 minutos en el total.
 * @param {Match} match partido
 * @returns {object} resumen {rows, totals, startedAt, endedAt, golden, matchMinutes, winner}
 */
export function summarize(match) {
    const rows = []
    for (const period of match.periods) {
        if (!period.startedAt || period.isGolden) {
            continue
        }
        rows.push({
            period: period.number,
            minutes: minutesBetween(period.startedAt, period.endedAt),
            home: sideLine(period, "home"),
            away: sideLine(period, "away"),
        })
    }
    let minutes = 0
    for (const row of rows) {
        minutes += row.minutes || 0
    }
    const totals = { minutes }
    for (const side of SIDES) {
        totals[side] = {
            timeouts: addUp(rows, side, "timeouts"),
            substitutions: addUp(rows, side, "substitutions"),
            won: match.setsWon[side],
            points: addUp(rows, side, "points"),
        }
    }
    const end = lastRegularEnd(match)
    return {
        rows,
        totals,
        startedAt: match.startedAt,
        endedAt: end || null,
        golden: goldenLine(match),
        matchMinutes: minutesBetween(match.startedAt, end),
        winner: matchWinner(match),
    }
}

/**
 * Línea del desempate si ya ha empezado.
 * @param {Match} match partido
 * @returns {object|null}
 */
function goldenLine(match) {
    const golden = match.periods.find((period) => period.isGolden && period.startedAt)
    if (!golden) {
        return null
    }
    return {
        period: golden.number,
        minutes: minutesBetween(golden.startedAt, golden.endedAt),
        winner: golden.winner,
        points: { ...golden.score },
    }
}

/**
 * Ganador por sets cuando el partido ha terminado o se ha abierto el desempate. El desempate
 * no cambia este valor: su ganador va en la línea propia.
 * @param {Match} match partido
 * @returns {"home"|"away"|null}
 */
function matchWinner(match) {
    if (match.phase !== "over" && !match.golden) {
        return null
    }
    if (match.setsWon.home > match.setsWon.away) {
        return "home"
    }
    return "away"
}

/**
 * Para cada jugador, en qué sets ha jugado completo y si cumple la norma del set obligatorio
 * (un set completo como mínimo). Un set cuenta solo para los titulares que no fueron cambiados
 * y solo cuando ha terminado; el desempate no cuenta; la marca manual manda sobre el cálculo.
 * No mira el ajuste fullSetRule: decide la interfaz si lo enseña.
 * @param {Match} match partido
 * @returns {{home: object[], away: object[]}} jugadores en el orden de la plantilla
 */
export function fullSetReport(match) {
    const report = {}
    for (const side of SIDES) {
        report[side] = match.teams[side].players.map((player) => playerLine(match, side, player))
    }
    return report
}

/**
 * Línea del informe de set completo para un jugador.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @param {object} player jugador
 * @returns {object}
 */
function playerLine(match, side, player) {
    const periods = []
    for (const period of match.periods) {
        if (!period.startedAt || period.isGolden) {
            continue
        }
        const auto = playedWhole(period, side, player.shirt)
        const manual = match.fullSetMarks[side][player.shirt]?.[period.number] ?? null
        periods.push({
            period: period.number,
            auto,
            manual,
            complete: manual ?? auto,
            live: !period.endedAt,
        })
    }
    return {
        shirt: player.shirt,
        name: player.name,
        libero: Boolean(player.libero),
        periods,
        ok: periods.some((entry) => entry.complete),
    }
}

/**
 * Indica si un jugador fue titular de un set terminado y nunca salió por sustitución.
 * @param {Period} period set
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @returns {boolean}
 */
function playedWhole(period, side, shirt) {
    if (!period.endedAt) {
        return false
    }
    if (!(period.lineup[side] || []).includes(shirt)) {
        return false
    }
    return !period.substitutions[side].some((entry) => entry.leaving === shirt)
}
