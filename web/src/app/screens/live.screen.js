/**
 * Pantalla: partido en juego.
 * @module src/app/screens/live.screen.js
 */

import { Screen } from "../screen.js"
import { byId } from "../dom.js"
import { liveView, LIVE_TEXT } from "../views/live.view.js"
import { SubstitutionDialog } from "../dialogs/substitution.js"
import { LiberoDialog } from "../dialogs/libero.js"
import { IncidentDialog } from "../dialogs/incidents.js"
import { SanctionDialog } from "../dialogs/sanction.js"
import { TimeoutDialog } from "../dialogs/timeout.js"
import { RemarkDialog } from "../dialogs/remark.js"
import { currentPeriod, fullSetReport, summarize } from "../../rules/index.js"

/**
 * Pulso del reloj del set.
 */
const CLOCK_MS = 1000

/**
 * Diálogo que abre cada botón de acción de un panel. El tiempo de descanso no está aquí: primero
 * se anota y solo si se acepta se abre su cuenta atrás.
 */
const ACTION_DIALOGS = Object.freeze({
    substitution: SubstitutionDialog,
    libero: LiberoDialog,
    sanction: SanctionDialog,
})

/**
 * Consola de equipo que se ve en el móvil. Se recuerda entre repintados (la pantalla se vuelve
 * a montar tras cada jugada) y vale para cualquier acta: si no es un lado, se ve el de la
 * izquierda.
 */
let shownSide = null

/**
 * Minutos y segundos transcurridos, en formato m:ss.
 * @param {number} seconds segundos
 * @returns {string}
 */
