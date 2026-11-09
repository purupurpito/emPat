/**
 * Controlador del diálogo del tiempo de descanso.
 * @module src/app/dialogs/timeout.js
 */

import { byId } from "../dom.js"
import { TIMEOUT_OVER, timeoutView } from "../views/dialogs/timeout.view.js"
import { teamLabel } from "../views/common.view.js"
import { currentPeriod } from "../../rules/index.js"
import { teamColor } from "../colors.js"

/**
 * Duración por defecto de un tiempo de descanso, en segundos (FIVB 15.4.1).
 */
const DEFAULT_SECONDS = 30

/**
 * Segundos desde los que la cuenta se marca como final.
 */
const ENDING_SECONDS = 5

/**
 * Vibración al acabar: dos pulsos cortos.
 */
const BUZZ = Object.freeze([200, 100, 200])

/**
 * Cuenta atrás de un tiempo de descanso ya anotado, en un diálogo centrado. "Volver al partido"
 * lo corta; al llegar a cero se cierra solo, avisa y vibra si el aparato puede. La
 * duración sale de los ajustes del acta, por si una competición la cambia.
 */
export class TimeoutDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #back-to-match": "dismiss",
    }

    #app

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo y arranca la cuenta.
     * @param {{side: string}} options lado que ha pedido el tiempo
     */
    open({ side }) {
        const { record, match } = this.#app.session
        const period = currentPeriod(match)
        const seconds = record.settings.timeoutSeconds || DEFAULT_SECONDS
        const deadline = Date.now() + seconds * 1000
        const markup = timeoutView({
            team: teamLabel(record.info, side),
            tint: teamColor(record.info, side),
            used: period.timeouts[side].length,
            limit: match.settings.timeouts,
            seconds,
            homeName: record.info.homeName,
            awayName: record.info.awayName,
            score: period.score,
        })
        this.#app.dialog.open(markup, { controller: this, centered: true, focus: "#back-to-match" })
        this.#app.countdown.start(seconds, () => this.#tick(deadline, seconds), () => {})
    }

    /**
     * Corta la cuenta y vuelve al partido.
     */
    dismiss() {
        this.#app.dialog.close()
    }

    /**
     * Pinta los segundos que quedan y el anillo; al llegar a cero termina. Devuelve false para
     * parar la cuenta cuando el diálogo ha desaparecido o cuando ha terminado.
     * @param {number} deadline instante final, en milisegundos
     * @param {number} seconds duración total
     * @returns {boolean|undefined}
     */
    #tick(deadline, seconds) {
        const counter = byId("countdown")
        if (counter === null) {
            return false
        }
        const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
        counter.textContent = left
        counter.classList.toggle("countdown--ending", left <= ENDING_SECONDS)
        const share = (100 * (deadline - Date.now())) / (seconds * 1000)
        byId("countdown-ring")?.style.setProperty("--share", String(Math.max(0, share)))
        if (left <= 0) {
            this.#finish()
            return false
        }
        return undefined
    }

    /**
     * Cierra el diálogo al acabar la cuenta, avisa y hace vibrar el aparato si se puede.
     */
    #finish() {
        if (byId("countdown") === null) {
            return
        }
        this.#app.dialog.close()
        this.#app.notifier.show(TIMEOUT_OVER, { good: true })
        try {
            navigator.vibrate?.(BUZZ)
        } catch {
            // Sin vibración no pasa nada.
        }
    }
}
