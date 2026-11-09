/**
 * Controladores de los avisos del líbero que rota: la salida automática de las actas antiguas,
 * la salida que confirma el anotador y la propuesta de volver a entrar tras el saque.
 * @module src/app/dialogs/libero-exit.js
 */

import { liberoExitView, liberoLeaveView, liberoReturnView } from "../views/dialogs/libero-exit.view.js"
import { teamLabel } from "../views/common.view.js"
import { teamColor } from "../colors.js"

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

/**
 * Salida del líbero que ha rotado a la delantera y que el anotador tiene que confirmar. Al
 * confirmarla se apunta como cualquier salida del líbero (liberoOut), con su marcador.
 */
export class LiberoLeaveDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #libero-leave-ok": "confirm",
        "click #libero-leave-later": "later",
    }

    #app
    #side = "home"

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra la salida pendiente de un lado con el botón de confirmar enfocado.
     * @param {{side: string}} options lado cuyo líbero tiene que salir
     */
    open({ side }) {
        const { record, match } = this.#app.session
        const libero = match.current.libero[side]
        if (!libero) {
            return
        }
        this.#side = side
        const markup = liberoLeaveView({
            team: teamLabel(record.info, side),
            tint: teamColor(record.info, side),
            libero: libero.shirt,
            back: libero.replacing,
            backName: match.teams[side].find(libero.replacing)?.name || "",
        })
        this.#app.dialog.open(markup, { controller: this, focus: "#libero-leave-ok" })
    }

    /**
     * Apunta la salida y cierra si el motor la acepta.
     */
    confirm() {
        if (!this.#app.session.commit({ kind: "liberoOut", side: this.#side })) {
            this.#app.dialog.close()
        }
    }

    /**
     * Cierra sin apuntar nada; la salida sigue pendiente en la franja de avisos.
     */
    later() {
        this.#app.dialog.close()
    }
}

/**
 * Propuesta de volver a meter al líbero por el jugador que acaba de perder el saque. Solo
 * propone: si el anotador acepta se apunta la entrada (liberoIn) como cualquier otra.
 */
export class LiberoReturnDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #libero-return-ok": "accept",
        "click #libero-return-later": "later",
    }

    #app
    #play = null

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra la propuesta.
     * @param {{side: string, libero: string, server: string}} options lado, líbero que
     *     entraría y jugador por el que entraría
     */
    open({ side, libero, server }) {
        const { record } = this.#app.session
        this.#play = { kind: "liberoIn", side, libero, leaving: server }
        const markup = liberoReturnView({
            team: teamLabel(record.info, side),
            tint: teamColor(record.info, side),
            libero,
            server,
        })
        this.#app.dialog.open(markup, { controller: this, focus: "#libero-return-ok" })
    }

    /**
     * Apunta la entrada del líbero y cierra si el motor la acepta.
     */
    accept() {
        if (!this.#app.session.commit({ ...this.#play })) {
            this.#app.dialog.close()
        }
    }

    /**
     * Cierra sin apuntar nada.
     */
    later() {
        this.#app.dialog.close()
    }
}
