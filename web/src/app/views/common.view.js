/**
 * Piezas de vista compartidas por varias pantallas. Funciones puras: reciben un modelo y
 * devuelven marcado; no leen estado global.
 *
 * Los saltos de línea y sangrías dentro de las plantillas no son decorativos: forman nodos de
 * texto que el diferencial de DOM compara uno a uno, así que se mantienen tal cual.
 * @module src/app/views/common.view.js
 */

import { escapeHtml, html, raw } from "../dom.js"
import { clockTime } from "../format.js"
import { SIGNER_LABELS } from "../constants.js"

/**
 * Pasos del acta en orden, con la pantalla que los representa.
 */
const STEPS = Object.freeze([
    { key: "details", label: "Datos" },
    { key: "rosters", label: "Equipos" },
    { key: "toss", label: "Sorteo y formación" },
    { key: "live", label: "Partido" },
    { key: "final", label: "Cierre" },
])

/**
 * Nombre visible de un lado según los datos del acta. Se devuelve tal cual, sin sustituto si
 * falta: cada vista decide.
 * @param {object} info datos del encuentro
 * @param {"home"|"away"} side lado
 * @returns {string|undefined}
 */
export function teamLabel(info, side) {
    if (side === "home") {
        return info.homeName
    }
    return info.awayName
}

/**
 * Pasos de preparación del acta: un círculo numerado por paso, con ✓ en los hechos. El
 * intervalo entre sets cuenta como el paso del partido.
 * @param {string} current pantalla actual (details, rosters, toss, live, break o final)
 * @returns {Markup} marcado HTML
 */
export function stepper(current) {
    const active = current === "break" ? "live" : current
    const at = STEPS.findIndex((step) => step.key === active)
    const items = STEPS.map(({ label }, index) => {
        let state = ""
        if (index === at) {
            state = "stepper-current"
        } else if (index < at) {
            state = "stepper-done"
        }
        const marker = index < at ? "✓" : index + 1
        const aria = index === at ? raw(" aria-current=\"step\"") : null
        return html`<li class="${state}"${aria}><span class="stepper-num" aria-hidden="true">${
            marker}</span><span class="stepper-label">${label}</span></li>`
    })
    return html`<ol class="stepper" aria-label="Progreso del acta">${items}</ol>`
}

/**
 * Barra de acciones fija al pie de cada paso.
 * @param {Markup} buttons botones ya montados
 * @returns {Markup} marcado HTML
 */
export function actionDock(buttons) {
    return html`<div class="action-dock"><div class="hstack">${buttons}</div></div>`
}

/**
 * Puntos de tiempos o cambios gastados, con su lectura para lectores de pantalla.
 * @param {{used: number, max: number, label: string}} model gastados, máximo y rótulo
 * @returns {Markup} marcado HTML
 */
export function usageDots({ used, max, label }) {
    const pips = []
    for (let index = 0; index < max; index += 1) {
        pips.push(html`<i class="${index < used ? "pip-lit" : ""}"></i>`)
    }
    return html`<span class="pips" role="img" aria-label="${label}: ${used} de ${max}">${
        pips}</span>`
}

/**
 * Pareja de botones de opción con el nombre de cada equipo.
 * @param {{name: string, selected?: string, info: object}} model nombre del grupo, lado
 *     marcado y datos del encuentro
 * @returns {Markup} marcado HTML
 */
export function sidePicker({ name, selected, info }) {
    const options = ["home", "away"].map((side) => {
        const checked = selected === side ? raw(" checked") : null
        return html`<label><input type="radio" name="${name}" value="${side}"${checked}><span>${
            teamLabel(info, side)}</span></label>`
    })
    return html`<div class="pills" role="radiogroup">${options}</div>`
}

/**
 * Casilla de una firma: rótulo, imagen y firmante si ya está, y el botón para firmar.
 * @param {string} slot casilla
 * @param {object|undefined} signature firma guardada
 * @returns {Markup}
 */
function signatureCell(slot, signature) {
    const title = SIGNER_LABELS[slot]
    let body = html`<div class="fine dim" style="margin:6px 0">Falta la firma</div>`
    let action = "Firmar"
    if (signature) {
        body = html`<img src="${signature.image}" alt="Firma de ${title}"><div class="fine dim">${
            signature.signer} · ${clockTime(signature.at)}</div>`
        action = "Repetir firma"
    }
    const button = html`<button type="button" data-sign-slot="${slot}" data-sign-label="${
        title}">${action}</button>`
    return html`<div class="sign-cell"><b class="fine">${title}</b>${body}${button}</div>`
}

