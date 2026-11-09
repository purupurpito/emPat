/**
 * Intervalo entre sets. Función pura: recibe un modelo y devuelve marcado; no lee estado
 * global.
 *
 * Arriba, una cabecera en tinta con el set que acaba de terminar, el reloj del descanso, lo que
 * trae el set siguiente y las acciones del intervalo (deshacer, observación y ver el acta).
 * Debajo, el sorteo si toca y la formación de cada equipo con su botón de sanción; al pie, la
 * barra fija con el botón de empezar el set.
 * @module src/app/views/break.view.js
 */

import { html } from "../dom.js"
import { teamColor } from "../colors.js"
import { SANCTION_LABELS } from "../constants.js"
import { actionDock, stepper, sidePicker, teamLabel } from "./common.view.js"
import { lineupPicker } from "./toss.view.js"

/**
 * Minutos de intervalo cuando el acta no dice nada (FIVB 18.1: tres minutos).
 */
const DEFAULT_BREAK_MINUTES = 3

/**
 * Minutos que dura el intervalo que sigue a un set. Tras el segundo set puede haber una
 * duración propia (algunas competiciones alargan ese descanso); si no la hay, vale la general.
 * @param {object} settings ajustes guardados en el acta
 * @param {number} finishedNumber número del set que acaba de terminar
 * @returns {number}
 */
export function breakMinutes(settings, finishedNumber) {
    let minutes = settings.breakMinutes
    if (finishedNumber === 2) {
        minutes = settings.secondBreakMinutes ?? settings.breakMinutes
    }
    return minutes ?? DEFAULT_BREAK_MINUTES
}

/**
 * Minutos y segundos con dos cifras en los segundos (m:ss).
 * @param {number} seconds segundos, no negativos
 * @returns {string}
 */
function minutesAndSeconds(seconds) {
    const rest = String(seconds % 60).padStart(2, "0")
    return `${Math.floor(seconds / 60)}:${rest}`
}

/**
 * Texto del reloj del intervalo: lo que queda o, si ya se ha pasado, cuánto hace que acabó.
 * @param {number} seconds segundos que faltan; negativos si el intervalo ya ha terminado
 * @returns {string}
 */
export function breakClockText(seconds) {
    if (seconds < 0) {
        return "El intervalo terminó hace " + minutesAndSeconds(-seconds)
    }
    return "Quedan " + minutesAndSeconds(seconds) + " de intervalo"
}

/**
 * Titular: quién ganó el set que acaba de terminar o, si lo que viene es el golden set, el
 * resultado ya cerrado del partido.
 * @param {object} model modelo de la vista
 * @returns {string}
 */
function headline({ info, previous, current, setsWon }) {
    if (current.isGolden) {
        const high = Math.max(setsWon.home, setsWon.away)
        const low = Math.min(setsWon.home, setsWon.away)
        return `Golden set · partido terminado ${high}-${low}`
    }
    const winner = previous.winner
    const loser = winner === "home" ? "away" : "home"
    const name = teamLabel(info, winner) ?? ""
    return `Set ${previous.number} para ${name}, ${previous.score[winner]}-${
        previous.score[loser]}`
}

/**
 * Explicación de lo que trae el set siguiente: sorteo y cambio de campo en el decisivo y en el
 * golden, y quién saca en los demás.
 * @param {object} model modelo de la vista
 * @returns {Markup}
 */
function nextSetNote({ info, current, settings }) {
    const target = settings.deciderPoints
    const swap = settings.deciderSwitch
    if (current.isGolden) {
        return html`<p class="interval-note">Set de desempate a ${
            target} puntos, con sorteo y cambio de campo cuando un equipo alcanza ${
            swap}. El resultado del partido se mantiene.</p>`
    }
    if (current.decider) {
        return html`<p class="interval-note">Set decisivo a ${
            target} puntos, con sorteo y cambio de campo cuando un equipo alcanza ${swap}.</p>`
    }
    return html`<p class="interval-note">Se cambia de campo y empieza sacando ${
        teamLabel(info, current.firstServer)}.</p>`
}

/**
 * Sorteo del set decisivo, con lo que ya estuviera marcado.
 * @param {object} model modelo de la vista
 * @returns {Markup}
 */
