/**
 * Pantalla: vista oficial y resumen para imprimir.
 * @module src/app/screens/paper.screen.js
 */

import { Screen } from "../screen.js"
import { byId } from "../dom.js"
import { officialPaper, paperView } from "../views/paper.view.js"
import { digestSheet } from "../views/digest.view.js"
import { PAGE_W, renderSheet } from "../../sheet/index.js"

/**
 * Entra en la vista de impresión del acta abierta y sube al principio de la página.
 * @param {App} app aplicación
 */
export function showPaper(app) {
    app.session.paperMode = true
    app.router.render()
    scrollTo(0, 0)
}

/**
 * Ajusta la escala de las páginas del acta al ancho disponible. En pantalla se encogen para que
 * quepan a lo ancho (nunca se agrandan); para imprimir se quita el ajuste y salen a tamaño real.
 * @param {HTMLElement|null} zoomBox envoltorio de las páginas; sin él no hace nada
 * @param {{actualSize?: boolean}} [options] tamaño real, para imprimir
 */
function fitPaper(zoomBox, { actualSize = false } = {}) {
    if (zoomBox === null) {
        return
    }
    if (actualSize) {
        zoomBox.style.zoom = ""
        return
    }
    const room = zoomBox.parentElement.clientWidth || innerWidth
    // Ancho de página en píxeles CSS (96 por pulgada, 72 puntos por pulgada), en este orden de
    // operaciones para que la escala salga idéntica al último decimal.
    zoomBox.style.zoom = String(Math.min(1, room / (PAGE_W * 96 / 72)))
}

/**
 * Vista para imprimir: el acta oficial (por defecto) o el resumen propio, en la zona de
 * impresión, con la barra para imprimir, cambiar de formato y volver.
 */
export class PaperScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "change input[name=\"paper-style\"]": "switchStyle",
        "click #print-now": "print",
        "click #close-paper": "close",
    }

    /** oyentes de ventana activos mientras la vista está montada */
    #windowListeners = []

    /**
     * Si se está viendo el acta oficial.
     * @returns {boolean}
     */
    get #official() {
        return this.app.session.paperStyle === "official"
    }

    /**
     * Marcado de la barra.
     * @returns {Markup}
     */
    view() {
        return paperView({ official: this.#official })
    }

    /**
     * Pone el acta o el resumen en la zona de impresión, ajusta la escala y vigila el tamaño de
     * la ventana y la impresión.
     */
    mounted() {
        const area = byId("print-area")
        const official = this.#official
        area.classList.toggle("is-official", official)
        area.innerHTML = String(official ? this.#officialMarkup() : this.#digestMarkup())
        this.#refit()
        this.#listen("resize", () => this.#refit())
        this.#listen("beforeprint", () => fitPaper(this.#zoomBox(), { actualSize: true }))
        this.#listen("afterprint", () => this.#refit())
    }

    /**
     * Suelta los oyentes de ventana además de los de la pantalla. La zona de impresión se
     * queda como está: solo la vacía el botón de volver.
     */
    unmount() {
        for (const [type, listener] of this.#windowListeners) {
            removeEventListener(type, listener)
        }
        this.#windowListeners = []
        super.unmount()
    }

    /**
     * Engancha un oyente de ventana y lo apunta para soltarlo al desmontar.
     * @param {string} type evento
     * @param {() => void} listener función
     */
    #listen(type, listener) {
        addEventListener(type, listener)
        this.#windowListeners.push([type, listener])
    }

    /**
     * Envoltorio escalable del acta oficial, si está en la página.
     * @returns {HTMLElement|null}
     */
    #zoomBox() {
        return document.querySelector(".paper-zoom")
    }

    /**
     * Vuelve a ajustar la escala al ancho actual.
     */
    #refit() {
        fitPaper(this.#zoomBox())
    }

    /**
     * Páginas del acta oficial dentro de su envoltorio.
     * @returns {Markup}
     */
    #officialMarkup() {
        const { record, match } = this.app.session
        return officialPaper(renderSheet(record, match, this.app.rules))
    }

    /**
     * Resumen propio con todos sus datos ya calculados.
     * @returns {Markup}
     */
    #digestMarkup() {
        const { record, match } = this.app.session
        const rules = this.app.rules
        let report = null
        if (match.settings.fullSetRule) {
            report = rules.fullSetReport(match)
        }
        const started = match.periods.filter((period) => period.startedAt)
        return digestSheet({
            info: record.info,
            match,
            summary: rules.summarize(match),
            report,
            numbers: started.map((period) => period.number),
            amendments: record.amendments || [],
            sealed: record.sealed,
            titles: rules.STAFF_TITLES,
            isShirt: rules.isShirt,
            generatedAt: new Date().toLocaleString("es-ES"),
        })
    }

    /**
     * Cambia entre el acta oficial y el resumen. El formato elegido se mantiene al cambiar de
     * acta.
     * @param {Event} event cambio
     * @param {HTMLInputElement} radio opción elegida
     */
    switchStyle(event, radio) {
        this.app.session.paperStyle = radio.value
        this.app.router.render()
    }

    /**
     * Abre el diálogo de impresión del navegador.
     */
    print() {
        globalThis.print()
    }

    /**
     * Sale de la vista: vacía la zona de impresión y vuelve a la pantalla del acta.
     */
    close() {
        const area = byId("print-area")
        this.app.session.paperMode = false
        area.innerHTML = ""
        area.classList.remove("is-official")
        this.app.router.render()
        scrollTo(0, 0)
    }
}
