/**
 * Pantalla: datos del partido.
 * @module src/app/screens/details.screen.js
 */

import { Screen } from "../screen.js"
import { DETAILS_TEXT, detailsView } from "../views/details.view.js"
import { teamColor } from "../colors.js"
import { byId } from "../dom.js"
import { UI_TEXT } from "../constants.js"
import { clubCode } from "../../sheet/index.js"

/**
 * Guarda el acta abierta tal como esté (con aviso si el dispositivo no deja) y repinta. Lo usan
 * las pantallas de preparación, que cambian el acta sin pasar por una jugada.
 * @param {App} app aplicación
 */
export function saveAndRender(app) {
    if (!app.store.save(app.session.record)) {
        app.notifier.show(UI_TEXT.saveFailed)
    }
    app.bus.emit("render")
}

/**
 * Número leído de un campo y encajado entre dos límites. Un campo vacío o no numérico toma el
 * valor de reserva y después se encaja.
 * @param {string} id campo
 * @param {number} fallback valor si no hay número (o es cero)
 * @param {number} low mínimo
 * @param {number} high máximo
 * @returns {number}
 */
function boundedNumber(id, fallback, low, high) {
    const typed = Number(byId(id).value) || fallback
    return Math.min(high, Math.max(low, typed))
}

/**
 * Si una casilla está marcada.
 * @param {string} id casilla
 * @returns {boolean}
 */
function ticked(id) {
    return byId(id).checked
}

/**
 * Jugador sin la marca de líbero.
 * @param {object} player jugador de una plantilla
 * @returns {object}
 */
function withoutLibero(player) {
    const { libero, ...rest } = player
    return rest
}

/**
 * Jugada con la marca de líbero quitada de sus jugadores si es una plantilla; cualquier otra se
 * devuelve tal cual.
 * @param {object} play jugada
 * @returns {object}
 */
function rosterWithoutLiberos(play) {
    if (play.kind !== "roster") {
        return play
    }
    return { ...play, players: play.players.map(withoutLibero) }
}

/**
 * Datos del encuentro, equipos, árbitros y formato. Al seguir se guardan los datos y los
 * ajustes; si el partido va sin líbero, la marca desaparece de las plantillas, también de las
 * que se están escribiendo.
 */
export class DetailsScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "input input[type=color]": "tint",
        "click #back-home": "leave",
        "submit #details-form": "save",
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        const record = this.app.session.record
        const info = record.info
        const teams = [
            { side: "home", name: info.homeName },
            { side: "away", name: info.awayName },
        ].map(({ side, name }) => ({
            side,
            codeHint: clubCode(name) || "",
            shirt: teamColor(info, side),
            libero: teamColor(info, side, true),
        }))
        return detailsView({ info, settings: record.settings, teams })
    }

    /**
     * Pinta la franja del equipo con el color de camiseta recién elegido. El del líbero no la
     * cambia.
     * @param {Event} event cambio del selector de color
     * @param {HTMLInputElement} input selector
     */
    tint(event, input) {
        const key = input.dataset.info
        if (key !== "homeColor" && key !== "awayColor") {
            return
        }
        input.closest(".team-box").style.setProperty("--team-tint", input.value)
    }

    /**
     * Vuelve a la lista sin guardar lo escrito.
     */
    leave() {
        this.app.session.leave()
    }

    /**
     * Guarda datos y ajustes y pasa a las plantillas. Lo escrito se copia al acta en primer
     * lugar y solo después se comprueban los nombres de los equipos, aunque falte alguno.
     * @param {SubmitEvent} event envío del formulario
     */
    save(event) {
        event.preventDefault()
        const app = this.app
        const record = app.session.record
        for (const input of this.root.querySelectorAll("[data-info]")) {
            record.info[input.dataset.info] = input.value.trim()
        }
        if (!record.info.homeName || !record.info.awayName) {
            app.notifier.show(DETAILS_TEXT.missingTeams)
            return
        }
        record.settings = {
            ...record.settings,
            bestOf: Number(byId("opt-best-of").value),
            setPoints: Number(byId("opt-set-points").value) || 25,
            deciderPoints: Number(byId("opt-decider-points").value) || 15,
            substitutions: boundedNumber("opt-subs", 6, 1, 20),
            timeouts: boundedNumber("opt-timeouts", 0, 0, 5),
            liberoAllowed: ticked("opt-liberos"),
            liberoPrompt: ticked("opt-libero-prompt"),
            breakMinutes: boundedNumber("opt-break", 0, 0, 30),
            secondBreakMinutes: boundedNumber("opt-second-break", 0, 0, 10),
            fullSetRule: ticked("opt-full-set"),
        }
        if (!record.settings.liberoAllowed) {
            this.#dropLiberoMarks()
        }
        record.stage = "rosters"
        saveAndRender(app)
        scrollTo(0, 0)
    }

    /**
     * Quita la marca de líbero de las plantillas confirmadas y de los borradores.
     */
    #dropLiberoMarks() {
        const session = this.app.session
        const record = session.record
        record.plays = record.plays.map(rosterWithoutLiberos)
        for (const draft of Object.values(session.drafts)) {
            for (const player of draft?.players ?? []) {
                delete player.libero
            }
        }
    }
}
