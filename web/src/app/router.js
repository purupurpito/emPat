/**
 * Elige la pantalla según el estado de la sesión y la pinta.
 * @module src/app/router.js
 */

import { HomeScreen } from "./screens/home.screen.js"
import { DetailsScreen } from "./screens/details.screen.js"
import { RostersScreen } from "./screens/rosters.screen.js"
import { TossScreen } from "./screens/toss.screen.js"
import { LiveScreen } from "./screens/live.screen.js"
import { BreakScreen } from "./screens/break.screen.js"
import { FinalScreen } from "./screens/final.screen.js"
import { PaperScreen } from "./screens/paper.screen.js"
import { showFatal } from "./screens/fatal.screen.js"
import { byId } from "./dom.js"
import { UI_TEXT } from "./constants.js"

/**
 * Pantalla de cada nombre que devuelve resolve().
 */
const SCREENS = Object.freeze({
    home: HomeScreen,
    details: DetailsScreen,
    rosters: RostersScreen,
    toss: TossScreen,
    live: LiveScreen,
    break: BreakScreen,
    final: FinalScreen,
    paper: PaperScreen,
})

/**
 * Pantalla de cada fase del partido una vez empezado.
 */
const PHASE_SCREENS = Object.freeze({
    live: "live",
    break: "break",
    over: "final",
})

/**
 * Subtítulo de la cabecera: los dos equipos y la competición, o el lema sin acta abierta.
 * @param {object|null} record acta abierta
 * @returns {string}
 */
function subtitleFor(record) {
    if (record === null) {
        return UI_TEXT.defaultSubtitle
    }
    const info = record.info
    const home = info.homeName || UI_TEXT.homeFallback
    const away = info.awayName || UI_TEXT.awayFallback
    let text = `${home} – ${away}`
    if (info.competition) {
        text += " · " + info.competition
    }
    return text
}

/**
 * Decide qué pantalla toca y la monta en #stage. Cada pintado es completo: se desmonta la
 * pantalla anterior y se monta una nueva con el estado recalculado. Un fallo al pintar lleva a
 * la pantalla de error en lugar de dejar la página a medias.
 */
export class Router {
    #app
    #current = null

    /**
     * Enlaza el router con la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Nombre de la pantalla que corresponde al estado actual. Lee el partido, así que puede
     * lanzar si el motor no sabe reconstruir el acta.
     * @returns {string}
     */
    resolve() {
        const session = this.#app.session
        const record = session.record
        if (record === null) {
            return "home"
        }
        if (session.paperMode) {
            return "paper"
        }
        const phase = session.match.phase
        if (phase === "setup") {
            return record.stage || "details"
        }
        return PHASE_SCREENS[phase]
    }

    /**
     * Pinta la pantalla actual y marca el arranque como completado, haya ido bien o no: si falla
     * ya se ve la pantalla de error, y la vigilancia de arranque no debe taparla.
     */
    render() {
        const app = this.#app
        try {
            app.session.invalidate()
            const name = this.resolve()
            const body = document.body
            body.classList.toggle("mode-paper", name === "paper")
            body.classList.toggle("mode-live", name === "live")
            body.dataset.screen = name
            byId("subtitle").textContent = subtitleFor(app.session.record)
            this.show(new SCREENS[name](app))
        } catch (error) {
            showFatal(error)
        }
        app.booted = true
        globalThis.empatBooted = true
    }

    /**
     * Sustituye la pantalla montada por otra. El pulso de reloj se para aquí: cada pantalla que
     * lo necesita lo vuelve a programar al montarse.
     * @param {Screen} screen pantalla nueva
     */
    show(screen) {
        this.#current?.unmount()
        this.#current = null
        this.#app.ticker.stop()
        try {
            screen.mount(byId("stage"))
        } catch (error) {
            // Una pantalla que revienta a medio montar no debe dejar oyentes en #stage.
            screen.unmount()
            throw error
        }
        this.#current = screen
    }
}
