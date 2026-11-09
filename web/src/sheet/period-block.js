/**
 * Bloques de los sets 1 a 4 y la pieza que comparten con el set decisivo: media hoja de un
 * equipo (formación, cambios, turnos de saque, columna PUNTS y tiempos de descanso).
 * @module src/sheet/period-block.js
 */

import { rival } from "../rules/constants.js"
import { PERIOD_GRID } from "./layout.js"
import { spanMinutes } from "./metrics.js"

/**
 * Puntos válidos de un equipo numerados del 1 en adelante. Los anulados por una falta de
 * rotación no ocupan casilla.
 * @param {object[]} rallyLog registro de puntos del set
 * @param {"home"|"away"} side equipo
 * @returns {{cause: string, n: number}[]}
 */
export function numberedPoints(rallyLog, side) {
    const counted = rallyLog.filter((entry) => entry.side === side && !entry.voided)
    return counted.map((entry, index) => ({ cause: entry.cause, n: index + 1 }))
}

/**
 * Alturas de las filas de un set desplazado `dy` mm hacia abajo.
 * @param {number} dy desplazamiento vertical
 * @returns {{lineup: number, entering: number, enterScore: number, backScore: number,
 *   serve: number}}
 */
export function periodRows(dy) {
    const rows = PERIOD_GRID.rows
    return {
        lineup: rows.lineup + dy,
        entering: rows.entering + dy,
        enterScore: rows.enterScore + dy,
        backScore: rows.backScore + dy,
        serve: rows.serve + dy,
    }
}

/**
 * Margen hacia dentro, en mm, del tramo que se anula en cada tercio de la columna PUNTS.
 */
const VOID_INSET = 0.26

/**
 * Columna PUNTS normal (1-13, 14-25 y 26-37) de la mitad izquierda del set 1 desplazada
 * (dx, dy). Al acabar el set se anula lo que sobra de cada subcolumna en su tercio de la
 * columna impresa.
 * @param {number} dx desplazamiento horizontal
 * @param {number} dy desplazamiento vertical
 * @returns {{pointAt: (n: number) => number[]|null, spans: number[][]}} posición de cada
 *   punto y tramos [desde, hasta, x1, x2] que se anulan al acabar el set
 */
export function pointColumns(dx, dy) {
    const grid = PERIOD_GRID.points
    const pointAt = (n) => locatePoint(grid, dx, dy, n)
    const [left, right] = PERIOD_GRID.punts
    const third = (right - left) / 3
    const spans = []
    for (let index = 0; index < 3; index++) {
        const from = dx + left + index * third + VOID_INSET
        spans.push([grid.first[index], grid.last[index], from, from + third - 2 * VOID_INSET])
    }
    return { pointAt, spans }
}

/**
 * Posición del punto `n` en la columna PUNTS, o null si no tiene casilla.
 * @param {object} grid medidas de PUNTS
 * @param {number} dx desplazamiento horizontal
 * @param {number} dy desplazamiento vertical
 * @param {number} n número de punto
 * @returns {number[]|null}
 */
function locatePoint(grid, dx, dy, n) {
    if (n < 1 || n > 37) {
        return null
    }
    let column = 0
    while (n > grid.last[column] && column < 2) {
        column += 1
    }
    const row = n - grid.first[column]
    return [dx + grid.x[column], dy + grid.y[column] + row * grid.step[column]]
}

/**
 * Un castigo (FIVB 16.2) se marca rodeado en lugar de tachado.
 * @param {string} cause causa del punto
 * @returns {boolean}
 */
function isPenalty(cause) {
    return cause === "penalty" || cause === "delayPenalty"
}

/**
 * Formación, cambios y marcadores de cada posición. Las sustituciones excepcionales no van
 * aquí: se explican en observaciones.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} half descripción de la media hoja (ver drawHalf)
 */
