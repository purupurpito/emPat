/**
 * Pista de cada equipo durante el set y franja del último suceso. Funciones puras: reciben el
 * contexto del partido y devuelven marcado.
 *
 * Cada pista es una sola rejilla con las seis fichas en el orden de rotación (I a VI) y la red.
 * La colocación la decide la hoja de estilos: en el móvil, red arriba como en la formación
 * inicial; en pantalla ancha, cada mitad mira a la red del centro tal como se ve desde la mesa
 * del anotador.
 * @module src/app/views/court.view.js
 */

import { html, raw } from "../dom.js"
import { colorVars, teamColor } from "../colors.js"
import { FULL_SET_MARKS, SANCTION_LABELS, ZONE_NUMERALS } from "../constants.js"
import { shortLabel } from "../format.js"
import { teamLabel } from "./common.view.js"
import { onCourt } from "../../rules/index.js"

/**
 * Jugadas que no cuentan como "última jugada": la plantilla y las firmas no se deshacen desde
 * el partido.
 */
const SILENT_KINDS = new Set(["roster", "sign"])

/**
 * Índices de rotación en el orden de lectura de la pista: I, II, III, IV, V y VI.
 */
const ROTATION = Object.freeze([0, 1, 2, 3, 4, 5])

/**
 * Balón que marca al sacador.
 */
const BALL = raw("<span class=\"tile-ball\" aria-hidden=\"true\"></span>")

/**
 * Última jugada que se podría deshacer, o undefined si no hay ninguna.
 * @param {object[]} plays jugadas del acta
 * @returns {object|undefined}
 */
export function lastUndoable(plays) {
    return plays.findLast((play) => !SILENT_KINDS.has(play.kind))
}

/**
 * Nota que acompaña a un jugador: por quién está, a qué marcador salió o si ya jugó. La del
 * zaguero que espera al líbero prevalece sobre las demás.
 * @param {Period} period set en curso
 * @param {string} side lado
 * @param {string} shirt dorsal
 * @param {boolean} playing si está en pista
 * @returns {string}
 */
export function playerNote(period, side, shirt, playing) {
    const libero = period.libero[side]
    const partners = period.partners[side]
    const replaced = Object.keys(partners).find((starter) => partners[starter] === shirt)
    let note = ""
    if (playing && libero && libero.shirt === shirt) {
        note = `por ${libero.replacing}`
    } else if (playing && replaced) {
        note = `(${replaced})`
    } else if (!playing && partners[shirt] !== null && partners[shirt] !== undefined) {
        const change = period.substitutions[side].find((entry) => entry.leaving === shirt)
        if (change) {
            note = `salió ${change.own}-${change.rival}`
        }
    } else if (!playing && period.hasPlayed[side].has(shirt)) {
        note = "ya jugó"
    }
    if (!playing && libero && libero.replacing === shirt) {
        note = `por el líbero ${libero.shirt}`
    }
    return note
}

/**
 * Datos de una ficha de la pista.
 * @param {Match} match partido
 * @param {Period} period set en curso
 * @param {string} side lado
 * @param {number} zone índice de rotación (0 es la zona I)
 * @returns {{shirt: string, player: object|undefined, libero: boolean, serving: boolean,
 *     marked: boolean}}
 */
function seat(match, period, side, zone) {
    const shirt = onCourt(period, side)[zone]
    const player = match.teams[side].find(shirt)
    const libero = period.libero[side]
    return {
        shirt,
        player,
        libero: Boolean(libero) && libero.zone === zone,
        serving: period.serving === side && zone === 0,
        marked: Boolean(player?.captain) || period.actingCaptain[side] === shirt,
    }
}

/**
 * Clases de una ficha: zona, delantera o zaguera, líbero y saque.
 * @param {object} spot ficha
 * @param {number} zone índice de rotación
 * @returns {string}
 */
function tileClasses(spot, zone) {
    let classes = `tile tile--z${zone + 1}`
    if (zone >= 1 && zone <= 3) {
        classes += " tile--front"
    }
    if (spot.libero) {
        classes += " tile--libero"
    }
    if (spot.serving) {
        classes += " tile--serving"
    }
    return classes
}

/**
 * Marca de capitán de una ficha: C para el capitán del acta y CJ para el capitán en juego.
 * @param {object} spot ficha
 * @returns {Markup|null}
 */
