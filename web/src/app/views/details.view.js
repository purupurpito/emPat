/**
 * Datos del partido: encuentro, equipos, árbitros y formato. Función pura: recibe un modelo y
 * devuelve marcado; no lee estado global.
 *
 * Los saltos de línea y las sangrías de las plantillas forman nodos de texto que el diferencial
 * de DOM compara uno a uno: no se reformatean.
 * @module src/app/views/details.view.js
 */

import { escapeHtml, html, raw } from "../dom.js"
import { actionDock, stepper } from "./common.view.js"

/**
 * Avisos de la pantalla de datos.
 */
export const DETAILS_TEXT = Object.freeze({
    missingTeams: "Faltan los nombres de los equipos.",
})

/**
 * Rótulo de cada bloque de equipo.
 */
const SIDE_TITLES = Object.freeze({ home: "Local", away: "Visitante" })

/**
 * Campo de texto ligado a una clave de los datos del encuentro.
 * @param {object} info datos del encuentro
 * @param {string} key clave en info
 * @param {string} label rótulo
 * @param {{type?: string, attrs?: Markup}} [options] tipo del input y atributos extra
 * @returns {Markup}
 */
function infoField(info, key, label, { type = "text", attrs = null } = {}) {
    return html`<label class="field"><span>${label}</span><input type="${type}" data-info="${
        key}" value="${info[key] || ""}" ${attrs}></label>`
}

/**
 * Atributos de los campos de licencia: teclado numérico en el móvil.
 */
const NUMERIC = raw("inputmode=\"numeric\"")

/**
 * Bloque de un equipo: nombre, abreviatura y los colores de camiseta y de líbero, con la franja
 * pintada del color del equipo.
 * @param {object} info datos del encuentro
 * @param {{side: string, codeHint: string, shirt: string, libero: string}} team lado,
 *     abreviatura propuesta y colores ya resueltos
 * @returns {Markup}
 */
function teamBox(info, { side, codeHint, shirt, libero }) {
    const code = infoField(info, side + "Code", "Abreviatura", {
        attrs: raw(`maxlength="4" placeholder="${escapeHtml(codeHint)}"`),
    })
    const swatch = (key, label, value) => html`<label class="field field--color"><span>${
        label}</span><input type="color" data-info="${key}" value="${value}"></label>`
    return html`<div class="team-box" style="--team-tint:${shirt}"><h3>${SIDE_TITLES[side]}</h3>
    ${infoField(info, side + "Name", "Nombre del equipo")}
    <div class="team-box-row">${code}
      ${swatch(side + "Color", "Color", shirt)}
      ${swatch(side + "LiberoColor", "Líbero", libero)}</div></div>`
}

/**
 * Tarjeta del encuentro: competición, número, fecha, hora y lugar.
 * @param {object} info datos del encuentro
 * @returns {Markup}
 */
function matchCard(info) {
    const pair = html`${infoField(info, "competition", "Competición")}${
        infoField(info, "category", "Categoría")}`
    const when = html`${infoField(info, "matchNo", "Nº de partido")}${
        infoField(info, "date", "Fecha", { type: "date" })}${
        infoField(info, "time", "Hora", { type: "time" })}`
    const where = html`${infoField(info, "venue", "Pabellón")}${
        infoField(info, "town", "Población")}`
    return html`<section class="panel"><h2>Encuentro</h2>
      <div class="cols-2">${pair}</div>
      <div class="cols-3">${when}</div>
      <div class="cols-2">${where}</div></section>`
}

/**
 * Tarjeta de los equipos.
 * @param {object} info datos del encuentro
 * @param {object[]} teams los dos bloques de equipo
 * @returns {Markup}
 */
function teamsCard(info, teams) {
    const note = "Si dejas la abreviatura vacía, se usa la propuesta (lista FCVB 26-27)."
    return html`<section class="panel"><h2>Equipos</h2>
      <div class="team-boxes">${teams.map((team) => teamBox(info, team))}</div>
      <p class="fine dim" style="margin:10px 0 0">${note}</p></section>`
}

/**
 * Tarjeta de árbitros y mesa: los tres con licencia van en parejas nombre-licencia.
 * @param {object} info datos del encuentro
 * @returns {Markup}
 */
function officialsCard(info) {
    const people = { referee1: "1er árbitro", referee2: "2º árbitro", scorer: "Anotador" }
    const licensed = []
    for (const [key, label] of Object.entries(people)) {
        licensed.push(html`${infoField(info, key, label)}${
            infoField(info, key + "Licence", "Licencia", { attrs: NUMERIC })}`)
    }
    const others = html`${infoField(info, "assistantScorer", "Anotador asistente")}${
        infoField(info, "lineJudge1", "Juez de línea 1")}${
        infoField(info, "lineJudge2", "Juez de línea 2")}`
    return html`<section class="panel"><h2>Equipo arbitral</h2>
      <div class="pairs">${licensed}</div>
      <div class="cols-3">${others}</div></section>`
}

