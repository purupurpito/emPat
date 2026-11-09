/**
 * Pantalla de error. Función pura: recibe un modelo y devuelve marcado; no lee estado global.
 * @module src/app/views/fatal.view.js
 */

import { html } from "../dom.js"

/**
 * Explicación según haya un acta abierta (que no se puede mostrar) o no (arranque fallido).
 * @param {boolean} withRecord hay acta abierta
 * @returns {string}
 */
function reasonText(withRecord) {
    const cause = withRecord
        ? "Esta versión de la aplicación no puede mostrar el acta."
        : "Algo ha fallado al cargar la aplicación."
    return cause + " No se ha perdido nada: los datos siguen en el dispositivo."
}

/**
 * Mensaje de error con salidas: reintentar, descargar los datos del acta abierta (si la hay) y
 * volver a la lista.
 * @param {{withRecord: boolean, detail: string}} model hay acta abierta y texto del error
 * @returns {Markup} marcado HTML
 */
export function fatalView({ withRecord, detail }) {
    const download = withRecord
        ? html`<button id="fatal-download">Descargar una copia del acta</button>`
        : null
    return html`<section class="panel" role="alert"><h2>Ha surgido un problema</h2>
    <p>${reasonText(withRecord)}</p>
    <p class="fine dim">${"Detalle del error: " + detail}</p>
    <div class="hstack"><button class="cta" id="fatal-retry">Reintentar</button>${
    download}<button class="quiet" id="fatal-home">Mis actas</button></div></section>`
}
