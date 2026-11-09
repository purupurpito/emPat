/**
 * Vista del diálogo: observaciones con frases hechas.
 *
 * El diálogo tiene tres partes: el desplegable de frases, las casillas que pide la frase
 * elegida (se rehacen al cambiarla) y el texto final, que se puede retocar a mano. Aquí están
 * también las piezas de texto con que se rellena una frase, porque son texto visible.
 * @module src/app/views/dialogs/remark.view.js
 */

import { html, raw } from "../../dom.js"
import { REMARK_TEMPLATES } from "../../data/remark-templates.js"
import { dialogFoot, dialogHead, teamLabel } from "../common.view.js"

/**
 * Marca de dato sin rellenar dentro de una frase.
 */
export const BLANK = "___"

/**
 * Avisos y preguntas del diálogo.
 */
export const REMARK_TEXT = Object.freeze({
    added: "Observación guardada en el acta.",
    askIncomplete: "Quedan huecos sin rellenar (___). ¿La añado así?",
})

/**
 * Cómo se nombra a un jugador dentro de una frase. Es igual en los dos idiomas, porque así lo
 * escribe la circular.
 */
const PLAYER_MENTION = "el/la jugador/a"

/**
 * Casilla de dorsales sueltos, escritos como se dirían.
 */
const SHIRTS_INPUT = html`<input type="text" data-field="shirts" placeholder="4, 7 y 9">`

/**
 * Casilla de minutos de retraso, con teclado numérico en el móvil.
 */
const MINUTES_INPUT = raw("<input type=\"number\" min=\"0\" inputmode=\"numeric\" "
    + "data-field=\"minutes\">")

/**
 * Texto final de la observación, con el mismo tope que admite el motor.
 */
const TEXT_AREA = raw("<textarea id=\"note-text\" maxlength=\"1000\"></textarea>")

/**
 * Casilla de texto o cifra de una plantilla, con su rótulo.
 * @param {string} field campo de la plantilla
 * @param {string|undefined} label rótulo propio de la plantilla
 * @returns {Markup}
 */
function freeInput(field, label) {
    const numeric = field === "count"
    const extra = numeric ? raw(" min=\"1\" inputmode=\"numeric\"") : ""
    return html`<label class="field"><span>${label || "Texto"}</span><input type="${
        numeric ? "number" : "text"}" data-field="${field}"${extra}></label>`
}

/**
 * Desplegable de equipo, con el elegido marcado.
 * @param {object} info datos del encuentro
 * @param {"home"|"away"|string} team lado elegido
 * @returns {Markup}
 */
function teamSelect(info, team) {
    const options = ["home", "away"].map((side) => {
        const selected = side === team ? raw(" selected") : ""
        return html`<option value="${side}"${selected}>${teamLabel(info, side)}</option>`
    })
    return html`<label class="field"><span>Equipo</span><select data-field="team">${
        options}</select></label>`
}

/**
 * Desplegable de jugador con la plantilla del equipo elegido.
 * @param {object[]} players jugadores del equipo
 * @returns {Markup}
 */
function playerSelect(players) {
    const options = players.map((player) => html`<option value="${player.shirt}">${
        player.shirt} · ${player.name || ""}</option>`)
    return html`<label class="field"><span>Jugador</span><select data-field="player">${
        options}</select></label>`
}

/**
 * Casilla de un campo de la plantilla.
 * @param {string} field campo
 * @param {object} model modelo de remarkFields
 * @returns {Markup}
 */
function fieldControl(field, { template, info, team, players }) {
    switch (field) {
        case "team":
            return teamSelect(info, team)
        case "player":
            return playerSelect(players)
        case "shirts":
            return html`<label class="field"><span>Dorsales</span>${SHIRTS_INPUT}</label>`
        case "minutes":
            return html`<label class="field"><span>Minutos de retraso</span>${
                MINUTES_INPUT}</label>`
        default:
            return freeInput(field, template.label)
    }
}

/**
 * Casillas que pide una plantilla, en su orden.
 * @param {{template: object, info: object, team: string, players: object[]}} model plantilla,
 *     datos del encuentro, lado elegido y jugadores de ese lado
 * @returns {Markup} marcado HTML
 */
export function remarkFields(model) {
    return html`${model.template.fields.map((field) => fieldControl(field, model))}`
}

/**
 * Pone en mayúscula la primera letra.
 * @param {string} word palabra
 * @returns {string}
 */
function capitalized(word) {
    return word[0].toUpperCase() + word.slice(1)
}

/**
 * Rellena una frase con los datos del diálogo. Cada hueco se sustituye una sola vez y en este
 * orden, con la sustitución de cadenas del lenguaje: así un dato que contenga otro hueco se
 * trata igual siempre. El marcador y el ordinal salen del set en juego si ya ha empezado; lo
 * que falta queda como ___. Si la frase empieza nombrando al jugador, la primera letra va en
 * mayúscula.
 * @param {{phrase: string, teamName: string|undefined, player: object|undefined,
 *     read: (field: string) => string, period: object, ordinal: string}} parts frase, nombre
 *     del equipo, jugador elegido, lectura de una casilla (ya con ___ si está vacía), set en
 *     juego y su ordinal
 * @returns {string}
 */
export function fillRemark({ phrase, teamName, player, read, period, ordinal }) {
    const started = Boolean(period.startedAt)
    let mention = BLANK
    if (player) {
        const name = player.name ? " (" + player.name + ")" : ""
        mention = `${PLAYER_MENTION} nº ${player.shirt}${name}`
    }
    const swaps = [
        ["{eq}", teamName],
        ["{jug}", mention],
        ["{jugs}", read("shirts")],
        ["{min}", read("minutes")],
        ["{n}", read("count")],
        ["{txt}", read("text")],
        ["{tanteo}", started ? `${period.score.home}-${period.score.away}` : BLANK],
        ["{set}", started ? ordinal : BLANK],
    ]
    let text = phrase
    for (const [hole, value] of swaps) {
        text = text.replace(hole, value)
    }
    return text.replace(/^el\/la/, capitalized)
}

/**
 * Marcado del diálogo de observación: frase hecha opcional, casillas de la frase y texto.
 * @param {{templates?: ReadonlyArray<object>}} [model] plantillas que se ofrecen
 * @returns {Markup} marcado HTML
 */
export function remarkView({ templates = REMARK_TEMPLATES } = {}) {
    const options = templates.map((entry, index) => html`<option value="${index}">${
        entry.title}</option>`)
    const picker = html`<select id="note-template"><option value="">— Texto libre —</option>${
        options}</select>`
    const save = html`<button type="button" class="cta" id="note-save">Guardar</button>`
    const cancel = html`<button type="button" class="quiet" data-dismiss>Cancelar</button>`
    const intro = "Para retrasos, incidencias, lesiones… Queda en el acta junto con la hora."
    return html`${dialogHead({ title: "Observación" })}<p class="sheet-lead">${intro}</p><label ${
        ""}class="field"><span>Frase tipo (FCVB, Circular 010)</span>${picker}</label><div ${
        ""}id="note-fields" class="cols-2"></div><label class="field"><span>Texto</span>${
        TEXT_AREA}</label>${dialogFoot(html`${save}${cancel}`)}`
}
