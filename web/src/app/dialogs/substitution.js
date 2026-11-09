/**
 * Controlador del diálogo de sustitución de jugadores.
 * @module src/app/dialogs/substitution.js
 */

import { PICK_LEAVING_FIRST, substitutionView } from "../views/dialogs/substitution.view.js"
import { teamLabel } from "../views/common.view.js"
import { currentPeriod, substitutionBlocker } from "../../rules/index.js"
import { teamColor } from "../colors.js"

/**
 * Sustitución de un lado: se elige quién sale entre los de la rotación (el que está fuera por el
 * líbero no cuenta) y quién entra entre los suplentes que no son líberos. Cada suplente muestra
 * el primer motivo del reglamento por el que no podría entrar, salvo en la sustitución
 * excepcional (FIVB 15.7), que el motor valida aparte. El diálogo se redibuja entero tras cada
 * elección, sin mover el foco.
 */
export class SubstitutionDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click [data-leaving]": "pickLeaving",
        "click [data-entering]": "pickEntering",
        "change #sub-exceptional": "toggleExceptional",
        "click #confirm": "confirm",
    }

    #app
    #match = null
    #period = null
    #side = null
    #leaving = null
    #entering = null
    #exceptional = false

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo. Si se llega tocando a un jugador en pista, ese sale ya elegido; si no,
     * el primero que haya que sustituir por obligación, si lo hay.
     * @param {{side: string, chosen?: string|null}} options lado y jugador tocado
     */
    open({ side, chosen = null }) {
        this.#match = this.#app.session.match
        this.#period = currentPeriod(this.#match)
        this.#side = side
        const court = this.#court()
        let leaving = null
        if (chosen !== null && chosen !== undefined && court.includes(chosen)) {
            leaving = chosen
        }
        this.#leaving = leaving ?? this.#period.mustReplace[side][0] ?? null
        this.#app.dialog.open(this.#markup(), { controller: this, focus: "button" })
    }

    /**
     * Elige quién sale y olvida al que iba a entrar.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickLeaving(event, button) {
        this.#leaving = button.dataset.leaving
        this.#entering = null
        this.#redraw()
    }

    /**
     * Elige quién entra.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickEntering(event, button) {
        if (button.disabled) {
            return
        }
        this.#entering = button.dataset.entering
        this.#redraw()
    }

    /**
     * Marca o desmarca la sustitución excepcional y olvida al que iba a entrar.
     * @param {Event} event cambio de la casilla
     */
    toggleExceptional(event) {
        this.#exceptional = event.target.checked
        this.#entering = null
        this.#redraw()
    }

    /**
     * Anota la sustitución; si el motor la acepta, cierra.
     */
    confirm() {
        const play = {
            kind: "substitution",
            side: this.#side,
            leaving: this.#leaving,
            entering: this.#entering,
        }
        if (this.#exceptional) {
            play.exceptional = true
        }
        if (!this.#app.session.commit(play)) {
            this.#app.dialog.close()
        }
    }

    /**
     * Jugadores que pueden salir: la rotación sin el que espera fuera por el líbero.
     * @returns {string[]}
     */
    #court() {
        const libero = this.#period.libero[this.#side]
        const rotation = this.#period.rotation[this.#side]
        return rotation.filter((shirt) => !(libero && libero.replacing === shirt))
    }

    /**
     * Motivo por el que un suplente no podría entrar ahora, o null.
     * @param {string} shirt dorsal del suplente
     * @returns {string|null}
     */
    #blocker(shirt) {
        if (this.#exceptional) {
            return null
        }
        if (this.#leaving === null) {
            return PICK_LEAVING_FIRST
        }
        return substitutionBlocker(this.#match, this.#period, this.#side, this.#leaving, shirt)
    }

    /**
     * Marcado con las elecciones actuales.
     * @returns {Markup}
     */
    #markup() {
        const match = this.#match
        const side = this.#side
        const rotation = this.#period.rotation[side]
        const bench = match.teams[side].players
            .filter((player) => !player.libero && !rotation.includes(player.shirt))
            .map((player) => ({
                shirt: player.shirt,
                name: player.name,
                blocker: this.#blocker(player.shirt),
            }))
        const regular = this.#leaving !== null && !this.#exceptional
        return substitutionView({
            team: teamLabel(match.info, side),
            tint: teamColor(match.info, side),
            used: this.#period.subCount[side],
            limit: match.settings.substitutions,
            court: this.#court(),
            leaving: this.#leaving,
            bench,
            entering: this.#entering,
            exceptional: this.#exceptional,
            stuck: regular && bench.every((option) => option.blocker),
        })
    }

    /**
     * Sustituye el contenido del diálogo sin volver a abrirlo, para que el foco no salte.
     */
    #redraw() {
        this.#app.dialog.redraw(this.#markup())
    }
}
