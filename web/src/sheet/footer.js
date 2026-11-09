/**
 * Pie de la hoja principal: sanciones, solicitudes improcedentes, cuadro de resultados, horas
 * del partido, ganador y tanteos de RESULTATS.
 * @module src/sheet/footer.js
 */

import { rival } from "../rules/constants.js"
import { FOOTER_GRID } from "./layout.js"
import { sheetTime, spanMinutes } from "./metrics.js"

/**
 * Columna del cuadro de sanciones según el nivel: amonestación, castigo, expulsión y
 * descalificación. Las de demora van en las dos primeras con una D.
 */
const SANCTION_COLUMNS = {
    warning: 0,
    penalty: 1,
    expulsion: 2,
    disqualification: 3,
    delayWarning: 0,
    delayPenalty: 1,
}

/**
 * Cómo se escribe cada cargo del banquillo en el papel.
 */
const STAFF_SHEET_CODE = {
    coach: "E",
    assistant: "2E",
    assistant2: "3E",
    physio: "F",
    doctor: "M",
    psychologist: "PS",
    fitness: "PF",
    masseur: "MS",
}

/**
 * Sets perdidos por el ganador, en letra, como pide el impreso infantil.
 */
const LOST_IN_WORDS = ["ZERO (0)", "U (1)", "DOS (2)"]

/**
 * Sanciones que tienen casilla en el pie (la solicitud improcedente no la tiene).
 * @param {object} match partido
 * @returns {object[]}
 */
export function sheetSanctions(match) {
    return match.sanctions.filter((entry) => SANCTION_COLUMNS[entry.level] != null)
}

/**
 * Cómo se nombra en el papel a quien recibe una sanción: el dorsal, el código del cargo o
 * "equipo".
 * @param {string} target dorsal, cargo o "team"
 * @returns {string}
 */
export function targetOnSheet(target) {
    if (isShirtLike(target)) {
        return target
    }
    if (target === "team") {
        return "equipo"
    }
    return STAFF_SHEET_CODE[target] || target
}

/**
 * Si un destinatario es un dorsal (uno o dos dígitos).
 * @param {unknown} target destinatario
 * @returns {boolean}
 */
export function isShirtLike(target) {
    return /^\d{1,2}$/.test(String(target))
}

/**
 * Primeras filas del cuadro de sanciones. Las que no caben se cuentan en observaciones.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
function drawSanctions(canvas, context) {
    const grid = FOOTER_GRID.sanctions
    const xs = grid.columns
    const look = { align: "center", size: 8.5 }
    const listed = sheetSanctions(context.match).slice(0, grid.count)
    for (const [row, entry] of listed.entries()) {
        const y = grid.top + row * grid.step
        const column = SANCTION_COLUMNS[entry.level]
        let who = targetOnSheet(entry.target)
        if (/^delay/.test(entry.level)) {
            who = "D"
        }
        canvas.text(xs[column], y, xs[column + 1] - xs[column], grid.step, who, look)
        canvas.text(xs[4], y, xs[5] - xs[4], grid.step, context.letterOf(entry.side), look)
        canvas.text(xs[5], y, xs[6] - xs[5], grid.step, entry.period, look)
        const [ownX, ownW] = grid.own
        canvas.text(ownX, y, ownW, grid.step, entry.own, { align: "right", size: 8.5 })
        const [rivalX, rivalW] = grid.rival
        canvas.text(rivalX, y, rivalW, grid.step, entry.rival, { size: 8.5 })
    }
}

/**
 * Aspa sobre la A o la B del equipo que ha hecho alguna solicitud improcedente.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
function drawImproper(canvas, context) {
    for (const side of ["home", "away"]) {
        if (!(context.match.improperCount[side] > 0)) {
            continue
        }
        const [cx, cy] = FOOTER_GRID.improper[context.letterOf(side)]
        const arm = 1.75
        canvas.line(cx - arm, cy - arm, cx + arm, cy + arm)
        canvas.line(cx + arm, cy - arm, cx - arm, cy + arm)
    }
}

/**
 * Cuadro de resultados: por set y en total, T S G PUNTS del equipo A y en espejo del B.
 * El total solo se escribe con el partido acabado.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {object} summary resumen del partido
 */