function deciderToss({ info, current }) {
    const server = sidePicker({ name: "server", selected: current.firstServer, info })
    const left = sidePicker({ name: "left", selected: current.leftSide, info })
    const first = html`<fieldset><legend>Primer saque</legend>${server}</fieldset>`
    const side = html`<fieldset><legend>Equipo a la izquierda del anotador</legend>${left}</fieldset>`
    return html`<section class="panel"><h2>Sorteo para el set decisivo</h2><div class="cols-2">${
        first}${side}</div></section>`
}

/**
 * Aviso de los castigos que se apuntarán al empezar el set (sanciones puestas en el intervalo).
 * @param {object} model modelo de la vista
 * @returns {Markup|null}
 */
function pendingNote({ info, pending }) {
    if (pending.length === 0) {
        return null
    }
    const parts = []
    for (const { side, level } of pending) {
        const label = (SANCTION_LABELS[level] ?? "").toLowerCase()
        parts.push(`punto para ${teamLabel(info, side) ?? ""} (${label})`)
    }
    return html`<p class="banner banner--bad">Pendiente para el inicio del set: ${parts.join(" · ")}.</p>`
}

/**
 * Formación de un equipo para el set siguiente, con su nombre y su botón de sanción.
 * @param {object} info datos del encuentro
 * @param {"home"|"away"} side lado
 * @param {Array<string|null>|undefined} prefill formación propuesta
 * @returns {Markup}
 */
function lineupPanel(info, side, prefill) {
    const name = teamLabel(info, side)
    const sanction = html`<button type="button" data-break-sanction="${side}"><span>Sanción</span>${
        html`<span class="visually-hidden"> ${name}</span>`}</button>`
    return html`<section class="panel roster-panel" style="--team-tint:${
        teamColor(info, side)}"><div class="lineup-head"><h2>${name}</h2>${sanction}</div>${
        lineupPicker({ side, prefill })}</section>`
}

/**
 * Resultado del set que acaba de terminar, equipo a equipo, con los sets en medio. En el golden
 * set no hay set terminado que enseñar: solo los sets.
 * @param {object} model modelo de la vista
 * @returns {Markup}
 */
function setResult({ info, previous, current, setsWon }) {
    const team = (side) => {
        const winner = !current.isGolden && previous.winner === side ? " is-winner" : ""
        const points = current.isGolden ? null : html`<span class="interval-points">${
            previous.score[side]}</span>`
        return html`<div class="interval-team${winner}"><span class="interval-name">${
            teamLabel(info, side)}</span>${points}</div>`
    }
    return html`<div class="interval-score">${team("home")}<div class="interval-sets">${
        html`<span>Sets</span>`}<b>${setsWon.home}-${setsWon.away}</b></div>${team("away")}</div>`
}

/**
 * Pantalla del intervalo: resultado del set terminado, reloj del descanso, sorteo si toca,
 * formaciones del set siguiente, castigos pendientes y acciones.
 * @param {{info: object, settings: object, setsWon: {home: number, away: number},
 *     previous: object, current: object, showClock: boolean,
 *     pending: Array<{side: string, level: string}>,
 *     prefill: {home: Array|undefined, away: Array|undefined}}} model datos del encuentro,
 *     ajustes del motor, sets ganados, set terminado y siguiente, si hay reloj, castigos
 *     pendientes y formaciones propuestas
 * @returns {Markup} marcado HTML
 */
export function breakView(model) {
    const { info, current, prefill } = model
    const clock = model.showClock
        ? html`<p class="break-timer" id="break-clock" aria-live="off"></p>`
        : ""
    const toss = current.decider ? deciderToss(model) : ""
    const tools = html`<div class="interval-actions">${[
        html`<button type="button" id="undo">Deshacer</button>`,
        html`<button type="button" id="open-note">Observación</button>`,
        html`<button type="button" id="open-paper">Ver el acta</button>`,
    ]}</div>`
    const start = html`<button type="button" class="cta" id="start-period">Comenzar set ${
        current.number}</button>`
    const leave = html`<button type="button" class="quiet" id="go-list">Mis actas</button>`
    return html`${stepper("break")}<section class="interval" aria-labelledby="interval-title"><h2 ${
        ""}id="interval-title">${headline(model)}</h2>${setResult(model)}${clock}${
        nextSetNote(model)}${tools}</section>${toss}${pendingNote(model)}<h2 ${
        ""}class="section-title">Formación inicial</h2><div class="duo duo--compact">${
        lineupPanel(info, "home", prefill.home)}${lineupPanel(info, "away", prefill.away)}</div>${
        actionDock(html`${leave}${start}`)}`
}
