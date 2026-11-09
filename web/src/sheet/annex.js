/**
 * Hoja anexa de observaciones (Format 5, A4 vertical): datos del partido, la continuación de
 * las observaciones y el pie con lugar y fecha.
 * @module src/sheet/annex.js
 */

import { ANNEX_GRID } from "./layout.js"
import { shortDate, wrapWords } from "./metrics.js"
import { surnameFirst } from "./names.js"

/**
 * Meses en catalán, para la fecha del pie.
 */
const MONTHS_CA = `gener febrer març abril maig juny juliol agost setembre octubre novembre
    desembre`.split(/\s+/)

const WRITE = { size: 10 }
const CENTERED = { align: "center", size: 10 }

/**
 * Temporada a la que pertenece un mes: de agosto en adelante empieza una nueva.
 * @param {number} year año
 * @param {number} month mes de 1 a 12
 * @returns {number} año en que empezó la temporada
 */
function seasonStart(year, month) {
    if (month >= 8) {
        return year
    }
    return year - 1
}

/**
 * Rellena la hoja anexa con lo que no cupo en la principal, precedido de "(continuació)".
 * Solo hay seis renglones; lo que aún sobre se pierde, igual que en papel.
 * @param {import("./canvas.js").SheetCanvas} canvas lienzo de la hoja vertical
 * @param {object} context contexto de la hoja
 * @param {string} rest texto pendiente, ya en mayúsculas
 */
export function drawAnnex(canvas, context, rest) {
    const grid = ANNEX_GRID
    const info = context.info
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(info.date || ""))
    if (date) {
        const start = seasonStart(Number(date[1]), Number(date[2]))
        canvas.baseline(...grid.season.from, String(start).slice(2), CENTERED)
        canvas.baseline(...grid.season.to, String(start + 1).slice(2), CENTERED)
    }
    const heading = [info.competition, info.category].filter(Boolean).join(" · ")
    canvas.baseline(...grid.competition, heading, WRITE)
    canvas.baseline(...grid.teams, `${info.homeName || ""} - ${info.awayName || ""}`, WRITE)
    let when = shortDate(info.date)
    if (info.time) {
        when += " " + info.time
    }
    canvas.baseline(...grid.when, when, WRITE)
    canvas.baseline(...grid.place, info.town || info.venue || "", WRITE)
    canvas.baseline(...grid.referee, surnameFirst(info.referee1), WRITE)
    canvas.baseline(...grid.licence, info.referee1Licence || "", CENTERED)

    // Los renglones del impreso no están a distancia fija: cada uno va en su raya.
    const lines = grid.lines
    const pieces = wrapWords("(continuació) " + rest, lines.width, 9.5).slice(0, lines.rows.length)
    for (const [row, piece] of pieces.entries()) {
        canvas.baseline(lines.x, lines.rows[row] - 0.7, lines.width, piece, { size: 9.5 })
    }
    // El cierre va 1,25 mm por encima de cada raya, a media altura de las mayúsculas.
    const guides = lines.rows.map((y) => [lines.x, y - 1.25, lines.right])
    const lastGuide = lines.rows[lines.rows.length - 1] - 1.25
    canvas.tailRows(guides, pieces, 9.5, [lines.x, lastGuide])

    if (date) {
        const signed = grid.signedAt
        canvas.baseline(...signed.town, info.town || "", CENTERED)
        canvas.baseline(...signed.day, String(Number(date[3])), CENTERED)
        canvas.baseline(...signed.month, MONTHS_CA[Number(date[2]) - 1], CENTERED)
        canvas.baseline(...signed.year, date[1], CENTERED)
    }
}