function captainMark(spot) {
    if (!spot.marked) {
        return null
    }
    if (spot.player?.captain) {
        return html`<abbr class="tile-cap" title="Capitán">C</abbr>`
    }
    return html`<abbr class="tile-cap tile-cap--acting" title="Capitán en juego">CJ</abbr>`
}

/**
 * Tarjetas de conducta del jugador de una ficha, como marcas de color.
 * @param {Match} match partido
 * @param {string} side lado
 * @param {string} shirt dorsal
 * @returns {Markup|null}
 */
function tileCards(match, side, shirt) {
    const cards = match.sanctions
        .filter((entry) => entry.side === side && entry.target === shirt)
        .filter((entry) => FULL_SET_MARKS[entry.level])
        .map((entry) => html`<span class="card-chip card-chip--${entry.level}" title="${
            SANCTION_LABELS[entry.level]}"></span>`)
    return cards.length ? html`<span class="tile-cards">${cards}</span>` : null
}

/**
 * Ficha de un jugador: dorsal grande, nombre corto, zona, marca de capitán y balón si saca.
 * Al tocarla se abre el cambio de ese jugador (o el diálogo del líbero si es él).
 * Debajo del nombre va la nota del jugador (por quién está) y sus tarjetas de conducta.
 * @param {object} spot ficha
 * @param {string} side lado
 * @param {{match: Match, period: Period, info: object}} model contexto del partido
 * @param {number} zone índice de rotación
 * @returns {Markup}
 */
function tile(spot, side, { match, period, info }, zone) {
    const numeral = ZONE_NUMERALS[zone]
    const fullName = spot.player ? String(spot.player.name ?? "") : null
    const title = `Zona ${numeral}${fullName === null ? "" : " · " + fullName}`
    const label = `${spot.shirt ?? ""}${fullName === null ? "" : " " + fullName}`
    const tint = spot.libero ? colorVars(info, side, true) : ""
    const note = playerNote(period, side, spot.shirt, true)
    return html`<button type="button" class="${tileClasses(spot, zone)}" style="${
        tint}" data-tap="${side}" data-shirt="${spot.shirt}" title="${
        title} · pulsa para cambiarlo" aria-label="${label}, zona ${
        numeral}: cambiar"><span class="tile-zone" aria-hidden="true">${
        numeral}</span>${captainMark(spot)}${spot.serving ? BALL : null}<span class="tile-shirt">${
        spot.shirt}</span><span class="tile-name">${shortLabel(spot.player?.name)}</span>${
        note ? html`<span class="tile-note">${note}</span>` : null}${
        tileCards(match, side, spot.shirt)}</button>`
}

/**
 * Pista de un equipo: la red y las seis fichas en orden de rotación. La clase del lado
 * (izquierda o derecha del anotador) decide hacia dónde mira en pantalla ancha.
 * @param {{match: Match, period: Period, info: object, side: string}} model contexto y lado
 * @returns {Markup} marcado HTML
 */
export function teamCourt(model) {
    const { match, period, info, side } = model
    const where = period.leftSide === side ? "west" : "east"
    const tiles = ROTATION.map((zone) => tile(seat(match, period, side, zone), side, model, zone))
    return html`<div class="pitch pitch--${where}" style="--team:${
        teamColor(info, side)}" role="group" aria-label="Pista de ${
        teamLabel(info, side)}"><div class="pitch-net" aria-hidden="true"></div>${
        tiles}</div>`
}

/**
 * Franja del último suceso con su botón de deshacer, desactivado si no hay nada.
 * @param {{label: string|null, buttonId: string}} model descripción de la última jugada (o
 *     null) e identificador del botón
 * @returns {Markup} marcado HTML
 */
export function lastPlayBar({ label, buttonId }) {
    let text = html`<span class="last-empty">Aún no hay acciones que deshacer.</span>`
    let disabled = raw(" disabled")
    if (label) {
        text = html`<span class="last-tag">Última acción:</span> <span class="last-text">${label}</span>`
        disabled = null
    }
    return html`<div class="last-call"><p class="last-line">${text}</p><button type="button" id="${
        buttonId}" class="undo-btn"${disabled}><span class="undo-icon" aria-hidden="true">↶</span><span>${
        "Deshacer"}</span></button></div>`
}