/**
 * Rejilla de casillas de firma.
 * @param {{slots: string[], signatures: object}} model casillas en orden y firmas del partido
 * @returns {Markup} marcado HTML
 */
export function signatureGrid({ slots, signatures }) {
    const cells = slots.map((slot) => signatureCell(slot, signatures[slot]))
    return html`<div class="sign-grid">${cells}</div>`
}

/**
 * Fila de un set en la tabla de resultados.
 * @param {object} row fila del resumen
 * @returns {Markup}
 */
function resultRow(row) {
    const { home, away } = row
    return html`<tr><td>${row.period}</td><td>${row.minutes ?? ""}</td><td><b>${
        home.points}</b></td><td class="fine dim">TD ${home.timeouts} · S ${
        home.substitutions}</td><td><b>${away.points}</b></td><td class="fine dim">TD ${
        away.timeouts} · S ${away.substitutions}</td></tr>`
}

/**
 * Línea del golden set bajo la tabla, si se ha jugado.
 * @param {object|null} golden resumen del golden set
 * @param {object} info datos del encuentro
 * @returns {Markup|null}
 */
function goldenLine(golden, info) {
    if (!golden) {
        return null
    }
    const winner = golden.winner ? `ganador: ${teamLabel(info, golden.winner) ?? ""} · ` : ""
    const length = golden.minutes !== null && golden.minutes !== undefined
        ? ` · ${golden.minutes} min`
        : ""
    const score = `${info.homeName ?? ""} ${golden.points.home} – ${golden.points.away} ${
        info.awayName ?? ""}`
    return html`<p><b>Golden set</b>: ${winner + score + length}</p>`
}

/**
 * Tabla de resultados por set con totales, horas del partido y, si lo hubo, el golden set.
 * @param {{summary: object, info: object}} model resumen del motor y datos del encuentro
 * @returns {Markup} marcado HTML
 */
export function resultsTable({ summary, info }) {
    const { totals } = summary
    const times = `Comienzo ${clockTime(summary.startedAt)} · final ${clockTime(summary.endedAt)}`
    const span = ` · el partido ha durado ${summary.matchMinutes ?? ""} min.`
    const head = html`<thead><tr><th>Set</th><th>Min.</th><th colspan="2">${
        info.homeName}</th><th colspan="2">${info.awayName}</th></tr></thead>`
    const total = html`<tr><td><b>Total</b></td><td>${totals.minutes}</td><td><b>${
        totals.home.won}</b></td><td></td><td><b>${totals.away.won}</b></td><td></td></tr>`
    return html`<table class="grid-table">${head}<tbody>
    ${summary.rows.map(resultRow)}
    ${total}</tbody></table>
    <p class="fine dim">${times + span}</p>
    ${goldenLine(summary.golden, info)}`
}

/**
 * Cabecera de un diálogo: el título y, si el diálogo es de un equipo, su nombre encima con su
 * color. El nombre va dentro del título para que también forme parte del nombre accesible del
 * diálogo.
 * @param {{title: string, team?: string, tint?: string}} model título, equipo y su color
 * @returns {Markup} marcado HTML
 */
export function dialogHead({ title, team, tint }) {
    let kicker = null
    if (team) {
        const swatch = tint
            ? html`<span class="swatch" style="background:${tint}" aria-hidden="true"></span>`
            : null
        kicker = html`<span class="sheet-team">${swatch}${team}</span> `
    }
    const style = tint ? raw(` style="--team:${escapeHtml(tint)}"`) : null
    return html`<header class="sheet-head${tint ? " sheet-head--team" : ""}"${style}><h2 ${
        ""}id="dlg-title">${kicker}<span class="sheet-title">${title}</span></h2></header>`
}

/**
 * Pie de un diálogo con sus botones; en el móvil queda pegado abajo.
 * @param {Markup} buttons botones ya montados
 * @returns {Markup} marcado HTML
 */
export function dialogFoot(buttons) {
    return html`<div class="sheet-foot">${buttons}</div>`
}
