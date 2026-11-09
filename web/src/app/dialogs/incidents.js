/**
 * Controlador del diálogo de incidencias del reglamento que no son un punto normal.
 * @module src/app/dialogs/incidents.js
 */

import { byId } from "../dom.js"
import { ask } from "../dialog.js"
import { incidentsView, INCIDENT_TEXT } from "../views/dialogs/incidents.view.js"
import { teamLabel } from "../views/common.view.js"

/**
 * Falta de rotación o sacador incorrecto (FIVB 7.7), con anulación opcional de los puntos ganados
 * desde la falta, y equipo incompleto o que se retira (FIVB 6.4), que acaba el partido tras
 * confirmarlo.
 */
export class IncidentDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click [data-fault-side]": "fault",
        "click [data-forfeit-side]": "forfeit",
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
     * Muestra el diálogo. El foco va al campo de los puntos, el primer control.
     */
    open() {
        const info = this.#app.session.record.info
        const names = { home: teamLabel(info, "home"), away: teamLabel(info, "away") }
        this.#app.dialog.open(incidentsView({ names }), { controller: this })
    }

    /**
     * Anota la falta de rotación del lado del botón. Con los puntos del momento de la falta, el
     * motor anula los ganados después (FIVB 7.7.2); vacío, solo da punto y saque al rival.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    fault(event, button) {
        const from = byId("fault-from").value.trim()
        const play = { kind: "rotationFault", side: button.dataset.faultSide }
        if (from !== "") {
            play.rollbackTo = Number(from)
        }
        const session = this.#app.session
        if (session.commit(play)) {
            return
        }
        this.#app.dialog.close()
        const fault = session.match.rotationFaults.at(-1)
        this.#app.notifier.show(INCIDENT_TEXT.faultNoted(fault.voided), { good: true })
    }

    /**
     * Da por incompleto al equipo del botón, tras confirmarlo.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    forfeit(event, button) {
        const side = button.dataset.forfeitSide
        const team = teamLabel(this.#app.session.record.info, side)
        if (!ask(INCIDENT_TEXT.askShortHanded(team))) {
            return
        }
        if (!this.#app.session.commit({ kind: "forfeit", side, reason: "shortHanded" })) {
            this.#app.dialog.close()
        }
    }
}
