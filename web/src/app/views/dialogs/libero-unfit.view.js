/**
 * Vista del diálogo del líbero incapacitado para jugar (FIVB 19.4).
 * @module src/app/views/dialogs/libero-unfit.view.js
 */

import { html } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Avisos al confirmar: con redesignación o sin ella.
 */
export const UNFIT_TEXT = Object.freeze({
    redesignated: (shirt) => `El ${shirt} pasa a ser líbero.`,
    noted: "Registrado.",
})

/**
 * Explicación fija bajo el título.
 */
const LEAD = html`<p class="sheet-lead">${"Por lesión, enfermedad, expulsión, descalificación o"
    + " decisión del entrenador (FIVB 19.4.1). Un líbero incapacitado no puede volver a jugar en este"
    + " partido."}</p>`

/**
 * Aclaración junto al rótulo de la redesignación.
 */
const SUCCESSOR_HINT = "(cualquier jugador fuera de la pista, o nadie para seguir sin líbero)"

/**
 * Qué pasa después: sigue el otro líbero o se elige a quién redesignar (o a nadie).
 * @param {string|null} remaining otro líbero que sigue, si lo hay
 * @param {string[]} candidates jugadores que se pueden redesignar
 * @param {string|null} successor redesignado elegido
 * @returns {Markup}
 */
function aftermath(remaining, candidates, successor) {
    if (remaining !== null) {
        return html`<p class="banner banner--good fine">Queda disponible el otro líbero, el ${
            remaining}.</p>`
    }
    const options = candidates.map((shirt) => html`<button type="button" data-successor="${
        shirt}" aria-pressed="${String(successor === shirt)}">${shirt}</button>`)
    const none = html`<button type="button" class="choice-word" data-successor="" aria-pressed="${
        String(successor === null)}">Nadie</button>`
    return html`<h3 class="sheet-label">Nuevo líbero (re-designación)</h3><p class="reason">${
        SUCCESSOR_HINT}</p><div class="choice-grid" role="group" aria-label="${
        "Nuevo líbero (re-designación)"}">${none}${options}</div>`
}

/**
 * Marcado del diálogo.
 * @param {{team: string, tint?: string, liberos: string[], unfit: string|undefined,
 *     remaining: string|null, candidates: string[], successor: string|null}} model nombre y
 *     color del equipo, líberos que pueden quedar impedidos, el elegido, el otro que seguiría,
 *     candidatos a redesignar y el redesignado elegido
 * @returns {Markup} marcado HTML
 */
export function liberoUnfitView(model) {
    const choices = model.liberos.map((shirt) => html`<button type="button" data-unfit="${
        shirt}" aria-pressed="${String(model.unfit === shirt)}">${shirt}</button>`)
    const buttons = html`<button type="button" class="cta" id="confirm">Confirmar</button>${
        html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`}`
    const head = dialogHead({ title: "Líbero incapacitado", team: model.team, tint: model.tint })
    return html`${head}${LEAD}<h3 class="sheet-label">Líbero</h3><div class="choice-grid" role="group" ${
        ""}aria-label="Líbero">${choices}</div>${aftermath(model.remaining, model.candidates,
        model.successor)}${dialogFoot(buttons)}`
}