function drawLineup(canvas, half) {
    const { columns, rows, lineup, subs } = half
    const h = PERIOD_GRID.serveStep
    const regular = subs.filter((change) => !change.exceptional)
    for (let zone = 0; zone < 6; zone++) {
        const x = columns[zone]
        const w = columns[zone + 1] - columns[zone]
        const starter = lineup[zone]
        canvas.text(x, rows.lineup, w, h, starter, { align: "center", size: 9 })
        const out = regular.find((change) => change.leaving === starter)
        if (!out) {
            continue
        }
        canvas.text(x, rows.entering, w, h, out.entering, { align: "center", size: 9 })
        const outScore = `${out.own}:${out.rival}`
        canvas.text(x, rows.enterScore, w, h, outScore, { align: "center", size: 7.5 })
        const isReturn = (change) => change.entering === starter && change.leaving === out.entering
        const back = regular.find(isReturn)
        if (!back) {
            continue
        }
        // El titular vuelve: su marcador debajo y el suplente rodeado, el cambio queda cerrado.
        const backScore = `${back.own}:${back.rival}`
        canvas.text(x, rows.backScore, w, h, backScore, { align: "center", size: 7.5 })
        canvas.ring(x + w / 2, rows.entering + h / 2, 1.98)
    }
}

/**
 * Turnos de saque: cada turno ocupa la siguiente casilla libre de la columna del sacador
 * (cuatro a la izquierda y cuatro a la derecha) con los puntos del equipo al perderlo.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} half descripción de la media hoja
 */
function drawServes(canvas, half) {
    const { columns, splits, rows } = half
    const step = PERIOD_GRID.serveStep
    const taken = [0, 0, 0, 0, 0, 0]
    const nextBox = (column) => {
        const used = taken[column]
        taken[column] += 1
        if (used >= 8) {
            return null
        }
        const top = rows.serve + used % 4 * step
        if (used < 4) {
            return { x: columns[column], x2: splits[column], y: top }
        }
        return { x: splits[column], x2: columns[column + 1], y: top }
    }
    // Barra larga pegada a la cifra que tacha el numerito impreso: el turno se ha jugado.
    const strike = (box) => {
        canvas.line(box.x2 - 1.48, box.y + step - 0.42, box.x2 - 0.14, box.y + 1.34)
    }
    if (half.crossFirst) {
        const box = nextBox(0)
        canvas.cross(box.x, box.y, box.x2 - box.x, step)
    }
    let turns = half.turns
    const latest = turns[turns.length - 1]
    // Si el ganador no tiene su tanteo final en ningún turno (set ganado en recepción o por
    // equipo incompleto), se apunta en la casilla del siguiente sacador.
    if (half.closed && half.won && (!latest || latest.until !== half.total)) {
        let column = 0
        if (latest) {
            column = (latest.column + 1) % 6
        }
        turns = [...turns, { column, until: half.total, since: half.total }]
    }
    for (const [index, turn] of turns.entries()) {
        if (turn.column < 0) {
            continue
        }
        const box = nextBox(turn.column)
        if (!box) {
            continue
        }
        if (turn.open) {
            strike(box)
            continue
        }
        if (turn.until === null || turn.until === undefined) {
            continue
        }
        const w = box.x2 - box.x
        const isLast = half.closed && index === turns.length - 1
        // Ese último tanteo no llegó a sacarse: va rodeado y sin barra.
        const unserved = isLast && half.won && turn.since !== null && turn.since !== undefined &&
            turn.since === turn.until
        canvas.text(box.x + 0.18, box.y + 0.18, w - 1.41, step - 0.35, turn.until, { size: 8.5 })
        if (!unserved) {
            strike(box)
        }
        if (isLast) {
            canvas.ring(box.x + w / 2 - 0.53, box.y + step / 2, 1.98)
        }
    }
}

/**
 * Columna PUNTS: barra en cada punto, círculo en los de castigo y, si el rival ganó por
 * equipo incompleto (FIVB 6.4.3), barra y círculo. Al cerrar el set, los tramos sin usar se
 * anulan con un reloj de arena.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} half descripción de la media hoja
 */
function drawPoints(canvas, half) {
    for (const point of half.points) {
        const spot = half.pointAt(point.n)
        if (!spot) {
            continue
        }
        const [x, y] = spot
        if (isPenalty(point.cause)) {
            canvas.ring(x, y, 1.16)
            continue
        }
        canvas.line(x - 0.92, y + 0.85, x + 0.92, y - 0.85, 0.24)
        if (point.cause === "forfeit") {
            canvas.ring(x, y, 1.16)
        }
    }
    for (const [from, to, left, right] of half.voidSpans || []) {
        const first = Math.max(from, half.total + 1)
        if (first > to) {
            continue
        }
        canvas.hourglass(left, half.pointAt(first)[1] - 1.05, right, half.pointAt(to)[1] + 1.05)
    }
}

