/**
 * Pantalla: intervalo entre sets.
 * @module src/app/screens/break.screen.js
 */

import { Screen } from "../screen.js"
import { byId } from "../dom.js"
import { breakClockText, breakMinutes, breakView } from "../views/break.view.js"
import { SanctionDialog } from "../dialogs/sanction.js"
import { RemarkDialog } from "../dialogs/remark.js"
import { fillLineups, refreshLineupBox, startPeriodBatch } from "./toss.screen.js"
import { showPaper } from "./paper.screen.js"

/**
 * Milisegundos de un minuto, para pasar la duración del intervalo a una hora límite.
 */
const MINUTE_MS = 60000

/**
 * Intervalo entre sets: muestra cómo acabó el set, cuenta el descanso, prepara las formaciones
 * (y el sorteo en el decisivo) y permite sancionar, deshacer, anotar observaciones, ver el
 * acta o volver a la lista mientras no empieza el set siguiente.
 */
export class BreakScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "change [data-lineup-side]": "lineupChanged",
        "click #start-period": "start",
        "click [data-break-sanction]": "sanction",
        "click #undo": "undo",
        "click #open-note": "note",
        "click #open-paper": "paper",
        "click #go-list": "leave",
    }

    /** si el set siguiente lleva sorteo, fijado al pintar */
    #withToss = false
    /** hora límite del intervalo en milisegundos, o null si no se cuenta */
    #deadline = null

    /**
     * Marcado de la pantalla. Deja preparados el sorteo y la hora límite del reloj.
     * @returns {Markup}
     */
    view() {
        const { record, match } = this.app.session
        const periods = match.periods
        const previous = periods[periods.length - 2]
        const current = this.app.rules.currentPeriod(match)
        const minutes = breakMinutes(record.settings, previous.number)
        const showClock = minutes > 0 && Boolean(previous.endedAt)
        this.#withToss = current.decider
        this.#deadline = showClock ? Date.parse(previous.endedAt) + minutes * MINUTE_MS : null
        return breakView({
            info: record.info,
            settings: match.settings,
            setsWon: match.setsWon,
            previous,
            current,
            showClock,
            pending: match.pendingPenalties,
            prefill: {
                home: current.lineup.home || previous.lineup.home,
                away: current.lineup.away || previous.lineup.away,
            },
        })
    }

    /**
     * Rellena las formaciones y arranca el reloj del intervalo, que se refresca cada segundo
     * con el pulso compartido.
     */
    mounted() {
        fillLineups(this.root, this.app.session.match)
        if (this.#deadline === null || byId("break-clock") === null) {
            return
        }
        const ticker = this.app.ticker
        ticker.every(1000, () => this.#tick())
    }

    /**
     * Un pulso del reloj: segundos que faltan o, en rojo, los que han pasado. Si el reloj ha
     * desaparecido de la página, el pulso se para solo.
     */
    #tick() {
        const clock = byId("break-clock")
        if (clock === null) {
            this.app.ticker.stop()
            return
        }
        const seconds = Math.round((this.#deadline - Date.now()) / 1000)
        clock.classList.toggle("break-timer--over", seconds < 0)
        clock.textContent = breakClockText(seconds)
    }

    /**
     * Rehace las opciones del equipo cuyo desplegable ha cambiado.
     * @param {Event} event cambio
     * @param {HTMLElement} box contenedor del equipo
     */
    lineupChanged(event, box) {
        refreshLineupBox(box, this.app.session.match)
    }

    /**
     * Empieza el set siguiente con las formaciones elegidas y, en el decisivo, el sorteo.
     */
    start() {
        startPeriodBatch(this.app, this.root, this.#withToss)
    }

    /**
     * Abre la sanción de un equipo durante el intervalo.
     * @param {Event} event clic
     * @param {HTMLElement} button botón con el lado
     */
    sanction(event, button) {
        new SanctionDialog(this.app).open({ side: button.dataset.breakSanction })
    }

    /**
     * Deshace la última jugada, que suele ser el punto que cerró el set.
     */
    undo() {
        this.app.session.undo()
    }

    /**
     * Abre el diálogo de observaciones.
     */
    note() {
        new RemarkDialog(this.app).open()
    }

    /**
     * Pasa a la vista del acta para imprimir.
     */
    paper() {
        showPaper(this.app)
    }

    /**
     * Cierra el acta y vuelve a la lista.
     */
    leave() {
        this.app.session.leave()
    }
}
