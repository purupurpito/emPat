/**
 * Vista del acta para imprimir. Función pura: recibe un modelo y devuelve marcado; no lee
 * estado global.
 * @module src/app/views/paper.view.js
 */

import { html, raw } from "../dom.js"

/**
 * Cómo imprimir el acta oficial para que salga a tamaño real.
 */
const OFFICIAL_HINT = "Modelo FCVB en A4 horizontal. Imprime sin márgenes y al 100 % (tamaño "
    + "real)."

/**
 * Formatos de la vista, en el orden de los botones.
 */
const STYLES = Object.freeze([
    { value: "official", label: "Acta FCVB" },
    { value: "digest", label: "Resumen" },
])

/**
 * Botón de un formato.
 * @param {{value: string, label: string}} style formato
 * @param {string} chosen formato elegido
 * @returns {Markup}
 */
function styleOption({ value, label }, chosen) {
    const checked = value === chosen ? raw(" checked") : ""
    return html`<label><input type="radio" name="paper-style" value="${value}"${
        checked}><span>${label}</span></label>`
}

/**
 * Barra de la vista, en tinta y pegada arriba: volver, elegir entre el acta oficial y el
 * resumen, e imprimir. Con el acta oficial añade debajo cómo imprimirla.
 * @param {{official: boolean}} model si se está viendo el acta oficial
 * @returns {Markup} marcado HTML
 */
export function paperView({ official }) {
    const chosen = official ? "official" : "digest"
    const options = STYLES.map((style) => styleOption(style, chosen))
    const hint = official ? html`<p class="paper-hint">${OFFICIAL_HINT}</p>` : ""
    const back = html`<button type="button" class="paper-back" id="close-paper"><span ${
        ""}aria-hidden="true">←</span><span>Volver</span></button>`
    const print = html`<button type="button" class="cta" id="print-now">${
        "Imprimir o exportar a PDF"}</button>`
    return html`<div class="paper-bar">${back}<span class="pills" role="radiogroup" ${
        ""}aria-label="Formato">${options}</span>${print}</div>${hint}`
}

/**
 * Envoltorio del acta oficial, que en pantalla se escala para que quepa a lo ancho.
 * @param {string} sheet marcado de las páginas, ya generado por el módulo del acta
 * @returns {Markup} marcado HTML
 */
export function officialPaper(sheet) {
    return html`<div class="paper-zoom">${raw(sheet)}</div>`
}
