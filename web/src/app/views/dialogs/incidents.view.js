/**
 * Vista del diálogo de incidencias: falta de rotación (FIVB 7.7) y equipo incompleto o que se
 * retira (FIVB 6.4).
 * @module src/app/views/dialogs/incidents.view.js
 */

import { html, raw } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Textos que el controlador muestra al confirmar.
 */
export const INCIDENT_TEXT = Object.freeze({
    /**
     * Aviso tras anotar una falta de rotación, con los puntos anulados si los hubo.
     * @param {number} voided puntos anulados
     * @returns {string}
     */
    faultNoted(voided) {
        let detail = ""
        if (voided) {
            detail = ` (puntos anulados: ${voided})`
        }
        return `Falta de rotación registrada: punto para el rival${detail}.`
    },
    /**
     * Confirmación para dar a un equipo por incompleto.
     * @param {string} team nombre del equipo
     * @returns {string}
     */
    askShortHanded(team) {
        return `¿Confirmas que ${team} no puede continuar, por equipo incompleto o retirada? El partido terminará aquí.`
    },
})

/**
 * Lados en el orden en que se ofrecen.
 */
const SIDES = Object.freeze(["home", "away"])

/**
 * Ayuda bajo el campo de los puntos.
 */
const FAULT_HINT = "Los puntos que sumó desde ese momento se anulan (FIVB 7.7.2). Si lo dejas"
    + " vacío, solo se da punto y saque al rival."

/**
 * Explicación de la falta de rotación.
 */
const FAULT_NOTE = "El rival gana punto y saque, y el acta continúa con la rotación correcta."

/**
 * Campo de los puntos que tenía el infractor al cometer la falta.
 */
const FAULT_FIELD = html`<label class="field">${[
    html`<span>Marcador del equipo infractor al cometerla (si se conoce)</span>`,
    raw("<input type=\"number\" id=\"fault-from\" min=\"0\" inputmode=\"numeric\">"),
    html`<span class="field-hint">${FAULT_HINT}</span>`,
]}</label>`

/**
 * Explicación del equipo incompleto.
 */
const SHORT_HANDED_NOTE = "El rival se lleva los puntos y sets que le faltan y cada equipo mantiene"
    + " lo ganado hasta ahora. Solo se puede anular con Deshacer."

/**
 * Marcado del diálogo: dos tarjetas, una por incidencia, cada una con un botón por equipo. La
 * del equipo incompleto va en rojo porque acaba el partido.
 * @param {{names: {home: string, away: string}}} model nombre de cada equipo
 * @returns {Markup} marcado HTML
 */
export function incidentsView({ names }) {
    const faults = SIDES.map((side) => html`<button type="button" data-fault-side="${
        side}">La ha cometido ${names[side]}</button>`)
    const forfeits = SIDES.map((side) => html`<button type="button" class="danger" ${
        ""}data-forfeit-side="${side}">${names[side]} no puede seguir</button>`)
    const close = html`<button type="button" class="quiet" data-dismiss>Cerrar</button>`
    return html`${dialogHead({ title: "Incidencias" })}<section class="sheet-card"><h3 ${
        ""}class="sheet-card-title">Falta de rotación (o error de orden de saque)</h3><p class="fine dim">${
        FAULT_NOTE}</p>${FAULT_FIELD}<div class="sheet-row">${faults}</div></section><section ${
        ""}class="sheet-card sheet-card--danger"><h3 class="sheet-card-title">${
        "Equipo incompleto o retirada"}</h3><p class="fine dim">${
        SHORT_HANDED_NOTE}</p><div class="sheet-row">${forfeits}</div></section>${
        dialogFoot(close)}`
}
