/**
 * Sorteo y formación inicial, y el selector de formación que también usa el intervalo entre
 * sets. Función pura: recibe un modelo y devuelve marcado; no lee estado global.
 *
 * Los saltos de línea y las sangrías de las plantillas forman nodos de texto que el diferencial
 * de DOM compara uno a uno: no se reformatean.
 * @module src/app/views/toss.view.js
 */

import { html, raw } from "../dom.js"
import { COURT_ORDER, ZONE_NUMERALS } from "../constants.js"
import { actionDock, sidePicker, stepper, teamLabel } from "./common.view.js"

/**
 * Avisos al empezar un set desde el sorteo o desde el intervalo.
 */
export const TOSS_TEXT = Object.freeze({
    missingToss: "Completa el sorteo: saque y lado izquierdo.",
    missingLineup: (team) => `La formación inicial de ${team} está incompleta.`,
})

/**
 * Rótulo de cada lado en la cabecera de su tarjeta.
 */
const SIDE_BADGES = Object.freeze({ home: "Local", away: "Visitante" })

/**
 * Selector de formación de un equipo: seis desplegables colocados como en la pista, con la red
 * arriba (delanteros IV, III y II; zagueros V, VI e I). Los desplegables salen vacíos: las
 * opciones las pone la pantalla, porque dependen de lo elegido en los demás. La formación
 * previa, si la hay, viaja en data-prefill hasta entonces.
 * @param {{side: string, prefill?: Array<string|null>}} model lado y formación previa
 * @returns {Markup} marcado HTML
 */
export function lineupPicker({ side, prefill }) {
    const slots = []
    for (const zone of COURT_ORDER.mini) {
        const serve = zone === 0 ? raw(" class=\"lineup-serve\"") : null
        slots.push(html`<label${serve}><span>${ZONE_NUMERALS[zone]}</span><select data-zone="${
            zone}" data-prefill="${prefill?.[zone] || ""}"></select></label>`)
    }
    const net = html`<div class="half-court-net" aria-hidden="true">Red</div>`
    const hint = "La red queda arriba. La zona I (zaguero derecho) es la del saque."
    return html`<div class="half-court">${net}<div class="lineup-grid" data-lineup-side="${
        side}">${slots}</div></div>
    <p class="fine dim" style="margin:8px 0 0">${hint}</p>`
}

/**
 * Opciones de un desplegable de formación: la vacía y los jugadores disponibles, con (C) en el
 * capitán y solo el nombre de pila.
 * @param {{players: object[], chosen: string}} model jugadores que pueden salir y dorsal elegido
 * @returns {Markup} marcado HTML
 */
export function lineupOptions({ players, chosen }) {
    const items = []
    for (const player of players) {
        const selected = player.shirt === chosen ? raw(" selected") : null
        const badge = player.captain ? " (C)" : ""
        const first = player.name.split(" ")[0] || ""
        items.push(html`<option value="${player.shirt}"${selected}>${
            player.shirt + badge + " " + first}</option>`)
    }
    return html`<option value=""></option>${items}`
}

/**
 * Tarjeta de formación de un equipo en el sorteo.
 * @param {object} info datos del encuentro
 * @param {{side: string, tint: string, prefill?: Array<string|null>}} team lado, color y
 *     formación previa
 * @returns {Markup}
 */
function lineupCard(info, { side, tint, prefill }) {
    const head = html`<div class="roster-head"><h2>${teamLabel(info, side)}</h2><span ${
        ""}class="badge">${SIDE_BADGES[side]}</span></div>`
    return html`<section class="panel roster-panel" style="--team-tint:${tint}">${head}${
        lineupPicker({ side, prefill })}</section>`
}

/**
 * Pantalla del sorteo: quién saca y quién queda a la izquierda del anotador, el acceso a la no
 * presentación y la formación inicial de los dos equipos.
 * @param {{info: object, server?: string, left?: string, teams: object[]}} model datos del
 *     encuentro, sorteo ya marcado y las dos tarjetas de formación
 * @returns {Markup} marcado HTML
 */
export function tossView({ info, server, left, teams }) {
    const serveSet = html`<fieldset><legend>Primer saque</legend>${
        sidePicker({ name: "server", selected: server, info })}</fieldset>`
    const leftSet = html`<fieldset><legend>Equipo A: a la izquierda del anotador</legend>${
        sidePicker({ name: "left", selected: left, info })}</fieldset>`
    const noShow = html`<button class="quiet" id="no-show" style="min-height:32px;padding:0 4px">${
        "Incomparecencia…"}</button>`
    const back = html`<button class="quiet" id="go-back">Atrás</button>`
    const start = html`<button class="cta" id="start-period">Comenzar set 1</button>`
    const question = html`<p class="fine dim" style="margin:4px 0 0">${
        "¿Falta algún equipo? "}${noShow}</p>`
    return html`${stepper("toss")}<section class="panel"><h2>Sorteo</h2>
      <div class="cols-2">${serveSet}
      ${leftSet}</div>
      ${question}</section>
    <h2 class="section-title">Formación inicial</h2>
    <div class="duo duo--compact">${teams.map((team) => lineupCard(info, team))}</div>
    ${actionDock(html`${back}${start}`)}`
}
