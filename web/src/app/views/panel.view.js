/**
 * Consola de cada equipo durante el set y avisos del partido. La consola reúne la pista, las
 * cuatro acciones con sus contadores y, en pantalla ancha, el banquillo, las faltas de set
 * completo y las sanciones. Los avisos (sustitución obligada, capitán en juego y entrada del
 * líbero) van aparte, en una franja común a los dos equipos que siempre está a la vista.
 * Funciones puras: reciben el contexto del partido y devuelven marcado.
 * @module src/app/views/panel.view.js
 */

import { escapeHtml, html, raw } from "../dom.js"
import { playerNote, teamCourt } from "./court.view.js"
import { colorVars, teamColor } from "../colors.js"
import { teamLabel } from "./common.view.js"
import { FULL_SET_MARKS, SANCTION_LABELS } from "../constants.js"
import { isShirt, needsActingCaptain, onCourt, rival } from "../../rules/index.js"

/**
 * Abreviatura con la que la pantalla nombra a cada cargo del cuerpo técnico sancionado.
 */
const STAFF_CODES = Object.freeze({
    coach: "E",
    assistant: "E2",
    assistant2: "E3",
    physio: "F",
    doctor: "M",
    psychologist: "PS",
    fitness: "PF",
    masseur: "MS",
})

/**
 * Indica si un jugador está apartado del juego: descalificado, fuera del partido o expulsado
 * en este set.
 * @param {Match} match partido
 * @param {Period} period set en curso
 * @param {string} side lado
 * @param {string} shirt dorsal
 * @returns {boolean}
 */
function sidelined(match, period, side, shirt) {
    if (match.disqualified[side].has(shirt) || match.outForMatch[side].has(shirt)) {
        return true
    }
    return period.expelled[side].has(shirt)
}

/**
 * Ordena las filas del informe de set completo como las claves de un objeto indexado por dorsal:
 * primero los dorsales que son índices enteros, de menor a mayor, y después el resto ("00") en
 * su orden.
 * @param {object[]} rows filas con shirt
 * @returns {object[]}
 */
function keyOrder(rows) {
    const numeric = []
    const others = []
    for (const row of rows) {
        if (/^(0|[1-9]\d*)$/.test(row.shirt)) {
            numeric.push(row)
        } else {
            others.push(row)
        }
    }
    numeric.sort((a, b) => Number(a.shirt) - Number(b.shirt))
    return [...numeric, ...others]
}

/**
 * Quién recibe una sanción, tal como se lee en la lista de la consola.
 * @param {string} target dorsal, cargo o "team"
 * @returns {string}
 */
function targetLabel(target) {
    if (isShirt(target)) {
        return target
    }
    if (target === "team") {
        return "Equipo"
    }
    return STAFF_CODES[target] ?? target
}

/**
 * Marca de un jugador del banquillo: capitán, capitán en juego o líbero.
 * @param {object} player jugador
 * @param {string|null} acting capitán en juego del lado
 * @returns {string}
 */
function badgeOf(player, acting) {
    if (player.captain) {
        return "C"
    }
    if (acting === player.shirt) {
        return "CJ"
    }
    if (player.libero) {
        return "L"
    }
    return ""
}

/**
 * Tarjetas de conducta de un jugador, como marcas de color con su nombre en el título.
 * @param {Match} match partido
 * @param {string} side lado
 * @param {string} shirt dorsal
 * @returns {Markup[]}
 */
function conductCards(match, side, shirt) {
    return match.sanctions
        .filter((entry) => entry.side === side && entry.target === shirt)
        .filter((entry) => FULL_SET_MARKS[entry.level])
        .map((entry) => html`<span class="card-chip card-chip--${entry.level}" title="${
            SANCTION_LABELS[entry.level]}"></span>`)
}

/**
 * Banquillo como fichas pequeñas: marca, dorsal, nombre, nota y tarjetas. Los líberos llevan
 * su color y los apartados del juego salen tachados.
 * @param {{match: Match, period: Period, info: object, side: string}} model contexto y lado
 * @param {string[]} shirts dorsales del banquillo
 * @returns {Markup} marcado HTML
 */
