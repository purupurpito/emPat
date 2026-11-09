/**
 * Vista del diálogo de sustitución: quién sale, quién entra y si es excepcional. Los dos grupos
 * de fichas van uno encima del otro con una flecha entre ellos, y el contador de sustituciones
 * del set se lee en la cabecera.
 * @module src/app/views/dialogs/substitution.view.js
 */

import { escapeHtml, html, raw } from "../../dom.js"
import { shortLabel } from "../../format.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Texto que se da por motivo mientras no se ha elegido quién sale.
 */
export const PICK_LEAVING_FIRST = "Antes selecciona al jugador que sale."

/**
 * Rótulo de la casilla de sustitución excepcional (FIVB 15.7), con el espacio que la separa.
 */
const EXCEPTIONAL_LABEL = " Sustitución excepcional: por lesión, enfermedad, expulsión o"
    + " descalificación cuando no cabe una sustitución regular"

/**
 * Botón de cancelar.
 */
const CANCEL = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`

/**
 * Botón de un suplente; si no puede entrar queda desactivado y el motivo va en el título.
 * @param {{shirt: string, name: string, blocker: string|null}} option suplente
 * @param {string|null} entering suplente elegido
 * @returns {Markup}
 */
function benchButton(option, entering) {
    let refusal = null
    if (option.blocker) {
        refusal = raw(` disabled title="${escapeHtml(option.blocker)}"`)
    }
    const caption = option.name ? html`<small>${shortLabel(option.name)}</small>` : null
    return html`<button type="button" data-entering="${option.shirt}" aria-pressed="${
        String(entering === option.shirt)}"${refusal}>${option.shirt}${caption}</button>`
}

/**
 * Marcado del diálogo.
 * @param {{team: string, tint?: string, used: number, limit: number, court: string[],
 *     leaving: string|null, bench: object[], entering: string|null, exceptional: boolean,
 *     stuck: boolean}} model nombre y color del equipo, cambios gastados y máximo, jugadores
 *     que pueden salir, suplentes con su motivo de bloqueo, elecciones hechas y si nadie puede
 *     entrar por el elegido con un cambio regular
 * @returns {Markup} marcado HTML
 */
export function substitutionView(model) {
    const { leaving, entering } = model
    const outgoing = model.court.map((shirt) => html`<button type="button" data-leaving="${
        shirt}" aria-pressed="${String(leaving === shirt)}">${shirt}</button>`)
    let incoming = html`<span class="fine dim">El banquillo está vacío.</span>`
    if (model.bench.length) {
        incoming = model.bench.map((option) => benchButton(option, entering))
    }
    let stuck = null
    if (model.stuck) {
        stuck = html`<p class="reason">Ningún suplente puede relevar al ${
            leaving} con una sustitución regular.</p>`
    }
    const checked = model.exceptional ? raw(" checked") : null
    const blocked = leaving === null || entering === null ? raw(" disabled") : null
    const confirm = html`<button type="button" class="cta" id="confirm"${
        blocked}>Confirmar sustitución</button>`
    return html`${dialogHead({ title: "Sustitución", team: model.team, tint: model.tint })}<p ${
        ""}class="sheet-lead">Sustituciones usadas en el set: ${model.used} de ${model.limit}.</p><div ${
        ""}class="swap"><div class="swap-step swap-step--out"><h3 class="sheet-label">Sale</h3><div ${
        ""}class="choice-grid" role="group" aria-label="Sale">${outgoing}</div></div><div ${
        ""}class="swap-step swap-step--in"><h3 class="sheet-label">Entra</h3><div ${
        ""}class="choice-grid" role="group" aria-label="Entra">${incoming}</div>${stuck}</div></div><label ${
        ""}class="sheet-check">${raw("<input type=\"checkbox\" id=\"sub-exceptional\"")}${
        checked}><span>${EXCEPTIONAL_LABEL}</span></label>${dialogFoot(html`${confirm}${CANCEL}`)}`
}
