/**
 * Acta oficial impresa. Escribe los datos del partido encima del impreso de la federación
 * (un SVG de fondo) como lo haría el anotador a mano: en mayúsculas y con tinta azul. El
 * resultado es HTML con medidas en milímetros, listo para pantalla o para imprimir.
 * @module src/sheet/index.js
 */

import { rival } from "../rules/constants.js"
import { PT_PER_MM, SheetCanvas } from "./canvas.js"
import { clubCode } from "./clubs.js"
import { Warp, KIDS_WARP } from "./warp.js"
import { STANDARD_LAYOUT, KIDS_LAYOUT } from "./layout.js"
import { drawHeader, drawReferees } from "./header.js"
import { drawRosters } from "./rosters.js"
import { drawPeriod } from "./period-block.js"
import { drawDecider } from "./decider-block.js"
import { drawFooter } from "./footer.js"
import { drawRemarks } from "./remarks.js"
import { drawAnnex } from "./annex.js"

export { clubCode }

/**
 * Ancho de la hoja apaisada en puntos: los 297 mm del A4.
 */
export const PAGE_W = 297 * PT_PER_MM

/**
 * Color de la tinta: azul de bolígrafo.
 */
const INK = "#0b2a6f"

/**
 * Si el partido se rellena en el impreso infantil: lo decide la competición o la categoría,
 * igual que en el resto de la aplicación.
 * @param {object} info datos del encuentro
 * @returns {boolean}
 */
function isKidsSheet(info) {
    return /INFANTIL/i.test(`${info.competition || ""} ${info.category || ""}`)
}

/**
 * Envuelve lo dibujado en una página con su fondo. Las páginas no se traducen: el impreso
 * es catalán y los datos van tal cual.
 * @param {string} classes clases de la página
 * @param {string} background nombre del SVG de fondo, sin extensión
 * @param {SheetCanvas} canvas lienzo
 * @returns {string}
 */
function wrapPage(classes, background, canvas) {
    const backdrop = `<img class="sheet-bg" src="impresos/${background}.svg" alt="">`
    return `<div class="${classes}" data-keep-text style="color:${INK}">${backdrop}${canvas}</div>`
}

/**
 * Si un set llegó a jugarse. Los que el motor rellena al declarar un equipo incompleto o
 * no presentado solo cuentan en el cuadro de resultados; el set en que ocurrió se dibuja si
 * ya tenía alguna formación.
 * @param {object} match partido
 * @param {object} period set
 * @returns {boolean}
 */
function wasPlayed(match, period) {
    const forfeit = match.forfeit
    if (!forfeit || period.number < forfeit.period) {
        return true
    }
    if (period.number !== forfeit.period) {
        return false
    }
    return !!(period.lineup.home?.length || period.lineup.away?.length)
}

/**
 * Compone el acta oficial. No guarda nada entre llamadas ni toca el partido: cada llamada
 * crea su propio lienzo y calcula las abreviaturas.
 * @param {object} record acta (se usan info, settings y plays)
 * @param {object} match partido reconstruido a partir de record.plays
 * @param {object} rules motor (walk, currentPeriod y summarize)
 * @returns {string} la hoja apaisada y, si las observaciones no caben, la hoja anexa vertical
 */
export function renderSheet(record, match, rules) {
    const info = record.info
    const kids = isKidsSheet(info)
    let warp = null
    let layout = STANDARD_LAYOUT
    if (kids) {
        warp = new Warp(KIDS_WARP)
        layout = KIDS_LAYOUT
    }
    const canvas = new SheetCanvas({ warp })
    // El equipo A es el que empieza el primer set a la izquierda del anotador.
    const sideA = match.periods[0]?.leftSide || null
    const context = {
        record,
        info,
        match,
        rules,
        kids,
        layout,
        sideA,
        codes: {
            home: info.homeCode || clubCode(info.homeName),
            away: info.awayCode || clubCode(info.awayName),
        },
        letterOf: (side) => letterFor(sideA, side),
    }

    drawHeader(canvas, context)
    drawRosters(canvas, context)
    drawReferees(canvas, context)
    let rest = ""
    if (sideA) {
        for (const period of match.periods) {
            const regular = period.startedAt && period.number <= 4 && !period.isGolden
            if (!regular || !wasPlayed(match, period)) {
                continue
            }
            let left = rival(sideA)
            if (period.number % 2) {
                left = sideA
            }
            drawPeriod(canvas, context, period, left)
        }
        const decider = match.periods.find(isDecider)
        if (decider && wasPlayed(match, decider)) {
            drawDecider(canvas, context, decider)
        }
        drawFooter(canvas, context)
        rest = drawRemarks(canvas, context)
    }

    let background = "acta-estandar"
    if (kids) {
        background = "acta-infantil"
    }
    let html = wrapPage("sheet-page", background, canvas)
    if (rest) {
        const annex = new SheetCanvas()
        drawAnnex(annex, context, rest)
        html += wrapPage("sheet-page sheet-page--portrait", "hoja-observaciones", annex)
    }
    return html
}

/**
 * Set decisivo de un partido a cinco (no el golden) que ya ha empezado.
 * @param {object} period set
 * @returns {boolean}
 */
function isDecider(period) {
    return period.number === 5 && period.decider && !period.isGolden && !!period.startedAt
}

/**
 * Letra A o B de un equipo, o vacío mientras no se sepa cuál es el A.
 * @param {string|null} sideA equipo A
 * @param {"home"|"away"} side equipo
 * @returns {string}
 */
function letterFor(sideA, side) {
    if (!sideA) {
        return ""
    }
    if (side === sideA) {
        return "A"
    }
    return "B"
}
