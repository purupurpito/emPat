/**
 * Portada y lista de actas. Función pura: recibe un modelo y devuelve marcado; no lee estado
 * global.
 *
 * Los saltos de línea y las sangrías de las plantillas forman nodos de texto que el diferencial
 * de DOM compara uno a uno: no se reformatean.
 * @module src/app/views/home.view.js
 */

import { html } from "../dom.js"

/**
 * Avisos y preguntas que lanza la portada.
 */
export const HOME_TEXT = Object.freeze({
    imported: "Se ha importado el acta.",
    askDrop: "¿Quieres eliminar esta acta del dispositivo?",
    unreadable: "Esta versión no sabe abrirla: ",
    demoBadge: "Ejemplo",
    shelf: "Actas guardadas",
    empty: "Todavía no has guardado ninguna acta.",
    lead: "Con las reglas oficiales de la FIVB para 6x6. Funciona sin conexión y guarda todo en tu"
        + " dispositivo.",
})

/**
 * Fecha AAAA-MM-DD en formato DD/MM/AAAA. Cualquier otra cosa se devuelve tal cual, para no
 * esconder lo que se escribió.
 * @param {string|undefined} value fecha guardada
 * @returns {string}
 */
export function displayDate(value) {
    const text = value || ""
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
    if (parts === null) {
        return text
    }
    return [parts[3], parts[2], parts[1]].join("/")
}

/**
 * Rótulo y variante de la etiqueta de estado de un acta. Entre sets cuenta como en juego.
 * @param {{phase: string, home: number, away: number}} progress fase y sets ganados
 * @returns {{label: string, tone: string}}
 */
function statusOf({ phase, home, away }) {
    if (phase === "over") {
        return { label: `Terminado ${home}-${away}`, tone: "badge--done" }
    }
    if (phase === "setup") {
        return { label: "Por empezar", tone: "badge--setup" }
    }
    return { label: `En curso · sets ${home}-${away}`, tone: "badge--live" }
}

/**
 * Nombres de los dos equipos con la muestra de su color.
 * @param {{names: {home: string, away: string}, swatches: {home: string, away: string}}} item
 *     nombres ya resueltos y colores de camiseta
 * @returns {Markup}
 */
function teamsLine({ names, swatches }) {
    const one = (side) => html`<span class="record-team"><i class="swatch" style="background:${
        swatches[side]}"></i>${names[side]}</span>`
    return html`<span class="record-teams">${one("home")}${one("away")}</span>`
}

/**
 * Botón para borrar un acta de la lista.
 * @param {string} id identificador
 * @returns {Markup}
 */
function dropButton(id) {
    return html`<button class="quiet" data-drop-record="${id}">Eliminar</button>`
}

/**
 * Fila de un acta que el motor no sabe reconstruir: solo se ofrece borrarla.
 * @param {object} item fila preparada
 * @returns {Markup}
 */
function brokenItem(item) {
    const note = html`<span class="fine" style="color:var(--bad)">${
        HOME_TEXT.unreadable + item.reason}</span>`
    return html`<li class="record-item"><div class="record-main">${teamsLine(item)}${
        note}</div><div class="record-buttons">${dropButton(item.id)}</div></li>`
}

/**
 * Fila de un acta legible: equipos, fecha y competición, estado y botones.
 * @param {object} item fila preparada
 * @returns {Markup}
 */
function healthyItem(item) {
    let when = null
    if (item.meta !== "") {
        when = html`<span class="fine dim">${item.meta}</span>`
    }
    let demo = null
    if (item.demo) {
        demo = html`<span class="badge">${HOME_TEXT.demoBadge}</span>`
    }
    const { label, tone } = statusOf(item.progress)
    const status = html`<span class="badge ${tone}">${label}</span>`
    const open = html`<button class="cta" data-open-record="${item.id}">Abrir</button>`
    return html`<li class="record-item"><div class="record-main">${teamsLine(item)}${
        html`<span class="record-meta">${when}${status}${demo}</span>`}</div>
      <div class="record-buttons">${open}${dropButton(item.id)}</div></li>`
}

/**
 * Lista de actas o, si no hay ninguna, la nota de vacío.
 * @param {object[]} items filas
 * @returns {Markup}
 */
function shelf(items) {
    if (items.length === 0) {
        return html`<p class="empty-note">${HOME_TEXT.empty}</p>`
    }
    const rows = items.map((item) => (item.broken ? brokenItem(item) : healthyItem(item)))
    return html`<ul class="record-list">${rows}</ul>`
}

/**
 * Botones para empezar: acta en blanco, partido de prueba e importación de un archivo.
 * @returns {Markup}
 */
function starters() {
    const blank = html`<button class="cta cta-big" id="new-blank">Empezar en blanco</button>`
    const demo = html`<button id="new-demo">Probar con un partido de ejemplo</button>`
    const picker = html`<input type="file" id="import-file" accept="application/json,.json" ${
        ""}class="visually-hidden">`
    const importer = html`<label class="button-like" style="cursor:pointer">${
        "Importar archivo de acta (JSON)"}${picker}</label>`
    return html`<div class="hero-actions">${blank}${demo}${importer}</div>`
}

/**
 * Portada completa: bloque para empezar un acta (en blanco, de prueba o importada) y la lista de
 * las guardadas en el dispositivo.
 * @param {{items: object[]}} model filas ya preparadas por la pantalla, de la más reciente a la
 *     más antigua
 * @returns {Markup} marcado HTML
 */
export function homeView({ items }) {
    let counter = null
    if (items.length > 0) {
        counter = html` <span class="counter">${items.length}</span>`
    }
    return html`
    <section class="hero">
      <div class="hero-copy"><h2>Nueva acta</h2><p>${HOME_TEXT.lead}</p></div>
      ${starters()}
    </section>
    <section class="record-shelf"><h2 class="section-title">${HOME_TEXT.shelf}${counter}</h2>
      ${shelf(items)}
    </section>`
}