function benchList({ match, period, info, side }, shirts) {
    const team = match.teams[side]
    const rows = []
    for (const shirt of shirts) {
        const player = team.find(shirt)
        if (!player) {
            continue
        }
        let classes = "bench-item"
        if (player.libero) {
            classes += " bench-item--libero"
        }
        if (sidelined(match, period, side, shirt)) {
            classes += " bench-item--out"
        }
        const tint = player.libero ? raw(` style="${escapeHtml(colorVars(info, side, true))}"`) : null
        const badge = badgeOf(player, period.actingCaptain[side])
        const note = playerNote(period, side, shirt, false)
        rows.push(html`<li class="${classes}"${tint}><b class="bench-shirt">${
            shirt}</b><span class="bench-name">${player.name || ""}</span>${
            badge ? html`<span class="bench-badge">${badge}</span>` : null}${
            note ? html`<span class="bench-note">${note}</span>` : null}${
            conductCards(match, side, shirt)}</li>`)
    }
    if (rows.length === 0) {
        return html`<p class="fine dim">—</p>`
    }
    return html`<ul class="bench-list">${rows}</ul>`
}

/**
 * Bloque de jugadores sin ningún set completo, solo con el set obligatorio activo.
 * @param {object[]|null} report filas del lado en el informe de set completo
 * @returns {Markup|string}
 */
function fullSetBlock(report) {
    if (report === null) {
        return ""
    }
    const tags = keyOrder(report)
        .filter((row) => !row.ok)
        .map((row) => html`<span class="tag tag--missing" title="${row.name}">${row.shirt}</span>`)
    const body = tags.length ? tags : html`<span class="fine dim">Todos lo cumplen ✓</span>`
    return html`<h3 class="console-sub">Sin set completo todavía</h3><div class="tags">${body}</div>`
}

/**
 * Lista de sanciones del lado, con el set y el marcador en que se pusieron.
 * @param {Match} match partido
 * @param {string} side lado
 * @returns {Markup|string}
 */
function sanctionBlock(match, side) {
    const own = match.sanctions.filter((entry) => entry.side === side)
    if (own.length === 0) {
        return ""
    }
    const items = own.map((entry) => html`<li><span class="card-chip card-chip--${
        entry.level}" aria-hidden="true"></span><span>${SANCTION_LABELS[entry.level]} · ${
        targetLabel(entry.target)}</span> <span class="dim">set ${entry.period}, ${entry.own}:${
        entry.rival}</span></li>`)
    return html`<h3 class="console-sub">Sanciones</h3><ul class="card-list">${items}</ul>`
}

/**
 * Contador de una acción como casillas encendidas y su lectura en cifras.
 * @param {number} used gastados
 * @param {number} max máximo
 * @returns {Markup}
 */
function meter(used, max) {
    const cells = []
    for (let index = 0; index < max; index += 1) {
        cells.push(index < used ? raw("<i class=\"is-on\"></i>") : raw("<i></i>"))
    }
    return html`<span class="act-meter" aria-hidden="true">${cells}</span><b class="act-count">${
        used}/${max}</b>`
}

/**
 * Las cuatro acciones del lado: tiempo de descanso y sustitución con su contador, líbero con su
 * estado y sanción.
 * @param {Match} match partido
 * @param {Period} period set en curso
 * @param {string} side lado
 * @returns {Markup}
 */
function actionButtons(match, period, side) {
    const limits = match.settings
    let libero = null
    if (limits.liberoAllowed) {
        const state = period.libero[side]
            ? html`<b class="act-state">en pista</b>`
            : null
        libero = html`<button type="button" class="act act--libero" data-action="libero" data-side="${
            side}"><span class="act-label">Líbero</span>${state}</button>`
    }
    const timeout = html`<button type="button" class="act" data-action="timeout" data-side="${
        side}"><span class="act-label">Tiempo de descanso</span>${
        meter(period.timeouts[side].length, limits.timeouts)}</button>`
    const change = html`<button type="button" class="act" data-action="substitution" data-side="${
        side}"><span class="act-label">Sustitución</span>${
        meter(period.subCount[side], limits.substitutions)}</button>`
    const sanction = html`<button type="button" class="act act--sanction" data-action="sanction" ${
        ""}data-side="${side}"><span class="act-label">Sanción</span></button>`
    return html`<div class="console-actions">${timeout}${change}${libero}${sanction}</div>`
}

/**
 * Dorsales de un lado que están en el banquillo.
 * @param {Match} match partido
 * @param {Period} period set en curso
 * @param {string} side lado
 * @returns {string[]}
 */
