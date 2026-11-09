/**
 * Avisos breves en la franja inferior.
 * @module src/app/notifier.js
 */

import { i18n } from "../i18n/language.js"
import { byId } from "./dom.js"

/**
 * Tiempo en pantalla de un aviso simple.
 */
const BASE_MS = 3200

/**
 * Tiempo extra por cada línea adicional de un aviso múltiple.
 */
const EXTRA_LINE_MS = 1800

/**
 * Muestra un aviso temporal en #flash. Un aviso nuevo sustituye al que hubiera y reinicia el
 * temporizador. El texto simple lo traduce el observador de idioma al insertarse; las líneas de
 * un aviso múltiple se traducen una a una y luego se unen, porque el catálogo conoce cada
 * frase por separado y no su suma.
 */
export class Notifier {
    #timer = null

    /**
     * Muestra un aviso.
     * @param {string} text texto
     * @param {{good?: boolean, ms?: number}} [options] estilo de éxito y duración
     */
    show(text, { good = false, ms } = {}) {
        const flash = byId("flash")
        flash.textContent = text
        flash.className = good ? "flash--good" : ""
        flash.style.display = "block"
        this.#schedule(ms ?? BASE_MS, () => {
            flash.style.display = "none"
        })
    }

    /**
     * Muestra varias líneas en un solo aviso, más rato cuantas más haya. El salto de línea se
     * respeta mientras dura este aviso y se quita al esconderlo.
     * @param {string[]} lines líneas en castellano
     */
    many(lines) {
        const translated = []
        for (const line of lines) {
            translated.push(i18n.t(line))
        }
        this.show(translated.join("\n"))
        const flash = byId("flash")
        flash.style.whiteSpace = "pre-line"
        const span = BASE_MS + EXTRA_LINE_MS * (lines.length - 1)
        this.#schedule(span, () => {
            flash.style.display = "none"
            flash.style.whiteSpace = ""
        })
    }

    /**
     * Programa el cierre del aviso, anulando el cierre pendiente.
     * @param {number} ms espera
     * @param {() => void} hide cierre
     */
    #schedule(ms, hide) {
        clearTimeout(this.#timer)
        this.#timer = setTimeout(hide, ms)
    }
}