/**
 * Media hoja de un equipo. `half` describe dónde (columns, splits, rows, pointAt, voidSpans,
 * timeoutBoxes) y qué (lineup, subs, crossFirst, turns, closed, won, points, total,
 * timeouts). No sabe de qué set se trata: lo usan igual los sets normales y las tres partes
 * del decisivo.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} half descripción de la media hoja
 */
export function drawHalf(canvas, half) {
    drawLineup(canvas, half)
    drawServes(canvas, half)
    drawPoints(canvas, half)
    for (const [index, pause] of half.timeouts.slice(0, 2).entries()) {
        const [x, y, w, h] = half.timeoutBoxes[index]
        const score = `${pause.own}:${pause.rival}`
        canvas.text(x, y, w, h, score, { align: "center", size: 8.5 })
    }
}

/**
 * Casillas de tiempos de descanso de una media hoja: bajo la T, con el ancho de PUNTS.
 * @param {number} dx desplazamiento horizontal de la mitad
 * @param {number} dy desplazamiento vertical
 * @returns {number[][]} [x, y, ancho, alto] de cada casilla
 */
export function timeoutBoxes(dx, dy) {
    const [left, right] = PERIOD_GRID.punts
    return PERIOD_GRID.timeouts.map(([y, h]) => [dx + left, dy + y, right - left, h])
}

/**
 * Bloque de un set del 1 al 4: horas, duración y las dos mitades. El equipo de la izquierda
 * es el A en los sets impares y el B en los pares.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {object} period set
 * @param {"home"|"away"} leftSide equipo de la mitad izquierda
 */
export function drawPeriod(canvas, context, period, leftSide) {
    const grid = PERIOD_GRID
    const [dx, dy] = grid.shift[period.number]
    const [startX, startColon, startBase] = grid.clock.start
    const [endX, endColon, endBase] = grid.clock.end
    canvas.splitTime(period.startedAt, dx + startX, dx + startColon, dy + startBase)
    canvas.splitTime(period.endedAt, dx + endX, dx + endColon, dy + endBase)
    if (period.startedAt && period.endedAt) {
        const [mx, my, mw, mh] = grid.minutes
        const minutes = String(spanMinutes(period.startedAt, period.endedAt))
        canvas.text(dx + mx, dy + my, mw, mh, minutes, { align: "center" })
    }
    const sides = [leftSide, rival(leftSide)]
    const codeSpots = [grid.code.left, grid.code.right]
    const serveSpots = [grid.firstServe.left, grid.firstServe.right]
    for (const [k, side] of sides.entries()) {
        const halfX = dx + k * grid.half
        const [codeX, codeW] = codeSpots[k]
        const code = context.codes[side]
        canvas.baseline(dx + codeX, dy + grid.code.base, codeW, code, { bold: true, size: 9 })
        drawFirstServe(canvas, period.firstServer === side, dx, serveSpots[k], dy + grid.rows.head)
        const column = pointColumns(halfX, dy)
        const points = numberedPoints(period.rallyLog, side)
        drawHalf(canvas, {
            columns: grid.columns.map((x) => x + halfX),
            splits: grid.splits.map((x) => x + halfX),
            rows: periodRows(dy),
            lineup: period.lineup[side] || [],
            subs: period.substitutions[side],
            crossFirst: period.firstServer && period.firstServer !== side,
            turns: period.turns[side],
            closed: !!period.endedAt,
            won: period.winner === side,
            points,
            total: points.length,
            pointAt: column.pointAt,
            voidSpans: period.endedAt ? column.spans : null,
            timeouts: period.timeouts[side],
            timeoutBoxes: timeoutBoxes(halfX, dy),
        })
    }
}

/**
 * Raya en la casilla S (saca primero, la mitad de arriba) o en la R (recibe, la de abajo) de
 * un equipo, 0,35 mm hacia dentro por los lados.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {boolean} serves si este equipo saca primero
 * @param {number} dx desplazamiento horizontal del bloque
 * @param {number[]} spot bordes izquierdo y derecho de la casilla
 * @param {number} top altura de la fila
 */
export function drawFirstServe(canvas, serves, dx, [left, right], top) {
    const x1 = dx + left + 0.35
    const x2 = dx + right - 0.35
    if (serves) {
        canvas.line(x1, top + 0.35, x2, top + 2.1)
        return
    }
    canvas.line(x1, top + 2.65, x2, top + 4.4)
}
