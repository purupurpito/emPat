/**
 * Pantalla del partido en juego. Función pura: recibe el contexto del partido y devuelve
 * marcado; no lee estado global.
 *
 * Arriba, el marcador en tinta: una ficha por equipo que es a la vez su botón de punto, y en
 * medio el set, el reloj y los parciales. Debajo, el último suceso con deshacer, los avisos de
 * los dos equipos y las dos consolas de equipo. La columna de la mesa (último suceso,
 * herramientas, sucesos, parciales y teclado) va a la derecha en pantalla ancha; en el móvil
 * sus piezas se intercalan en la columna única y solo se ve una consola cada vez.
 * @module src/app/views/live.view.js
 */

import { html, raw } from "../dom.js"
import { consoleSwitch, matchAlerts, teamPanel } from "./panel.view.js"
import { lastPlayBar, lastUndoable } from "./court.view.js"
import { stepper, teamLabel } from "./common.view.js"
import { colorVars, teamColor } from "../colors.js"
import { describePlay } from "../describe.js"
import { clockTime } from "../format.js"
import { rival } from "../../rules/index.js"

/**
 * Avisos que da la pantalla del partido al confirmar una acción.
 */
export const LIVE_TEXT = Object.freeze({
    actingCaptain: (shirt) => `El ${shirt} pasa a ser capitán en juego.`,
    replayNoted: "Jugada repetida: nadie suma punto.",
})

/**
 * Cuántas jugadas del final del acta se miran para la lista de sucesos.
 */
const LOG_WINDOW = 12

/**
 * Jugadas que la lista de sucesos no enseña.
 */
const UNLOGGED = new Set(["roster", "sign"])

/**
 * Herramientas del partido que no son de un equipo.
 */
const TOOLS = html`<div class="desk-tools" role="group" aria-label="Herramientas">${[
    html`<button type="button" id="mark-replay">Repetir jugada</button>`,
    html`<button type="button" id="open-incidents">Incidencias</button>`,
    html`<button type="button" id="open-note">Observación</button>`,
    html`<button type="button" id="open-paper">Ver el acta</button>`,
    html`<button type="button" class="quiet" id="go-list">Mis actas</button>`,
]}</div>`

/**
 * Rótulo del set en el centro del marcador: golden set, o número de set y si es el decisivo.
 * @param {Period} period set en curso
 * @returns {string}
 */
function periodTitle(period) {
    if (period.isGolden) {
        return "Golden set"
    }
    return `Set ${period.number}${period.decider ? " · decisivo" : ""}`
}

/**
 * Sets ganados como casillas: tantas como sets hacen falta para ganar, encendidas las ganadas.
 * @param {number} won sets ganados
 * @param {number} needed sets para ganar el partido
 * @returns {Markup}
 */
function setPips(won, needed) {
    const pips = []
    for (let index = 0; index < Math.max(won, needed); index += 1) {
        pips.push(index < won ? raw("<i class=\"is-on\"></i>") : raw("<i></i>"))
    }
    return html`<span class="board-sets" role="img" aria-label="Sets ganados: ${won}">${pips}</span>`
}

/**
 * Ficha de un equipo en el marcador. Toda ella es el botón de punto de ese equipo.
 * @param {object} model contexto del partido
 * @param {string} side lado
 * @param {string} key flecha del teclado que da el punto a este lado
 * @returns {Markup}
 */
function boardTeam({ match, period, info }, side, key) {
    const where = period.leftSide === side ? "west" : "east"
    const serve = period.serving === side ? html`<span class="serve-pill">Saca</span>` : null
    return html`<button type="button" class="board-team board-team--${where}" data-score="${
        side}" style="--team:${teamColor(info, side)}"><span class="board-name">${
        teamLabel(info, side)}</span><span class="board-meta">${
        setPips(match.setsWon[side], match.setsToWin)}${serve}</span><span class="board-points">${
        period.score[side]}</span><span class="board-cta"><span>Punto</span> <kbd>${
        key}</kbd></span></button>`
}

/**
 * Parciales de los sets ya jugados, con el lado izquierdo primero y el color del ganador.
 * @param {Match} match partido
 * @param {object} info datos del acta
 * @param {string} left lado de la izquierda
 * @returns {Markup|null}
 */
function setHistory(match, info, left) {
    const right = rival(left)
    const done = match.periods.filter((entry) => entry.winner)
    if (done.length === 0) {
        return null
    }
    const chips = done.map((entry) => html`<li style="${colorVars(info, entry.winner)}"><b>Set ${
        entry.number}</b> ${entry.score[left]}-${entry.score[right]}</li>`)
    return html`<ol class="board-history">${chips}</ol>`
}

/**
 * Marcador: las dos fichas de equipo y, en medio, el set, el reloj y los parciales.
 * @param {object} model contexto del partido
 * @param {string} left lado de la izquierda
 * @returns {Markup}
 */
function scoreboard(model, left) {
    const { match, period, info } = model
    const middle = html`<div class="board-mid"><span class="board-period">${
        periodTitle(period)}</span>${
        raw("<span class=\"board-clock\" id=\"set-clock\" aria-label=\"Reloj del set\">0:00</span>")}${
        setHistory(match, info, left)}</div>`
    return html`<section class="board" aria-label="Marcador" aria-live="polite">${
        boardTeam(model, left, "←")}${middle}${boardTeam(model, rival(left), "→")}</section>`
}