function minutesAndSeconds(seconds) {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

/**
 * Partido en juego: puntos, pausas, cambios, líbero, sanciones e incidencias. Cada botón se
 * traduce en una jugada a través de la sesión o abre su diálogo; la pantalla no guarda estado
 * propio y se vuelve a montar entera tras cada jugada aceptada.
 */
export class LiveScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "click [data-score]": "score",
        "click [data-action]": "act",
        "click [data-tap]": "tap",
        "click [data-acting-captain]": "nameCaptain",
        "click [data-libero-enter]": "sendLibero",
        "click [data-libero-leave]": "confirmLiberoExit",
        "click #undo-court": "undo",
        "click #undo": "undo",
        "click #mark-replay": "markReplay",
        "click #open-incidents": "openIncidents",
        "click #open-note": "openNote",
        "click #open-paper": "openPaper",
        "click #go-list": "leave",
        "click [data-show-side]": "showSide",
    }

    /**
     * Contexto con el que se pinta: partido, set en curso, datos, jugadas y resúmenes.
     * @returns {object}
     */
    context() {
        const session = this.app.session
        const match = session.match
        return {
            match,
            period: currentPeriod(match),
            info: session.record.info,
            plays: session.record.plays,
            summary: summarize(match),
            fullSet: match.settings.fullSetRule ? fullSetReport(match) : null,
            shown: shownSide,
        }
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        return liveView(this.context())
    }

    /**
     * Con la pantalla montada: pantalla encendida y reloj del set desde el primer saque.
     */
    mounted() {
        this.app.wake.hold()
        const startedAt = Date.parse(currentPeriod(this.app.session.match).startedAt)
        this.app.ticker.every(CLOCK_MS, () => this.tick(startedAt))
    }

    /**
     * Refresca el reloj del set y los minutos del set en curso en la tabla. Si la pantalla se ha
     * desmontado, para el pulso.
     * @param {number} startedAt instante del primer saque, en milisegundos
     */
    tick(startedAt) {
        const clock = byId("set-clock")
        if (clock === null) {
            this.app.ticker.stop()
            return
        }
        const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
        clock.textContent = minutesAndSeconds(seconds)
        const minutes = byId("set-clock-min")
        if (minutes !== null) {
            minutes.textContent = String(Math.floor(seconds / 60))
        }
    }

    /**
     * Punto para el lado del botón.
     * @param {Event} event clic
     * @param {HTMLElement} button botón pulsado
     */
    score(event, button) {
        this.app.session.commit({ kind: "rally", side: button.dataset.score })
    }

    /**
     * Botón de acción de un panel. El tiempo de descanso se anota al momento y, si se acepta,
     * abre la cuenta atrás; el resto abre su diálogo.
     * @param {Event} event clic
     * @param {HTMLElement} button botón pulsado
     */
    act(event, button) {
        const side = button.dataset.side
        const action = button.dataset.action
        if (action === "timeout") {
            if (!this.app.session.commit({ kind: "timeout", side })) {
                new TimeoutDialog(this.app).open({ side })
            }
            return
        }
        new ACTION_DIALOGS[action](this.app).open({ side })
    }

    /**
     * Toque en un jugador de la pista: el líbero abre su diálogo y cualquier otro abre la
     * sustitución con él ya elegido para salir.
     * @param {Event} event clic
     * @param {HTMLElement} button casilla pulsada
     */
    tap(event, button) {
        const side = button.dataset.tap
        const shirt = button.dataset.shirt
        const libero = currentPeriod(this.app.session.match).libero[side]
        if (libero && libero.shirt === shirt) {
            new LiberoDialog(this.app).open({ side })
            return
        }
        new SubstitutionDialog(this.app).open({ side, chosen: shirt })
    }

    /**
     * Designa capitán en juego al jugador del botón.
     * @param {Event} event clic
     * @param {HTMLElement} button botón pulsado
     */
    nameCaptain(event, button) {
        const [side, shirt] = button.dataset.actingCaptain.split("|")
        if (!this.app.session.commit({ kind: "actingCaptain", side, shirt })) {
            this.app.notifier.show(LIVE_TEXT.actingCaptain(shirt), { good: true })
        }
    }

    /**
     * Entrada del líbero propuesta por el aviso del panel.
     * @param {Event} event clic
     * @param {HTMLElement} button botón pulsado
     */
    sendLibero(event, button) {
        const [side, libero, leaving] = button.dataset.liberoEnter.split("|")
        this.app.session.commit({ kind: "liberoIn", side, libero, leaving })
    }

    /**
     * Apunta la salida del líbero que ha rotado a la delantera, desde la franja de avisos.
     * @param {Event} event clic
     * @param {HTMLElement} button botón pulsado
     */
    confirmLiberoExit(event, button) {
        this.app.session.commit({ kind: "liberoOut", side: button.dataset.liberoLeave })
    }

    /**
     * Deshace la última jugada.
     */
    undo() {
        this.app.session.undo()
    }

    /**
     * Anota una repetición de la jugada, sin punto para nadie.
     */
    markReplay() {
        if (!this.app.session.commit({ kind: "replayRally" })) {
            this.app.notifier.show(LIVE_TEXT.replayNoted, { good: true })
        }
    }

    /**
     * Abre las incidencias del reglamento.
     */
    openIncidents() {
        new IncidentDialog(this.app).open()
    }

    /**
     * Abre la observación.
     */
    openNote() {
        new RemarkDialog(this.app).open()
    }

    /**
     * Pasa a la vista del acta para imprimir.
     */
    openPaper() {
        this.app.session.paperMode = true
        this.app.router.render()
        scrollTo(0, 0)
    }

    /**
     * Cambia la consola de equipo que se ve en el móvil, sin repintar la pantalla.
     * @param {Event} event clic
     * @param {HTMLElement} button botón del lado
     */
    showSide(event, button) {
        shownSide = button.dataset.showSide
        for (const toggle of this.root.querySelectorAll("[data-show-side]")) {
            toggle.setAttribute("aria-pressed", String(toggle === button))
        }
        for (const panel of this.root.querySelectorAll("[data-panel]")) {
            panel.classList.toggle("is-folded", panel.dataset.panel !== shownSide)
        }
    }

    /**
     * Cierra el acta y vuelve a la lista.
     */
    leave() {
        this.app.session.leave()
    }
}