function benchShirts(match, period, side) {
    const present = new Set(onCourt(period, side))
    return match.teams[side].players
        .filter((player) => !present.has(player.shirt))
        .map((player) => player.shirt)
}

/**
 * Consola de un lado: cabecera, pista, acciones y, en pantalla ancha, el detalle.
 * @param {{match: Match, period: Period, info: object, side: string, fullSet: object|null,
 *     folded: boolean}} model contexto del partido, lado y si queda plegada en el móvil
 * @returns {Markup} marcado HTML
 */
export function teamPanel(model) {
    const { match, period, info, side } = model
    const name = teamLabel(info, side)
    const serve = period.serving === side ? html`<span class="serve-pill">Saca</span>` : null
    const report = model.fullSet ? model.fullSet[side] : null
    const folded = model.folded ? " is-folded" : ""
    const head = html`<header class="console-head"><span class="swatch" style="background:${
        teamColor(info, side)}" aria-hidden="true"></span><h2 class="console-name">${
        name}</h2>${serve}</header>`
    const detail = html`<div class="console-detail"><h3 class="console-sub">Banquillo</h3>${
        benchList(model, benchShirts(match, period, side))}${fullSetBlock(report)}${
        sanctionBlock(match, side)}</div>`
    return html`<section class="console${folded}" id="console-${side}" data-panel="${
        side}" aria-label="${name}" style="--team:${teamColor(info, side)}">${head}${
        teamCourt(model)}${actionButtons(match, period, side)}${detail}</section>`
}

/**
 * Botón del selector de consola del móvil, con los contadores del equipo.
 * @param {object} model contexto del partido
 * @param {string} side lado
 * @param {boolean} pressed si es la consola a la vista
 * @returns {Markup}
 */
function switchButton({ match, period, info }, side, pressed) {
    const limits = match.settings
    const tally = `T ${period.timeouts[side].length}/${limits.timeouts} · S ${
        period.subCount[side]}/${limits.substitutions}`
    return html`<button type="button" data-show-side="${side}" aria-controls="console-${
        side}" aria-pressed="${String(pressed)}"><span class="swatch" style="background:${
        teamColor(info, side)}" aria-hidden="true"></span><span class="switch-name">${
        teamLabel(info, side)}</span><small class="switch-tally">${tally}</small></button>`
}

/**
 * Selector de la consola a la vista en el móvil: un botón por equipo, en el orden en que se
 * ven desde la mesa.
 * @param {object} model contexto del partido
 * @param {string} shown lado de la consola a la vista
 * @returns {Markup} marcado HTML
 */
export function consoleSwitch(model, shown) {
    const left = model.period.leftSide
    const buttons = [left, rival(left)].map((side) => switchButton(model, side, side === shown))
    return html`<div class="console-switch" role="group" aria-label="Equipo mostrado">${
        buttons}</div>`
}

/**
 * Cabecera común de un aviso: color y nombre del equipo.
 * @param {object} info datos del acta
 * @param {string} side lado
 * @returns {Markup}
 */
function alertTeam(info, side) {
    return html`<span class="alert-team"><span class="swatch" style="background:${
        teamColor(info, side)}" aria-hidden="true"></span>${teamLabel(info, side)}</span>`
}

/**
 * Aviso para designar capitán en juego cuando el capitán no está en pista (FIVB 5.2): un botón
 * por cada jugador en pista. Vacío si no hace falta.
 * @param {{match: Match, period: Period, info: object, side: string}} model contexto y lado
 * @returns {Markup|string} marcado HTML
 */
function captainPrompt({ match, period, info, side }) {
    if (!needsActingCaptain(match, side)) {
        return ""
    }
    const captain = match.teams[side].captain()
    const choices = onCourt(period, side).map((shirt) => html`<button type="button" ${
        ""}data-acting-captain="${side}|${shirt}">${shirt}</button>`)
    const lead = html`<p class="alert-text">Capitán (${
        captain.shirt}) fuera de la pista. Elige capitán en juego:</p>`
    return html`<div class="alert alert--captain" role="group" aria-label="Capitán en juego">${
        alertTeam(info, side)}${lead}<div class="alert-choices">${choices}</div></div>`
}

