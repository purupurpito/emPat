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
