/**
 * Plantillas de los dos equipos y firmas previas. Función pura: recibe un modelo y devuelve
 * marcado; no lee estado global.
 *
 * Los saltos de línea y las sangrías de las plantillas forman nodos de texto que el diferencial
 * de DOM compara uno a uno: no se reformatean. La celda de líbero, cuando no hay líbero, deja
 * juntos los dos saltos que la rodean, igual que si estuviera vacía.
 * @module src/app/views/rosters.view.js
 */

import { html, raw } from "../dom.js"
import { CATEGORY_NAMES, STAFF_TITLES, isValidShirt } from "../../rules/index.js"
import { OPENING_SIGNERS } from "../constants.js"
import { actionDock, signatureGrid, stepper } from "./common.view.js"

/**
 * Avisos de la pantalla de plantillas. Los que dependen del equipo reciben su nombre.
 */
export const ROSTER_TEXT = Object.freeze({
    missingShirt: (team, names, more) => `${team}: ${names.join(", ")}${
        more ? "…" : ""} sin dorsal. Pon el dorsal o borra la fila con ✕.`,
    badShirt: (team, shirts) => `${team}: dorsal incorrecto ${
        shirts.map((shirt) => "\"" + shirt + "\"").join(", ")}. Usa un número del 0 al 99, o 00.`,
    fewPlayers: (team) => `${team}: se necesitan como mínimo 6 jugadores sin contar los líberos.`,
    noCaptain: (team) => `${team}: falta marcar al capitán.`,
    refused: (team, reason) => `${team}: ${reason}`,
})

/**
 * Cargos del cuerpo técnico que siempre están a la vista; el resto va plegado.
 */
const MAIN_ROLES = new Set(["coach", "assistant"])

/**
 * Rótulo de cada lado en la cabecera de su tarjeta.
 */
const SIDE_BADGES = Object.freeze({ home: "Local", away: "Visitante" })

/**
 * Si un dorsal escrito se debe marcar como no válido: vacío o ausente no cuenta.
 * @param {unknown} shirt dorsal tal como está en el borrador
 * @returns {boolean}
 */
function flagged(shirt) {
    if (shirt === "" || shirt === null || shirt === undefined) {
        return false
    }
    return !isValidShirt(shirt)
}

/**
 * Desplegable de categoría inferior de un jugador.
 * @param {number} row fila
 * @param {string|undefined} category letra elegida
 * @returns {Markup}
 */
function categorySelect(row, category) {
    const current = category || ""
    const options = []
    for (const letter of ["", ...Object.keys(CATEGORY_NAMES)]) {
        const selected = current === letter ? raw(" selected") : null
        const label = letter ? `${letter} · ${CATEGORY_NAMES[letter]}` : "—"
        options.push(html`<option value="${letter}"${selected}>${label}</option>`)
    }
    return html`<select class="category-select" data-row="${row}" data-col="category" ${
        ""}aria-label="Categoría inferior">${options}</select>`
}

/**
 * Fila editable de un jugador.
 * @param {object} player jugador del borrador
 * @param {number} row posición en el borrador
 * @param {{side: string, liberoAllowed: boolean}} table lado y si hay columna de líbero
 * @returns {Markup}
 */
function playerRow(player, row, { side, liberoAllowed }) {
    const invalid = flagged(player.shirt) ? raw(" aria-invalid=\"true\"") : null
    const shirt = html`<input class="shirt-input" type="text" inputmode="numeric" maxlength="2" ${
        ""}autocomplete="off" data-row="${row}" data-col="shirt" value="${player.shirt}" ${
        ""}aria-label="Dorsal (del 0 al 99, o 00)" placeholder="—"${invalid}>`
    const name = html`<input type="text" data-row="${row}" data-col="name" value="${
        player.name || ""}" aria-label="Nombre" placeholder="Nombre y apellidos">`
    const captainOn = player.captain ? raw(" checked") : null
    const captain = html`<label class="check"><input type="radio" name="captain-${side}" ${
        ""}data-row="${row}" data-col="captain"${captainOn} aria-label="Capitán"><span ${
        ""}class="cell-label">Capitán</span></label>`
    let libero = null
    if (liberoAllowed) {
        const liberoOn = player.libero ? raw(" checked") : null
        libero = html`<td class="col-libero"><label class="check"><input type="checkbox" ${
            ""}data-row="${row}" data-col="libero"${liberoOn} aria-label="Líbero"><span ${
            ""}class="cell-label">Líbero</span></label></td>`
    }
    const remove = html`<button type="button" class="remove-btn quiet" data-remove-row="${
        row}" aria-label="Borrar fila">✕</button>`
    return html`<tr><td class="col-shirt">${shirt}</td>
      <td class="col-name">${name}</td>
      <td class="col-captain">${captain}</td>
      ${libero}
      <td class="col-category">${categorySelect(row, player.category)}</td>
      <td class="col-remove">${remove}</td></tr>`
}

/**
 * Campo de un cargo del cuerpo técnico.
 * @param {{role: string, name: string}} member cargo y nombre
 * @param {number} index posición en el borrador
 * @returns {Markup}
 */
