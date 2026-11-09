/**
 * Vista del diálogo del líbero, en sus dos formas: con el líbero en pista (sale, se reemplaza o
 * queda impedido) y sin él (qué líbero entra y por qué zaguero).
 * @module src/app/views/dialogs/libero.view.js
 */

import { escapeHtml, html, raw } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Aviso cuando el equipo no tiene ningún líbero que pueda jugar.
 * @param {string} team nombre del equipo
 * @returns {string}
 */
export function noLiberoText(team) {
    return `${team} no tiene ningún líbero disponible.`
}

/**
 * Botón de cancelar común a las dos formas.
 */
const CANCEL = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`

/**
 * Forma con el líbero en pista: quién está y las tres salidas posibles como opciones grandes.
 * @param {{team: string, tint?: string, libero: string, replacing: string,
 *     other: string|null}} model nombre y color del equipo, líbero en pista, jugador por el que
 *     está y el otro líbero si lo hay
 * @returns {Markup}
 */
function onCourtForm({ team, tint, libero, replacing, other }) {
    const swap = other === null
        ? null
        : html`<button type="button" class="sheet-option" id="libero-swap">${
            "Cambiar por el otro líbero ("}${other})</button>`
    const leave = html`<button type="button" class="cta sheet-option" id="libero-leave">${
        "Sacar al líbero; vuelve el "}${replacing}</button>`
    const unfit = html`<button type="button" class="sheet-option" id="libero-unfit">${
        "Incapacitado para jugar…"}</button>`
    return html`${dialogHead({ title: "Líbero", team, tint })}<p class="sheet-lead">${
        `Está en pista el ${libero}, en lugar del ${replacing}.`}</p><div class="sheet-options">${
        leave}${swap}${unfit}</div>${dialogFoot(CANCEL)}`
}

/**
 * Forma sin el líbero en pista: elección de líbero si hay más de uno y zagueros por los que
 * puede entrar, desactivados con el motivo si el reglamento no lo deja.
 * @param {{team: string, tint?: string, liberos: string[], libero: string,
 *     backs: Array<{shirt: string, zone: string, refusal: string|null}>}} model nombre y color
 *     del equipo, líberos, líbero elegido y zagueros
 * @returns {Markup}
 */
function entryForm({ team, tint, liberos, libero, backs }) {
    let picker = null
    if (liberos.length > 1) {
        const choices = liberos.map((shirt) => html`<button type="button" data-libero="${
            shirt}" aria-pressed="${String(libero === shirt)}">${shirt}</button>`)
        picker = html`<h3 class="sheet-label">Líbero</h3><div class="choice-grid" role="group" ${
            ""}aria-label="Líbero">${choices}</div>`
    }
    const options = backs.map((back) => {
        let refusal = null
        if (back.refusal) {
            refusal = raw(` disabled title="${escapeHtml(back.refusal)}"`)
        }
        return html`<button type="button" data-replacing="${back.shirt}"${refusal}>${
            back.shirt}<small>${back.zone}</small></button>`
    })
    const unfit = html`<button type="button" id="libero-unfit">Líbero incapacitado para jugar…</button>`
    return html`${dialogHead({ title: "Líbero", team, tint })}${picker}<h3 class="sheet-label">${
        "Reemplaza a (solo zagueros)"}</h3><div class="choice-grid" role="group" aria-label="${
        "Reemplaza a (solo zagueros)"}">${options}</div>${dialogFoot(html`${unfit}${CANCEL}`)}`
}

/**
 * Marcado del diálogo.
 * @param {object} model forma ("court" o "entry") y los datos de esa forma
 * @returns {Markup} marcado HTML
 */
export function liberoView(model) {
    if (model.form === "court") {
        return onCourtForm(model)
    }
    return entryForm(model)
}
