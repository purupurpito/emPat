/**
 * Controlador del diálogo de sanciones, en el partido y entre sets.
 * @module src/app/dialogs/sanction.js
 */

import { sanctionView, TEAM_TARGET } from "../views/dialogs/sanction.view.js"
import { teamLabel } from "../views/common.view.js"
import { SubstitutionDialog } from "./substitution.js"
import { currentPeriod, STAFF_TITLES } from "../../rules/index.js"
import { teamColor } from "../colors.js"

/**
 * Niveles que solo pueden ir al equipo: las demoras (FIVB 16) y la solicitud improcedente
 * (FIVB 15.11).
 */
const TEAM_ONLY = new Set(["delayWarning", "delayPenalty", "improper"])

/**
 * Pausa hasta abrir la sustitución obligada, para que se note que el diálogo se ha cerrado.
 */
const FOLLOW_UP_MS = 200

/**
 * Sanción a un lado: primero el nivel y después a quién (un jugador, un miembro del cuerpo
 * técnico o el equipo). La solicitud improcedente se anota como tal, no como sanción. Si tras
 * anotarla hay que sustituir a alguien por expulsión o descalificación, se abre la sustitución.
 */
export class SanctionDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click [data-level]": "pickLevel",
        "click [data-target]": "pickTarget",
        "click #confirm": "confirm",
    }

    #app
    #side = null
    #level = null
    #target = null

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo sin nada elegido.
     * @param {{side: string}} options lado sancionado
     */
    open({ side }) {
        this.#side = side
        this.#app.dialog.open(this.#markup(), { controller: this, focus: "button" })
    }

    /**
     * Elige el nivel. Los que solo admiten al equipo lo dejan ya elegido.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickLevel(event, button) {
        this.#level = button.dataset.level
        this.#target = TEAM_ONLY.has(this.#level) ? "team" : null
        this.#redraw()
    }

    /**
     * Elige a quién se sanciona.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickTarget(event, button) {
        this.#target = button.dataset.target
        this.#redraw()
    }

    /**
     * Anota la sanción. Si se acepta, cierra y, si el lado tiene que sustituir a alguien, abre la
     * sustitución al poco.
     */
    confirm() {
        const session = this.#app.session
        const side = this.#side
        let refusal = null
        if (this.#level === "improper") {
            refusal = session.commit({ kind: "improper", side })
        } else {
            refusal = session.commit({
                kind: "sanction",
                side,
                target: this.#target,
                level: this.#level,
            })
        }
        if (refusal) {
            return
        }
        this.#app.dialog.close()
        if (currentPeriod(session.match).mustReplace[side]?.length) {
            setTimeout(() => new SubstitutionDialog(this.#app).open({ side }), FOLLOW_UP_MS)
        }
    }

    /**
     * Destinatarios posibles para el nivel elegido: el equipo para las demoras y la
     * improcedente; si no, los jugadores y los cargos del cuerpo técnico inscritos.
     * @returns {Array<{key: string, label: string}>}
     */
    #targets() {
        if (TEAM_ONLY.has(this.#level)) {
            return [{ key: "team", label: TEAM_TARGET }]
        }
        const team = this.#app.session.match.teams[this.#side]
        const players = team.players.map((player) => ({
            key: player.shirt,
            label: String(player.shirt),
        }))
        const staff = team.staff.map((member) => ({
            key: member.role,
            label: STAFF_TITLES[member.role],
        }))
        return [...players, ...staff]
    }

    /**
     * Marcado con las elecciones actuales.
     * @returns {Markup}
     */
    #markup() {
        return sanctionView({
            team: teamLabel(this.#app.session.record.info, this.#side),
            tint: teamColor(this.#app.session.record.info, this.#side),
            level: this.#level,
            target: this.#target,
            targets: this.#targets(),
        })
    }

    /**
     * Sustituye el contenido del diálogo sin volver a abrirlo.
     */
    #redraw() {
        this.#app.dialog.redraw(this.#markup())
    }
}
