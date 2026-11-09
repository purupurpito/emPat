/**
 * Set decisivo. En el impreso ocupa tres partes: el equipo que empieza, hasta el cambio de
 * campo (PUNTS 1-8); el otro equipo, entero; y el primero otra vez después del cambio, donde
 * se repiten la formación, los cambios y los tiempos y siguen los turnos y los puntos.
 * @module src/sheet/decider-block.js
 */

import { rival } from "../rules/constants.js"
import { DECIDER_GRID, PERIOD_GRID } from "./layout.js"
import { sheetTime, spanMinutes } from "./metrics.js"
import {
    drawFirstServe,
    drawHalf,
    numberedPoints,
    periodRows,
    pointColumns,
    timeoutBoxes,
} from "./period-block.js"

/**
 * Copia lo que la primera parte necesita de un equipo en un momento dado. Se copia porque el
 * partido que se recorre sigue cambiando después.
 * @param {object} period set decisivo en ese momento
 * @param {"home"|"away"} side equipo que empezó
 * @returns {{points: object[], turns: object[], subs: object[], timeouts: object[]}}
 */
function freezeSide(period, side) {
    return {
        points: numberedPoints(period.rallyLog, side),
        turns: period.turns[side].map((turn) => ({ ...turn })),
        subs: period.substitutions[side].map((change) => ({ ...change })),
        timeouts: period.timeouts[side].map((pause) => ({ ...pause })),
    }
}

/**
 * Estado del equipo que empezó justo cuando se cambió de campo. Se recorre el acta jugada a
 * jugada y se para en la primera en la que el set decisivo ya tiene el cambio hecho.
 * @param {object} context contexto de la hoja
 * @param {number} number número del set decisivo
 * @param {"home"|"away"} side equipo que empezó
 * @returns {object|null}
 */
function stateAtSwitch(context, number, side) {
    const { record, rules } = context
    let found = null
    rules.walk(record.settings, record.info, record.plays, (match) => {
        const period = rules.currentPeriod(match)
        if (period.number !== number || !period.switched) {
            return false
        }
        found = freezeSide(period, side)
        return true
    })
    return found
}

/**
 * Letra A/B o cifra dentro de los círculos del decisivo. En el infantil son casillas medidas
 * sobre el propio impreso, por eso van sin deformar.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {string} key first, other, after o switch
 * @param {string} value lo que se escribe
 */
function stamp(canvas, context, key, value) {
    let rings = DECIDER_GRID.rings
    if (context.kids) {
        rings = DECIDER_GRID.kidsRings
    }
    const [cx, cy] = rings[key]
    canvas.unwarped(() => {
        canvas.text(cx - 1.75, cy - 2.1, 3.5, 4.2, value, { align: "center", bold: true })
    })
}

/**
 * Horas de inicio y final y duración del decisivo. En el infantil los dos puntos de INICI
 * están impresos fuera de sitio, así que esa hora va entera, y FINAL tiene su propia medida.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {object} period set decisivo
 */
function drawClock(canvas, context, period) {
    const grid = DECIDER_GRID
    if (context.kids) {
        canvas.unwarped(() => {
            const [startX, startBase, startW] = grid.kidsClock.start
            canvas.baseline(startX, startBase, startW, sheetTime(period.startedAt), { size: 9 })
            canvas.splitTime(period.endedAt, ...grid.kidsClock.end)
        })
    } else {
        canvas.splitTime(period.startedAt, ...grid.clock.start)
        canvas.splitTime(period.endedAt, ...grid.clock.end)
    }
    if (period.startedAt && period.endedAt) {
        const [x, y, w, h] = grid.minutes
        const minutes = String(spanMinutes(period.startedAt, period.endedAt))
        canvas.text(x, y, w, h, minutes, { align: "center" })
    }
}

/**
 * Columnas de una de las tres partes.
 * @param {number} shift desplazamiento horizontal de la parte
 * @returns {{columns: number[], splits: number[], rows: object, timeoutBoxes: number[][]}}
 */
function partFrame(shift) {
    const dy = DECIDER_GRID.rowsShift
    return {
        columns: PERIOD_GRID.columns.map((x) => x + shift),
        splits: PERIOD_GRID.splits.map((x) => x + shift),
        rows: periodRows(dy),
        timeoutBoxes: timeoutBoxes(shift, dy),
    }
}

