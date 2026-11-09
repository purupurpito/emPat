/**
 * Pantalla: portada y lista de actas.
 * @module src/app/screens/home.screen.js
 */

import { Screen } from "../screen.js"
import { HOME_TEXT, displayDate, homeView } from "../views/home.view.js"
import { pickColor } from "../colors.js"
import { ask } from "../dialog.js"
import { UI_TEXT } from "../constants.js"

/**
 * Fase del partido y el par de cifras que la acompaña: sets ganados al final (del resumen) o
 * durante el juego (del estado).
 * @param {Match} match partido reconstruido
 * @param {object} summary resumen del partido
 * @returns {{phase: string, home: number, away: number}}
 */
function progressOf(match, summary) {
    if (match.phase === "over") {
        const { home, away } = summary.totals
        return { phase: "over", home: home.won, away: away.won }
    }
    const won = match.setsWon
    return { phase: match.phase, home: won.home, away: won.away }
}

/**
 * Portada: crear un acta (en blanco, de prueba o desde un archivo) y abrir o borrar las
 * guardadas. Cada acta guardada se reconstruye para enseñar su estado; si el motor no sabe
 * hacerlo, la fila lo dice y solo deja borrarla.
 */
export class HomeScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "click #new-blank": "createBlank",
        "click #new-demo": "createDemo",
        "change #import-file": "importFile",
        "click [data-open-record]": "openRecord",
        "click [data-drop-record]": "dropRecord",
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        const items = []
        for (const record of this.app.store.list()) {
            try {
                items.push(this.#describe(record))
            } catch {
                items.push({
                    id: record.id,
                    broken: true,
                    reason: UI_TEXT.notRecord,
                    names: { home: UI_TEXT.homeFallback, away: UI_TEXT.awayFallback },
                    swatches: {},
                })
            }
        }
        return homeView({ items })
    }

    /**
     * Fila de la lista para un acta guardada.
     * @param {object} record acta
     * @returns {object}
     */
    #describe(record) {
        const info = record.info
        const row = {
            id: record.id,
            names: {
                home: info?.homeName || UI_TEXT.homeFallback,
                away: info?.awayName || UI_TEXT.awayFallback,
            },
            swatches: {
                home: pickColor(info, "homeColor"),
                away: pickColor(info, "awayColor"),
            },
        }
        const rules = this.app.rules
        let match = null
        let summary = null
        try {
            match = rules.replay(record.settings, info, record.plays)
            summary = rules.summarize(match)
        } catch (error) {
            return { ...row, broken: true, reason: error.message }
        }
        const meta = [displayDate(info.date), info.time, info.competition].filter(Boolean)
        return {
            ...row,
            progress: progressOf(match, summary),
            meta: meta.join(" · "),
            demo: Boolean(record.demo),
        }
    }

    /**
     * Acta en blanco, en el paso de datos.
     */
    createBlank() {
        this.app.session.create({})
    }

    /**
     * Partido de prueba con plantillas de muestra.
     */
    createDemo() {
        this.app.session.createDemo()
    }

    /**
     * Importa el archivo elegido y lo abre. Cualquier fallo (lectura, formato o un acta que el
     * motor rechaza) se explica con un aviso.
     * @param {Event} event cambio del selector de archivo
     */
    async importFile(event) {
        const file = event.target.files[0]
        if (!file) {
            return
        }
        const app = this.app
        try {
            const record = app.store.importText(await file.text(), app.rules)
            app.notifier.show(HOME_TEXT.imported, { good: true })
            app.session.open(record.id)
        } catch (error) {
            app.notifier.show(UI_TEXT.badImport(error.message))
        }
    }

    /**
     * Abre el acta del botón pulsado.
     * @param {Event} event clic
     * @param {HTMLElement} button botón con data-open-record
     */
    openRecord(event, button) {
        this.app.session.open(button.dataset.openRecord)
    }

    /**
     * Borra el acta del botón pulsado, tras confirmarlo, y repinta la lista.
     * @param {Event} event clic
     * @param {HTMLElement} button botón con data-drop-record
     */
    dropRecord(event, button) {
        if (!ask(HOME_TEXT.askDrop)) {
            return
        }
        this.app.store.remove(button.dataset.dropRecord)
        this.app.bus.emit("render")
    }
}
