/**
 * Vista del diálogo: reapertura de un acta cerrada.
 * @module src/app/views/dialogs/reopen.view.js
 */

import { html, raw } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Campo de la clave: oculta, con teclado numérico y sin que el navegador la recuerde.
 */
const PIN_INPUT = raw("<input type=\"password\" id=\"reopen-pin\" inputmode=\"numeric\" "
    + "autocomplete=\"off\">")

/**
 * Marcado del diálogo de reapertura: aviso de que queda anotado, clave del primer árbitro y
 * botones. No necesita datos.
 * @returns {Markup} marcado HTML
 */
export function reopenView() {
    const field = html`<label class="field"><span>Contraseña del 1er árbitro</span>${
        PIN_INPUT}</label>`
    const confirm = html`<button type="button" class="cta" id="reopen-ok">Reabrir</button>`
    const cancel = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`
    const notice = html`<p class="sheet-lead">La reapertura constará en las correcciones del acta.</p>`
    return html`${dialogHead({ title: "Reapertura del acta" })}${notice}${field}${
        dialogFoot(html`${confirm}${cancel}`)}`
}
