/**
 * Hoja de diálogo única de la aplicación y confirmaciones del navegador.
 * @module src/app/dialog.js
 */

import { i18n } from "../i18n/language.js"
import { byId, focusKey, restoreFocus } from "./dom.js"
import { delegate } from "./screen.js"

/**
 * Elementos que reciben el foco por defecto al abrir: el primero que haya.
 */
const FIRST_FOCUSABLE = "button,input,select,textarea"

/**
 * Abre y cierra la hoja #dlg. Solo hay una: abrir otra sustituye el contenido. Un clic en el
 * fondo o en un elemento con data-dismiss la cierra. Al cerrar detiene la cuenta atrás activa,
 * porque solo vive dentro de un diálogo.
 */
export class DialogHost {
    #countdown
    #bus
    #release = null
    #installed = false
    #locked = false

    /**
     * @param {{countdown?: Countdown, bus?: Bus}} [deps] cuenta atrás que se para al cerrar y
     *     bus donde se anuncia el cierre
     */
    constructor({ countdown = null, bus = null } = {}) {
        this.#countdown = countdown
        this.#bus = bus
    }

    /**
     * Engancha el cierre por clic en el fondo o en [data-dismiss]. Se llama una vez al arrancar.
     */
    install() {
        if (this.#installed) {
            return
        }
        this.#installed = true
        byId("dlg").addEventListener("click", (event) => {
            const origin = event.target
            if (origin.closest("[data-dismiss]") || (origin.id === "dlg" && !this.#locked)) {
                this.close()
            }
        })
    }

    /**
     * Muestra un diálogo. Si se pasa un controlador, sus eventos estáticos (el mismo formato que
     * las pantallas) se reparten sobre #dlg-body hasta que se cierre.
     * @param {string|Markup} markup contenido
     * @param {{focus?: string, centered?: boolean, controller?: object, locked?: boolean}}
     *     [options] selector del elemento que recibe el foco (por defecto, el primer control),
     *     hoja centrada en vez de pegada abajo, objeto con los métodos de los eventos y si es
     *     obligatoria: entonces ni el fondo ni Escape la cierran, solo sus propios botones
     */
    open(markup, { focus, centered, controller, locked = false } = {}) {
        this.#detach()
        this.#locked = locked
        const body = byId("dlg-body")
        body.innerHTML = String(markup)
        const sheet = byId("dlg")
        sheet.classList.remove("is-hidden")
        if (centered) {
            sheet.classList.add("dlg--center")
        }
        if (controller) {
            const events = controller.constructor.events || controller.events || {}
            this.#release = delegate(body, events, controller)
        }
        const target = body.querySelector(focus || FIRST_FOCUSABLE)
        target?.focus()
    }

    /**
     * Rehace el contenido del diálogo abierto sin cerrarlo, con el foco en el control
     * equivalente al que lo tenía. Los oyentes siguen valiendo: están en #dlg-body.
     * @param {string|Markup} markup contenido nuevo
     */
    redraw(markup) {
        const body = byId("dlg-body")
        const focused = focusKey(body)
        body.innerHTML = String(markup)
        restoreFocus(body, focused)
    }

    /**
     * Oculta el diálogo, vacía su contenido y para la cuenta atrás.
     */
    close() {
        this.#countdown?.stop()
        this.#detach()
        this.#locked = false
        const sheet = byId("dlg")
        sheet.classList.remove("dlg--center")
        sheet.classList.add("is-hidden")
        byId("dlg-body").innerHTML = ""
        this.#bus?.emit("dialog:closed")
    }

    /**
     * Si hay un diálogo visible.
     * @returns {boolean}
     */
    get isOpen() {
        return !byId("dlg").classList.contains("is-hidden")
    }

    /**
     * Si el diálogo visible es obligatorio y solo se cierra con sus botones.
     * @returns {boolean}
     */
    get isLocked() {
        return this.isOpen && this.#locked
    }

    /**
     * Suelta los oyentes del controlador anterior.
     */
    #detach() {
        if (this.#release !== null) {
            this.#release()
            this.#release = null
        }
    }
}

/**
 * Pide confirmación con el diálogo nativo, con la pregunta ya en el idioma activo: el
 * observador de idioma no llega a los diálogos del navegador.
 * @param {string} question pregunta en castellano
 * @returns {boolean}
 */
export function ask(question) {
    return globalThis.confirm(i18n.t(question))
}
