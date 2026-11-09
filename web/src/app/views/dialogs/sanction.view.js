/**
 * Vista del diálogo de sanciones: tipo, destinatario y lo que supone.
 * @module src/app/views/dialogs/sanction.view.js
 */

import { html, raw } from "../../dom.js"
import { SANCTION_LABELS } from "../../constants.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Grupos de niveles tal como se ofrecen, cada uno con su artículo del reglamento.
 */
const SANCTION_GROUPS = Object.freeze([
    {
        title: "Conducta incorrecta · FIVB 21",
        levels: ["warning", "penalty", "expulsion", "disqualification"],
    },
    { title: "Retrasos · FIVB 16", levels: ["delayWarning", "delayPenalty"] },
    { title: "Solicitudes improcedentes · FIVB 15.11", levels: ["improper"] },
])

/**
 * Rótulo del destinatario cuando la sanción va al equipo entero.
 */
export const TEAM_TARGET = "Equipo"

/**
 * Consecuencia que se explica bajo los botones según el nivel elegido.
 */
const CONSEQUENCES = Object.freeze({
    penalty: "El rival suma punto y saque.",
    delayPenalty: "El rival suma punto y saque.",
    expulsion: "No juega lo que queda de set; debe ser sustituido.",
    disqualification: "No juega lo que queda de partido; debe ser sustituido.",
    improper: "Queda registrada sin sanción; si el equipo reincide en el partido, se considera"
        + " retraso (FIVB 15.11.3).",
})

/**
 * Un grupo de niveles con su rótulo. Cada nivel lleva delante la marca de su tarjeta.
 * @param {{title: string, levels: string[]}} group grupo
 * @param {string|null} level nivel elegido
 * @returns {Markup}
 */
function levelGroup(group, level) {
    const buttons = group.levels.map((key) => html`<button type="button" class="choice-word" ${
        ""}data-level="${key}" aria-pressed="${String(level === key)}"><span class="card-chip ${
        ""}card-chip--${key}" aria-hidden="true"></span>${SANCTION_LABELS[key]}</button>`)
    return html`<h3 class="sheet-label">${group.title}</h3><div class="choice-grid" role="group" ${
        ""}aria-label="${group.title}">${buttons}</div>`
}

/**
 * Marcado del diálogo.
 * @param {{team: string, tint?: string, level: string|null, target: string|null,
 *     targets: Array<{key: string, label: string}>}} model nombre y color del equipo, nivel y
 *     destinatario elegidos y destinatarios posibles para ese nivel
 * @returns {Markup} marcado HTML
 */
export function sanctionView({ team, tint, level, target, targets }) {
    let whom = null
    if (level) {
        const buttons = targets.map((option) => html`<button type="button" class="choice-word" ${
            ""}data-target="${option.key}" aria-pressed="${
            String(String(target) === String(option.key))}">${option.label}</button>`)
        whom = html`<div class="sheet-step"><h3 class="sheet-label">Sancionado</h3><div ${
            ""}class="choice-grid" role="group" aria-label="Sancionado">${buttons}</div></div>`
    }
    const blocked = !level || target === null || target === undefined ? raw(" disabled") : null
    const consequence = CONSEQUENCES[level]
        ? html`<p class="sheet-consequence">${CONSEQUENCES[level]}</p>`
        : null
    const buttons = html`<button type="button" class="cta" id="confirm"${blocked}>Registrar</button>${
        raw("<button type=\"button\" class=\"quiet\" data-dismiss>Cancelar</button>")}`
    return html`${dialogHead({ title: "Sanción", team, tint })}${
        SANCTION_GROUPS.map((group) => levelGroup(group, level))}${whom}${consequence}${
        dialogFoot(buttons)}`
}
