/**
 * Vista del diálogo del tiempo de descanso: la cuenta atrás dentro de un anillo.
 * @module src/app/views/dialogs/timeout.view.js
 */

import { html } from "../../dom.js"
import { dialogFoot, dialogHead } from "../common.view.js"

/**
 * Aviso cuando la cuenta llega a cero.
 */
export const TIMEOUT_OVER = "Se acabó el tiempo de descanso."

/**
 * Botón para cortar la cuenta y volver al partido.
 */
const BACK = html`<button type="button" class="cta" id="back-to-match">Seguir con el partido</button>`

/**
 * Marcado del diálogo: la cuenta atrás en el centro de un anillo que se vacía.
 * @param {{team: string, tint?: string, used: number, limit: number, seconds: number,
 *     homeName: string, awayName: string, score: {home: number, away: number}}} model equipo
 *     que lo pide y su color, cuántos lleva y cuántos tiene, duración, y marcador del set con
 *     los dos nombres
 * @returns {Markup} marcado HTML
 */
export function timeoutView(model) {
    const last = model.used === model.limit ? " (último)" : ""
    const tally = `${model.used} de ${model.limit} en este set${last}`
    const score = `${model.homeName ?? ""} ${model.score.home}-${model.score.away} ${
        model.awayName ?? ""}`
    return html`${dialogHead({ title: "Tiempo de descanso", team: model.team, tint: model.tint })}${
        ""}<p class="sheet-lead">${tally} · ${score}</p><div class="countdown-ring" ${
        ""}id="countdown-ring" style="--share:100"><div class="countdown" id="countdown" ${
        ""}role="timer" aria-live="off">${model.seconds}</div></div>${dialogFoot(BACK)}`
}
