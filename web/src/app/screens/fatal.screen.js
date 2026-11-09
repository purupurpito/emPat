/**
 * Pantalla de error: se usa cuando el pintado o el arranque fallan.
 * @module src/app/screens/fatal.screen.js
 */

import { Screen } from "../screen.js"
import { fatalView } from "../views/fatal.view.js"
import { serializeRecord } from "../record.js"
import { byId } from "../dom.js"

/**
 * Aplicación a la que pertenece la pantalla de error. Se fija al crear la aplicación; si el
 * fallo llega sin ella, la pantalla de error funciona igual, sin acta.
 * @type {App|null}
 */
let owner = null

/**
 * Indica la aplicación con la que trabajará showFatal.
 * @param {App|null} app aplicación
 */
export function setFatalContext(app) {
    owner = app
}

/**
 * Texto de un error cualquiera: su mensaje si lo tiene; si no, el valor convertido a texto.
 * @param {unknown} error causa
 * @returns {string}
 */
function detailOf(error) {
    if (error && error.message) {
        return error.message
    }
    return String(error)
}

/**
 * Muestra el error con opciones para reintentar, descargar el acta o volver a la lista. Los
 * datos siguen en el dispositivo: la descarga es para no depender de que esta versión los sepa
 * abrir.
 */
class FatalScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "click #fatal-retry": "retry",
        "click #fatal-download": "download",
        "click #fatal-home": "goHome",
    }

    #detail

    /**
     * @param {App|null} app aplicación, si ya existe
     * @param {unknown} error causa
     */
    constructor(app, error) {
        super(app)
        this.#detail = detailOf(error)
    }

    /**
     * Acta abierta, si la hay.
     * @returns {object|null}
     */
    get #record() {
        return this.app?.session.record ?? null
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        return fatalView({ withRecord: this.#record !== null, detail: this.#detail })
    }

    /**
     * Recarga la página tal cual.
     */
    retry() {
        location.reload()
    }

    /**
     * Vuelve a la lista quitando el acta de la dirección.
     */
    goHome() {
        location.href = location.pathname
    }

    /**
     * Descarga el acta abierta en el formato de exportación.
     */
    download() {
        const record = this.#record
        const blob = new Blob([serializeRecord(record)], { type: "application/json" })
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `acta-${record.id}.json`
        link.click()
    }
}

/**
 * Sustituye la pantalla actual por la de error, para el reloj y marca el arranque como
 * resuelto, para que la vigilancia de arranque no tape el mensaje.
 * @param {unknown} error causa
 */
export function showFatal(error) {
    console.error(error)
    const app = owner
    globalThis.empatBooted = true
    const screen = new FatalScreen(app, error)
    if (app === null) {
        screen.mount(byId("stage"))
        return
    }
    app.router.show(screen)
    app.booted = true
}
