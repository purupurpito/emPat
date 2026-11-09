/**
 * Controlador del diálogo: equipo no presentado.
 * @module src/app/dialogs/no-show.js
 */

import { noShowView } from "../views/dialogs/no-show.view.js"

/**
 * Selector que no encaja con nada: el diálogo se abre sin mover el foco a ningún botón, para no
 * dejar preseleccionada la no presentación de un equipo.
 */
const NO_FOCUS = ":not(*)"

/**
 * No presentación de un equipo: pierde el partido y cada set (FIVB 6.4). El diálogo solo se
 * cierra si la jugada se acepta.
 */
export class NoShowDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click [data-no-show-side]": "declare",
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
     * Muestra el diálogo.
     */
    open() {
        const info = this.#app.session.record.info
        this.#app.dialog.open(noShowView({ info }), { controller: this, focus: NO_FOCUS })
    }

    /**
     * Anota la no presentación del equipo del botón pulsado.
     * @param {Event} event clic
     * @param {HTMLElement} button botón del equipo
     */
    declare(event, button) {
        const play = { kind: "forfeit", side: button.dataset.noShowSide, reason: "noShow" }
        if (this.#app.session.commit(play) === null) {
            this.#app.dialog.close()
        }
    }
}
