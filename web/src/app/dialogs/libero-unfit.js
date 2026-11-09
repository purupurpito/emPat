/**
 * Controlador del diálogo del líbero incapacitado para jugar.
 * @module src/app/dialogs/libero-unfit.js
 */

import { liberoUnfitView, UNFIT_TEXT } from "../views/dialogs/libero-unfit.view.js"
import { teamLabel } from "../views/common.view.js"
import { currentPeriod } from "../../rules/index.js"
import { teamColor } from "../colors.js"

/**
 * Líbero lesionado, enfermo, expulsado, descalificado o retirado por el entrenador (FIVB 19.4).
 * Si queda otro líbero sigue ese; si no, se puede redesignar a un jugador que no esté en pista o
 * seguir sin líbero. Por defecto se propone el líbero que está en pista.
 */
export class LiberoUnfitDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click [data-unfit]": "pickUnfit",
        "click [data-successor]": "pickSuccessor",
        "click #confirm": "confirm",
    }

    #app
    #side = null
    #unfit = null
    #successor = null

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo, sustituyendo al que hubiera abierto.
     * @param {{side: string}} options lado
     */
    open({ side }) {
        this.#side = side
        const period = currentPeriod(this.#app.session.match)
        this.#unfit = period.libero[side]?.shirt || this.#eligible()[0]?.shirt
        this.#app.dialog.open(this.#markup(), { controller: this, focus: "button" })
    }

    /**
     * Elige el líbero impedido y olvida la redesignación.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickUnfit(event, button) {
        this.#unfit = button.dataset.unfit
        this.#successor = null
        this.#redraw()
    }

    /**
     * Elige a quién redesignar; el botón "Ninguno" lo deja sin nadie.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickSuccessor(event, button) {
        this.#successor = button.dataset.successor || null
        this.#redraw()
    }

    /**
     * Anota el líbero impedido; si se acepta, cierra y confirma con un aviso.
     */
    confirm() {
        const successor = this.#successor
        const play = { kind: "liberoUnfit", side: this.#side, libero: this.#unfit }
        if (successor) {
            play.successor = successor
        }
        if (this.#app.session.commit(play)) {
            return
        }
        this.#app.dialog.close()
        const text = successor ? UNFIT_TEXT.redesignated(successor) : UNFIT_TEXT.noted
        this.#app.notifier.show(text, { good: true })
    }

    /**
     * Líberos del lado que aún pueden quedar impedidos: los que no están fuera del partido.
     * @returns {object[]}
     */
    #eligible() {
        const match = this.#app.session.match
        const out = match.outForMatch[this.#side]
        return match.teams[this.#side].liberos().filter((player) => !out.has(player.shirt))
    }

    /**
     * Marcado con las elecciones actuales.
     * @returns {Markup}
     */
    #markup() {
        const match = this.#app.session.match
        const side = this.#side
        const rotation = currentPeriod(match).rotation[side]
        const liberos = this.#eligible()
        const others = liberos.filter((player) => player.shirt !== this.#unfit)
        const candidates = match.teams[side].players.filter((player) => !player.libero
            && !rotation.includes(player.shirt)
            && !match.outForMatch[side].has(player.shirt)
            && !match.disqualified[side].has(player.shirt))
        return liberoUnfitView({
            team: teamLabel(match.info, side),
            tint: teamColor(match.info, side),
            liberos: liberos.map((player) => player.shirt),
            unfit: this.#unfit,
            remaining: others.length ? others[0].shirt : null,
            candidates: candidates.map((player) => player.shirt),
            successor: this.#successor,
        })
    }

    /**
     * Sustituye el contenido del diálogo sin volver a abrirlo.
     */
    #redraw() {
        this.#app.dialog.redraw(this.#markup())
    }
}