function drawTable(canvas, context, summary) {
    const grid = FOOTER_GRID.table
    const sideA = context.sideA
    const sideB = rival(sideA)
    canvas.text(...grid.codeA, context.codes[sideA], { bold: true })
    canvas.text(...grid.codeB, context.codes[sideB], { bold: true })
    const xs = grid.columns
    const fillRow = (row, a, b) => {
        const y = grid.rows[row]
        const h = grid.rows[row + 1] - y
        const cells = [
            a.timeouts, a.substitutions, a.won, a.points,
            b.points, b.won, b.substitutions, b.timeouts,
        ]
        for (const [k, value] of cells.entries()) {
            canvas.text(xs[k], y, xs[k + 1] - xs[k], h, value, { align: "center", size: 8.5 })
        }
    }
    for (const [row, line] of summary.rows.slice(0, 5).entries()) {
        fillRow(row, line[sideA], line[sideB])
    }
    if (summary.rows.length > 0 && context.match.phase === "over") {
        fillRow(5, summary.totals[sideA], summary.totals[sideB])
    }
}

/**
 * Duración total como "hh:mm", o vacío si falta el inicio o el final.
 * @param {object} summary resumen
 * @returns {string}
 */
function totalDuration(summary) {
    if (!summary.startedAt || !summary.endedAt) {
        return ""
    }
    const total = spanMinutes(summary.startedAt, summary.endedAt)
    const hours = String(Math.floor(total / 60)).padStart(2, "0")
    const minutes = String(total % 60).padStart(2, "0")
    return `${hours}:${minutes}`
}

/**
 * Hora y minutos a ambos lados de unos dos puntos impresos (modelo infantil).
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {string} clock "hh:mm"
 * @param {number[]} colon bordes izquierdo y derecho de los dos puntos
 */
function besideColon(canvas, clock, [before, after]) {
    const [hours, minutes] = clock.split(":")
    if (!hours) {
        return
    }
    const base = FOOTER_GRID.kids.base
    canvas.baseline(before - 6, base, 5.65, hours, { align: "right", size: 9 })
    canvas.baseline(after + 0.56, base, 5.65, minutes, { size: 9 })
}

/**
 * Horas de inicio y final, duración y ganador con los sets del perdedor. El infantil lo
 * tiene en otro sitio y con los sets en letra; se mide sobre su impreso, sin deformar.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 * @param {object} summary resumen del partido
 */
function drawTimes(canvas, context, summary) {
    const info = context.info
    const duration = totalDuration(summary)
    let lost = null
    let winnerName = info.awayName
    if (summary.winner) {
        lost = Math.min(summary.totals.home.won, summary.totals.away.won)
    }
    if (summary.winner === "home") {
        winnerName = info.homeName
    }
    if (context.kids) {
        const kids = FOOTER_GRID.kids
        canvas.unwarped(() => {
            besideColon(canvas, sheetTime(summary.startedAt), kids.start)
            besideColon(canvas, sheetTime(summary.endedAt), kids.end)
            if (duration) {
                besideColon(canvas, duration, kids.total)
            }
            if (summary.winner) {
                const lostText = LOST_IN_WORDS[lost] || String(lost)
                canvas.baseline(...kids.winner, winnerName, { size: 8.5 })
                canvas.baseline(...kids.lost, lostText, { size: 8.5 })
            }
        })
        return
    }
    const plain = FOOTER_GRID.plain
    if (summary.startedAt) {
        canvas.baseline(...plain.start, sheetTime(summary.startedAt), { size: 8.5 })
    }
    if (summary.endedAt) {
        canvas.baseline(...plain.end, sheetTime(summary.endedAt), { size: 8.5 })
    }
    if (duration) {
        canvas.baseline(...plain.total, duration, { size: 8.5 })
    }
    if (summary.winner) {
        canvas.baseline(...plain.winner, winnerName)
        canvas.baseline(...plain.lost, String(lost))
    }
}

/**
 * Tanteos de RESULTATS a los lados de las barras impresas, local a la izquierda.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
function drawResults(canvas, context) {
    const grid = FOOTER_GRID.results
    const finished = context.match.periods.filter((period) => period.endedAt && !period.isGolden)
    for (const [index, period] of finished.slice(0, 5).entries()) {
        const bar = grid.bars[index]
        const home = period.score.home
        const away = period.score.away
        canvas.baseline(bar - 8.45, grid.base, 7.4, home, { align: "right", size: 9 })
        canvas.baseline(bar + 1.4, grid.base, 7.4, away, { size: 9 })
    }
}

/**
 * Dibuja el pie de la hoja principal (todo menos las observaciones).
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo
 * @param {object} context contexto de la hoja
 */
export function drawFooter(canvas, context) {
    drawSanctions(canvas, context)
    drawImproper(canvas, context)
    const summary = context.rules.summarize(context.match)
    drawTable(canvas, context, summary)
    drawTimes(canvas, context, summary)
    drawResults(canvas, context)
}