/**
 * PUNTS normal de la parte que empieza en `shift`.
 * @param {number} shift desplazamiento horizontal de la parte
 * @returns {{pointAt: Function, spans: number[][]}}
 */
function partPoints(shift) {
    return pointColumns(shift, DECIDER_GRID.pointsShift)
}

/**
 * Dibuja el set decisivo en sus tres partes.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {object} period set decisivo tal como acabó (o como va)
 */
export function drawDecider(canvas, context, period) {
    const grid = DECIDER_GRID
    const [firstShift, otherShift, afterShift] = grid.parts
    const parts = { first: firstShift, other: otherShift, after: afterShift }
    let first = period.leftSide
    if (period.switched) {
        first = rival(period.leftSide)
    }
    const other = rival(first)
    let atSwitch = null
    if (period.switched) {
        atSwitch = stateAtSwitch(context, period.number, first)
    }

    stamp(canvas, context, "first", context.letterOf(first))
    stamp(canvas, context, "other", context.letterOf(other))
    stamp(canvas, context, "after", context.letterOf(first))
    const [firstCodeX, firstCodeW] = grid.codes.first
    const [otherCodeX, otherCodeW] = grid.codes.other
    const codeLook = { bold: true, size: 9 }
    canvas.baseline(firstCodeX, grid.codes.base, firstCodeW, context.codes[first], codeLook)
    canvas.baseline(otherCodeX, grid.codes.base, otherCodeW, context.codes[other], codeLook)
    drawClock(canvas, context, period)
    drawFirstServe(canvas, period.firstServer === first, 0, grid.firstServe.first, grid.headY)
    drawFirstServe(canvas, period.firstServer === other, 0, grid.firstServe.other, grid.headY)

    const closed = !!period.endedAt
    const otherPoints = partPoints(parts.other)
    const otherTally = numberedPoints(period.rallyLog, other)
    drawHalf(canvas, {
        ...partFrame(parts.other),
        lineup: period.lineup[other] || [],
        subs: period.substitutions[other],
        crossFirst: period.firstServer !== other,
        turns: period.turns[other],
        closed,
        won: period.winner === other,
        points: otherTally,
        total: otherTally.length,
        pointAt: otherPoints.pointAt,
        voidSpans: closed ? otherPoints.spans : null,
        timeouts: period.timeouts[other],
    })

    const before = atSwitch || freezeSide(period, first)
    const switchScore = before.points.length
    // El turno que estaba en curso al cambiar se deja abierto (solo la barra) y se cierra
    // en la tercera parte.
    const openTurns = before.turns.map((turn) => {
        if (turn.until === null || turn.until === undefined) {
            return { ...turn, open: true }
        }
        return turn
    })
    const early = grid.early
    const earlyAt = (n) => {
        if (n >= 1 && n <= 8) {
            return [parts.first + early.x, early.y + (n - 1) * early.step]
        }
        return null
    }
    let earlyVoid = null
    if (atSwitch) {
        const centre = parts.first + early.x
        earlyVoid = [[1, 8, centre - early.half, centre + early.half]]
    }
    drawHalf(canvas, {
        ...partFrame(parts.first),
        lineup: period.lineup[first] || [],
        subs: before.subs,
        crossFirst: period.firstServer !== first,
        turns: openTurns,
        closed: !atSwitch && closed,
        won: false,
        points: before.points,
        total: switchScore,
        pointAt: earlyAt,
        voidSpans: earlyVoid,
        timeouts: before.timeouts,
    })
    if (!atSwitch) {
        return
    }

    stamp(canvas, context, "switch", String(switchScore))
    const isServed = (turn) => turn.until !== null && turn.until !== undefined
    const servedBefore = before.turns.filter(isServed)
    const afterPoints = partPoints(parts.after)
    const firstTally = numberedPoints(period.rallyLog, first)
    drawHalf(canvas, {
        ...partFrame(parts.after),
        lineup: period.lineup[first] || [],
        subs: period.substitutions[first],
        crossFirst: false,
        turns: period.turns[first].slice(servedBefore.length),
        closed,
        won: period.winner === first,
        points: firstTally.filter((point) => point.n > switchScore),
        total: firstTally.length,
        pointAt: afterPoints.pointAt,
        voidSpans: closed ? afterPoints.spans : null,
        timeouts: period.timeouts[first],
    })
}