/**
 * Propuesta de entrada del líbero cuando el equipo pasa a recibir sin él en pista. Propone el
 * último líbero que jugó en el set y pone primero al zaguero por el que entró. Hace falta un
 * rally completo entre dos cambios de líbero (FIVB 19.3.2.1), así que justo después de uno no
 * se propone nada.
 * @param {{match: Match, period: Period, info: object, side: string}} model contexto y lado
 * @returns {Markup|string} marcado HTML
 */
function liberoHint({ match, period, info, side }) {
    const settings = match.settings
    if (!settings.liberoAllowed || settings.liberoPrompt === false || period.libero[side]) {
        return ""
    }
    if (period.serving !== rival(side) || period.rallyCount === period.lastLiberoRally[side]) {
        return ""
    }
    const team = match.teams[side]
    const available = team.players
        .filter((player) => player.libero && !sidelined(match, period, side, player.shirt))
        .map((player) => player.shirt)
    if (available.length === 0) {
        return ""
    }
    const earlier = period.liberoSwaps[side].filter((swap) => available.includes(swap.entering))
    const latest = earlier.at(-1)
    const libero = latest?.entering || available[0]
    const favourite = latest?.leaving
    const backs = [4, 5, 0]
        .map((zone) => period.rotation[side][zone])
        .filter((shirt) => shirt && !team.find(shirt)?.libero)
    backs.sort((a, b) => (b === favourite) - (a === favourite))
    const choices = backs.map((shirt) => {
        const highlight = shirt === favourite ? raw(" class=\"cta\"") : null
        return html`<button type="button" data-libero-enter="${side}|${libero}|${shirt}"${
            highlight}>${shirt}</button>`
    })
    const lead = html`<p class="alert-text">¿Por quién entra el líbero ${libero}?</p>`
    return html`<div class="alert alert--libero" role="group" aria-label="Entrada del líbero" ${
        ""}style="${colorVars(info, side, true)}">${alertTeam(info, side)}${lead}${
        raw("<div class=\"alert-choices\">")}${choices}</div></div>`
}

/**
 * Salida del líbero pendiente de confirmar: ha rotado a la delantera y no se puede anotar el
 * siguiente punto hasta apuntarla. Se ve siempre, aunque la ayuda con el líbero esté apagada.
 * @param {{period: Period, info: object, side: string}} model contexto y lado
 * @returns {Markup|null}
 */
function liberoLeaving({ period, info, side }) {
    const libero = period.libero[side]
    if (!period.liberoMustLeave[side] || !libero) {
        return null
    }
    const lead = html`<p class="alert-text">El líbero ${libero.shirt} ha rotado a la zona IV: tiene que salir y vuelve el ${libero.replacing}.</p>`
    const button = html`<button type="button" class="cta" data-libero-leave="${side}">Confirmar salida</button>`
    return html`<div class="alert alert--urgent" role="group" aria-label="Salida del líbero">${
        alertTeam(info, side)}${lead}<div class="alert-choices">${button}</div></div>`
}

/**
 * Aviso de los jugadores que hay que sustituir (expulsión, descalificación o lesión).
 * @param {{period: Period, info: object, side: string}} model contexto y lado
 * @returns {Markup|null}
 */
function pendingChange({ period, info, side }) {
    const waiting = period.mustReplace[side]
    if (waiting.length === 0) {
        return null
    }
    const text = `Sustitución obligatoria: ${waiting.join(", ")}`
    return html`<div class="alert alert--urgent">${alertTeam(info, side)}<p class="alert-text">${
        text}</p></div>`
}

/**
 * Franja de avisos de los dos equipos, en el orden en que se ven desde la mesa. Vacía si no
 * hay nada pendiente.
 * @param {object} model contexto del partido
 * @returns {Markup|string} marcado HTML
 */
export function matchAlerts(model) {
    const left = model.period.leftSide
    const parts = []
    for (const side of [left, rival(left)]) {
        const scoped = { ...model, side }
        const urgent = pendingChange(scoped)
        const leaving = liberoLeaving(scoped)
        parts.push(urgent, leaving, captainPrompt(scoped), urgent || leaving ? "" : liberoHint(scoped))
    }
    const shown = parts.filter((part) => part !== null && part !== "")
    if (shown.length === 0) {
        return ""
    }
    return html`<div class="alerts">${shown}</div>`
}