function staffField(member, index) {
    return html`<label class="field"><span>${STAFF_TITLES[member.role]}</span><input type="text" ${
        ""}data-staff="${index}" value="${member.name}"></label>`
}

/**
 * Aviso de los jugadores apartados por llevar un dorsal no válido.
 * @param {object[]} setAside jugadores apartados
 * @returns {Markup|null}
 */
function setAsideNote(setAside) {
    if (setAside.length === 0) {
        return null
    }
    const list = setAside.map((player) => `${player.name || "sin nombre"} (${
        player.shirt || "en blanco"})`).join(", ")
    const lead = "Dorsales incorrectos guardados con otra versión: "
    const tail = ". Corrígelos (0-99 o 00) o borra la fila con ✕."
    return html`<p class="banner banner--bad fine">${lead + list + tail}</p>`
}

/**
 * Cuenta las filas con dorsal o nombre escritos.
 * @param {object[]} players filas del borrador
 * @returns {number}
 */
function filledRows(players) {
    let count = 0
    for (const player of players) {
        if (String(player.shirt ?? "").trim() || String(player.name || "").trim()) {
            count += 1
        }
    }
    return count
}

/**
 * Tarjeta editable de un equipo: jugadores, cuerpo técnico (los cargos secundarios plegados,
 * abiertos si alguno está escrito) y delegado.
 * @param {{side: string, name: string, tint: string, liberoAllowed: boolean,
 *     draft: {players: object[], staff: object[]}, setAside: object[], delegate: string}} model
 *     datos de la tarjeta
 * @returns {Markup} marcado HTML
 */
export function rosterTable(model) {
    const { side, draft, liberoAllowed } = model
    const filled = filledRows(draft.players)
    const head = html`<div class="roster-head"><h2>${model.name}</h2><span class="badge">${
        SIDE_BADGES[side]}</span><span class="fine dim roster-name">${filled} ${
        filled === 1 ? "inscrito" : "inscritos"}</span></div>`
    const liberoHead = liberoAllowed ? html`<th>Líbero</th>` : null
    const category = html`<th><abbr title="Categoría inferior según la edad (FCVB, Circular 004)">${
        "Cat."}</abbr></th>`
    const rows = draft.players.map((player, row) => playerRow(player, row, model))
    const main = []
    const extra = []
    for (const [index, member] of draft.staff.entries()) {
        const target = MAIN_ROLES.has(member.role) ? main : extra
        target.push(staffField(member, index))
    }
    const open = draft.staff.some((member) => !MAIN_ROLES.has(member.role) && member.name)
    const delegate = html`<label class="field"><span>Delegado de equipo</span><input type="text" ${
        ""}data-delegate="${side}" value="${model.delegate}"><span class="field-hint">${
        "Se anota en observaciones, sin DNI (FCVB, Circular 003)."}</span></label>`
    return html`<section class="panel roster-panel" data-side="${side}" style="--team-tint:${
        model.tint}">${head}${setAsideNote(model.setAside)}
    <table class="grid-table"><thead><tr><th>Dorsal</th><th>Nombre y apellidos</th><th>Cap.</th>${
        liberoHead}${category}<th></th></tr></thead><tbody>
    ${rows}
    </tbody></table><div class="hstack" style="margin:10px 0 16px"><button type="button" ${
        ""}data-add-row>+ Añadir jugador</button></div>
    <h3 class="subhead">Cuerpo técnico</h3><p class="fine dim" style="margin:0 0 8px">${
        "El primer entrenador y hasta 3 personas más."}</p>
    <div class="cols-2">${main}</div>
    <details class="more-staff"${open ? raw(" open") : null}><summary>${
        "Otros miembros del cuerpo técnico"}</summary><div class="cols-2">${extra}</div></details>
    <div class="cols-2">${delegate}</div></section>`
}

/**
 * Pantalla de plantillas: las dos tarjetas, las firmas previas y la barra de acciones.
 * @param {{liberoAllowed: boolean, tables: object[], signatures: object}} model si hay líbero,
 *     modelos de las dos tarjetas y firmas del partido
 * @returns {Markup} marcado HTML
 */
export function rostersView({ liberoAllowed, tables, signatures }) {
    let mark = "; este partido no tiene líbero"
    if (liberoAllowed) {
        mark = " y a los líberos, 2 como máximo"
    }
    const lead = "Copia dorsales y nombres de las licencias. Señala al capitán" + mark + "."
    const grid = signatureGrid({ slots: OPENING_SIGNERS, signatures })
    const back = html`<button type="button" class="quiet" id="go-back">Atrás</button>`
    const next = html`<button class="cta" id="go-next">${
        "Continuar con el sorteo"}</button>`
    return html`${stepper("rosters")}<p class="lead">${lead}</p>
    <div class="duo">${tables.map(rosterTable)}</div>
    <section class="panel"><h2>Firmas previas al partido</h2><p class="fine dim">${
        "La plantilla la firman el capitán y el entrenador de cada equipo."}</p>${grid}</section>
    ${actionDock(html`${back}${next}`)}`
}
