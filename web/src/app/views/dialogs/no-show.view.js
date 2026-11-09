/**
 * Vista del diálogo de no presentación de un equipo.
 * @module src/app/views/dialogs/no-show.view.js
 */

import { html } from "../../dom.js"
import { dialogFoot, dialogHead, teamLabel } from "../common.view.js"

/**
 * Marcado del diálogo: la consecuencia reglamentaria y un botón por equipo.
 * @param {{info: object}} model datos del encuentro
 * @returns {Markup} marcado HTML
 */
export function noShowView({ info }) {
    const rule = "Si un equipo no comparece, pierde el partido por 0-3 y cada set por 0-25, y así"
        + " consta en el acta (FIVB 6.4)."
    const choices = ["home", "away"].map((side) => html`<button type="button" class="danger" ${
        ""}data-no-show-side="${side}">${(teamLabel(info, side) ?? "") + " no comparece"}</button>`)
    const cancel = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`
    return html`${dialogHead({ title: "Incomparecencia" })}<p class="sheet-lead">${rule}</p><div ${
        ""}class="sheet-options">${choices}</div>${dialogFoot(cancel)}`
}