/**
 * Campo numérico de un ajuste. El valor se escribe tal cual, también si falta (como texto
 * "undefined"), porque así lo deja el formulario y el navegador lo muestra vacío.
 * @param {{id: string, label: string, min: number, max: number, value: unknown, hint?: string}}
 *     spec definición del campo
 * @returns {Markup}
 */
function numberField({ id, label, min, max, value, hint }) {
    let help = null
    if (hint) {
        help = html`<span class="field-hint">${hint}</span>`
    }
    return html`<label class="field"><span>${label}</span><input type="number" id="${id}" min="${
        min}" max="${max}" value="${String(value)}">${help}</label>`
}

/**
 * Casilla de una opción del formato, con título y explicación.
 * @param {{id: string, on: boolean, title: string, text: string}} spec definición
 * @returns {Markup}
 */
function optionRow({ id, on, title, text }) {
    const checked = on ? raw(" checked") : null
    return html`<label class="check option-row"><input type="checkbox" id="${id}"${checked}> ${
        html`<span><b>${title}</b><br><span class="fine dim">${text}</span></span>`}</label>`
}

/**
 * Desplegable del número de sets.
 * @param {unknown} bestOf ajuste actual
 * @returns {Markup}
 */
function bestOfField(bestOf) {
    const choices = new Map()
    choices.set(5, "5 (gana el primero en llegar a 3)")
    choices.set(3, "3 (gana el primero en llegar a 2)")
    const options = []
    for (const [value, text] of choices) {
        const selected = bestOf === value ? raw(" selected") : null
        options.push(html`<option value="${value}"${selected}>${text}</option>`)
    }
    return html`<label class="field"><span>Número de sets</span><select id="opt-best-of">${
        options}</select></label>`
}

/**
 * Tarjeta del formato: sets, puntos, cambios, tiempos, intervalos y opciones. Los intervalos
 * sin ajuste propio valen 3 minutos, y el del 2º al 3º hereda el general.
 * @param {object} settings ajustes del acta, tal como están guardados
 * @returns {Markup}
 */
function formatCard(settings) {
    const numbers = [
        {
            id: "opt-set-points",
            label: "Puntos para ganar un set",
            min: 5,
            max: 50,
            value: settings.setPoints,
        },
        {
            id: "opt-decider-points",
            label: "Puntos en el set decisivo",
            min: 5,
            max: 50,
            value: settings.deciderPoints,
        },
        {
            id: "opt-subs",
            label: "Sustituciones en cada set",
            min: 1,
            max: 20,
            value: settings.substitutions,
        },
        {
            id: "opt-timeouts",
            label: "Tiempos de descanso en cada set",
            min: 0,
            max: 5,
            value: settings.timeouts,
        },
        {
            id: "opt-break",
            label: "Minutos de intervalo entre sets",
            min: 0,
            max: 30,
            value: settings.breakMinutes ?? 3,
        },
        {
            id: "opt-second-break",
            label: "Minutos de intervalo tras el 2º set",
            min: 0,
            max: 10,
            value: settings.secondBreakMinutes ?? settings.breakMinutes ?? 3,
            hint: "Ampliable a 10 a petición del organizador (FIVB 18.1).",
        },
    ]
    const rows = numbers.map((spec) => html`
      ${numberField(spec)}`)
    const options = [
        {
            id: "opt-libero-prompt",
            on: settings.liberoPrompt !== false,
            title: "Ayuda con el líbero",
            text: "Cuando el equipo va a recibir, sugiere por quién puede entrar y, si acaba de"
                + " sacar el jugador al que reemplazaba, propone que vuelva; cuando le toca ir"
                + " delante, pide confirmar su salida.",
        },
        {
            id: "opt-liberos",
            on: Boolean(settings.liberoAllowed),
            title: "Se juega con líbero",
            text: "Desmárcalo si la categoría no usa líbero.",
        },
        {
            id: "opt-full-set",
            on: Boolean(settings.fullSetRule),
            title: "Set completo obligatorio",
            text: "Infantil (FCVB, Circular 011): todos los jugadores inscritos deben jugar como"
                + " mínimo un set entero. Se comprueba al final y admite correcciones manuales.",
        },
    ].map((spec) => html`
    ${optionRow(spec)}`)
    return html`<section class="panel"><h2>Reglas del partido</h2><div class="cols-2">
      ${bestOfField(settings.bestOf)}${rows}</div>
    <div class="option-list">${options}</div></section>`
}

/**
 * Pantalla de datos completa, dentro de su formulario.
 * @param {{info: object, settings: object, teams: object[]}} model datos y ajustes del acta y
 *     los dos bloques de equipo (lado, abreviatura propuesta y colores)
 * @returns {Markup} marcado HTML
 */
export function detailsView({ info, settings, teams }) {
    const back = html`<button type="button" class="quiet" id="back-home">Mis actas</button>`
    const next = html`<button class="cta">Continuar con los equipos</button>`
    const dock = actionDock(html`${back}${next}`)
    return html`${stepper("details")}<form id="details-form" class="details-form">
    ${matchCard(info)}
    ${teamsCard(info, teams)}
    ${officialsCard(info)}
    ${formatCard(settings)}
    ${dock}</form>`
}