/**
 * Lista de sucesos, del más reciente al más antiguo, con su hora y el color del equipo.
 * @param {Match} match partido
 * @param {object} info datos del acta
 * @param {object[]} plays jugadas del acta
 * @returns {Markup}
 */
function playFeed(match, info, plays) {
    const items = plays
        .slice(-LOG_WINDOW)
        .reverse()
        .filter((play) => !UNLOGGED.has(play.kind))
        .map((play) => {
            const tint = play.side === "home" || play.side === "away"
                ? raw(` style="--dot:${teamColor(info, play.side)}"`)
                : null
            return html`<li class="feed-item feed-item--${play.kind}"${tint}><span ${
                ""}class="feed-time">${clockTime(play.at)}</span><span class="feed-text">${
                describePlay(play, match)}</span></li>`
        })
    return html`<section class="feed" aria-labelledby="feed-title"><h2 class="desk-title" ${
        ""}id="feed-title">Historial</h2><ol class="feed-list">${items}</ol></section>`
}

/**
 * Fila de un set en los parciales, con el lado izquierdo a la izquierda.
 * @param {object} row fila del resumen
 * @param {Period} period set en curso
 * @param {string} left lado de la izquierda
 * @returns {Markup}
 */
function partialRow(row, period, left) {
    const a = row[left]
    const b = row[rival(left)]
    const now = row.period === period.number
    const current = now && !period.endedAt ? raw(" class=\"is-current\"") : null
    let minutes = row.minutes
    if (minutes === null || minutes === undefined) {
        minutes = now ? raw("<span id=\"set-clock-min\">…</span>") : ""
    }
    return html`<tr${current}><th scope="row">${row.period}</th><td><b>${a.points}</b></td><td>${
        a.timeouts}</td><td>${a.substitutions}</td><td><b>${b.points}</b></td><td>${
        b.timeouts}</td><td>${b.substitutions}</td><td>${minutes}</td></tr>`
}

/**
 * Parciales por set: puntos, tiempos y sustituciones de cada equipo y minutos.
 * @param {object} model contexto del partido
 * @param {string} left lado de la izquierda
 * @returns {Markup}
 */
function partials({ summary, period, info }, left) {
    const right = rival(left)
    const group = (side) => html`<th colspan="3" scope="colgroup"><span class="swatch" ${
        ""}style="background:${teamColor(info, side)}" aria-hidden="true"></span>${
        teamLabel(info, side)}</th>`
    const trio = html`<th>Pt</th><th title="Tiempos de descanso">T</th><th ${
        ""}title="Sustituciones">S</th>`
    const rows = summary.rows.map((row) => partialRow(row, period, left))
    return html`<section class="partials" aria-labelledby="partials-title"><h2 class="desk-title" ${
        ""}id="partials-title">Parciales</h2><table class="partials-table"><thead><tr><th ${
        ""}rowspan="2">Set</th>${group(left)}${group(right)}<th rowspan="2">Min</th></tr><tr>${
        trio}${trio}</tr></thead><tbody>${rows}</tbody></table></section>`
}

/**
 * Atajos de teclado de la pantalla ancha.
 * @param {object} info datos del acta
 * @param {string} left lado de la izquierda
 * @returns {Markup}
 */
function keyHints(info, left) {
    const item = (keys, action, team) => html`<li><span class="keys">${keys}</span> <span>${
        action}</span>${team ? html` <span class="dim">${team}</span>` : null}</li>`
    return html`<section class="key-hints" aria-labelledby="keys-title"><h2 class="desk-title" ${
        ""}id="keys-title">Atajos de teclado</h2><ul>${[
        item(raw("<kbd>←</kbd>"), "Punto", teamLabel(info, left)),
        item(raw("<kbd>→</kbd>"), "Punto", teamLabel(info, rival(left))),
        item(raw("<kbd>Ctrl</kbd>+<kbd>Z</kbd>"), "Deshacer", null),
    ]}</ul></section>`
}

/**
 * Pantalla completa del partido, con los pasos del acta delante.
 * @param {{match: Match, period: Period, info: object, plays: object[], summary: object,
 *     fullSet: object|null, shown: string|null}} model contexto del partido y lado de la
 *     consola que se ve en el móvil
 * @returns {Markup} marcado HTML
 */
export function liveView(model) {
    const { match, period, info, plays } = model
    const left = period.leftSide
    const right = rival(left)
    const shown = model.shown === right ? right : left
    const last = lastUndoable(plays)
    const lastBar = lastPlayBar({
        label: last ? describePlay(last, match) : null,
        buttonId: "undo",
    })
    const panel = (side) => teamPanel({ ...model, side, folded: side !== shown })
    return html`${stepper("live")}<div class="live">${scoreboard(model, left)}${
        matchAlerts(model)}${consoleSwitch(model, shown)}<div class="consoles">${
        panel(left)}${panel(right)}</div><aside class="desk" aria-label="Mesa del anotador">${
        lastBar}${TOOLS}${playFeed(match, info, plays)}${partials(model, left)}${
        keyHints(info, left)}</aside></div>`
}
