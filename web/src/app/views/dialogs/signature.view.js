/**
 * Vista del diálogo de firma: nombre de quien firma y lienzo para firmar con el dedo o el
 * ratón.
 * @module src/app/views/dialogs/signature.view.js
 */

import { html } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Avisos del diálogo de firma.
 */
export const SIGNATURE_TEXT = Object.freeze({
    emptyPad: "Falta la firma en el recuadro.",
    noName: "Falta el nombre de quien firma.",
})

/**
 * Medidas internas del lienzo en píxeles; en pantalla se escala al ancho disponible.
 */
const PAD_SIZE = Object.freeze({ width: 600, height: 200 })

/**
 * Marcado del diálogo de firma.
 * @param {{label: string, signer: string}} model rótulo de la casilla y nombre propuesto
 * @returns {Markup} marcado HTML
 */
export function signatureView({ label, signer }) {
    const pad = html`<canvas id="sig-pad" width="${PAD_SIZE.width}" height="${
        PAD_SIZE.height}" aria-label="Recuadro de firma"></canvas>`
    const save = html`<button type="button" class="cta" id="sig-save">Guardar</button>`
    const clear = html`<button type="button" id="sig-clear">Limpiar</button>`
    const cancel = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`
    const name = html`<input type="text" id="sig-name" value="${signer}">`
    return html`${dialogHead({ title: `Firma · ${label}` })}<label class="field"><span>Nombre</span>${
        name}</label><div class="sign-box">${pad}</div>${dialogFoot(html`${save}${clear}${cancel}`)}`
}
