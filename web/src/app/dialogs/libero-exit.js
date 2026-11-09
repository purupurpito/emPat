/**
 * Controlador del aviso de salida automática del líbero.
 * @module src/app/dialogs/libero-exit.js
 */

import { liberoExitView } from "../views/dialogs/libero-exit.view.js"
import { teamLabel } from "../views/common.view.js"

/**
 * Aviso que sale cuando el líbero, al rotar, llega a la delantera y tiene que dejar la pista
 * (FIVB 19.3.1.3). No anota nada: el motor ya ha hecho la salida y solo se explica quién vuelve.
 */
export class LiberoExitNotice {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #libero-exit-ok": "dismiss",
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
     * Muestra el aviso con el botón de entendido enfocado.
     * @param {{exits: object[]}} options salidas automáticas recién apuntadas por el motor
     */
    open({ exits }) {
        const { record, match } = this.#app.session
        const rows = exits.map((exit) => ({
            team: teamLabel(record.info, exit.side),
            libero: exit.libero,
            back: exit.back,
            backName: match.teams[exit.side].find(exit.back)?.name || "",
        }))
        const markup = liberoExitView({ exits: rows })
        this.#app.dialog.open(markup, { controller: this, focus: "#libero-exit-ok" })
    }

    /**
     * Cierra el aviso.
     */
    dismiss() {
        this.#app.dialog.close()
    }
}
