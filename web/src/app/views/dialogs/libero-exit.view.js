/**
 * Vista del aviso de salida automática del líbero al pasar a la delantera.
 * @module src/app/views/dialogs/libero-exit.view.js
 */

import { html } from "../../dom.js"
import { shortLabel } from "../../format.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Recordatorio del reglamento bajo los avisos.
 */
const RULE_NOTE = "Regresa el jugador al que reemplazaba, que es el único que puede ocupar su sitio"
    + " (aparte del otro líbero, que tampoco puede jugar en la zona delantera). FIVB 19.3.2."

/**
 * Explicación bajo la salida que confirma el anotador.
 */
const LEAVE_NOTE = "Al confirmarla, la salida queda apuntada en el acta con el marcador actual."
    + " Hasta entonces no se puede anotar el siguiente punto. FIVB 19.3.1.3."

/**
 * Párrafo y casilla de una salida: qué líbero sale y quién vuelve.
 * @param {{team: string, libero: string, back: string, backName: string}} exit salida
 * @returns {Markup}
 */
function exitBlock(exit) {
    const notice = html`<p class="sheet-lead"><b>${exit.team}</b>: el líbero ${
        exit.libero} rota a la zona IV y debe salir.</p>`
    const back = html`<span class="choice-static">${exit.back}<small>${
        shortLabel(exit.backName)}</small></span>`
    return html`<div class="exit-block">${notice}<h3 class="sheet-label">Entra</h3><div ${
        ""}class="choice-grid">${back}</div></div>`
}

/**
 * Marcado del aviso.
 * @param {{exits: object[]}} model salidas del líbero, con el equipo y quién vuelve
 * @returns {Markup} marcado HTML
 */
export function liberoExitView({ exits }) {
    const ok = html`<button type="button" class="cta" id="libero-exit-ok">De acuerdo</button>`
    return html`${dialogHead({ title: "Salida del líbero" })}${exits.map(exitBlock)}<p ${
        ""}class="fine dim">${RULE_NOTE}</p>${dialogFoot(ok)}`
}

/**
 * Marcado de la salida del líbero que el anotador tiene que confirmar: el líbero ha rotado a
 * la delantera y no se puede seguir hasta apuntar que vuelve el jugador al que reemplazaba.
 * @param {{team: string, tint: string, libero: string, back: string, backName: string}} model
 *     equipo, color, líbero que sale y jugador que vuelve
 * @returns {Markup} marcado HTML
 */
export function liberoLeaveView(model) {
    const lead = html`<p class="sheet-lead">El líbero ${model.libero} ha rotado a la zona IV y tiene que salir.</p>`
    const back = html`<span class="choice-static">${model.back}<small>${
        shortLabel(model.backName)}</small></span>`
    const body = html`<div class="exit-block">${lead}<h3 class="sheet-label">Entra</h3><div ${
        ""}class="choice-grid">${back}</div></div>`
    const hint = html`<p class="fine dim">${LEAVE_NOTE}</p>`
    const ok = html`<button type="button" class="cta" id="libero-leave-ok">Confirmar salida</button>`
    const later = html`<button type="button" class="quiet" id="libero-leave-later">Más tarde</button>`
    return html`${dialogHead({ title: "Salida del líbero", team: model.team, tint: model.tint })}${
        body}${hint}${dialogFoot(html`${ok}${later}`)}`
}

/**
 * Marcado de la propuesta de volver a meter al líbero: acaba de sacar el jugador al que había
 * reemplazado y su equipo ha perdido el saque, así que vuelve a ser zaguero en la zona I.
 * @param {{team: string, tint: string, libero: string, server: string}} model equipo, color,
 *     líbero que entraría y jugador que acaba de sacar
 * @returns {Markup} marcado HTML
 */
export function liberoReturnView(model) {
    const lead = html`<p class="sheet-lead">Ha sacado el ${model.server} y el equipo ha perdido el saque.</p>`
    const ask = html`<p class="sheet-lead"><b>¿Entra el líbero ${model.libero} por el ${
        model.server}?</b></p>`
    const ok = html`<button type="button" class="cta" id="libero-return-ok">Sí, entra el líbero</button>`
    const later = html`<button type="button" class="quiet" id="libero-return-later">Ahora no</button>`
    return html`${dialogHead({ title: "Vuelta del líbero", team: model.team, tint: model.tint })}${
        lead}${ask}${dialogFoot(html`${ok}${later}`)}`
}
