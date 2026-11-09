/**
 * Controlador del diálogo: reapertura de un acta cerrada.
 * @module src/app/dialogs/reopen.js
 */

import { reopenView } from "../views/dialogs/reopen.view.js"
import { byId } from "../dom.js"

/**
 * Pide la clave del primer árbitro para reabrir un acta aprobada. La comprobación y la
 * anotación en las correcciones las hace la sesión; el diálogo solo se cierra si la reapertura
 * sale bien, para poder corregir una clave mal escrita.
 */
export class ReopenDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #reopen-ok": "confirm",
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
     * Muestra el diálogo con el foco en la clave.
     */
    open() {
        this.#app.dialog.open(reopenView(), { focus: "#reopen-pin", controller: this })
    }

    /**
     * Intenta reabrir con la clave escrita.
     */
    confirm() {
        const app = this.#app
        if (app.session.reopen(byId("reopen-pin").value) === null) {
            app.dialog.close()
        }
    }
}
