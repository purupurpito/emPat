/**
 * Controlador del diálogo: observaciones con frases hechas.
 * @module src/app/dialogs/remark.js
 */

import {
    BLANK,
    REMARK_TEXT,
    fillRemark,
    remarkFields,
    remarkView,
} from "../views/dialogs/remark.view.js"
import { REMARK_TEMPLATES } from "../data/remark-templates.js"
import { teamLabel } from "../views/common.view.js"
import { ORDINALS } from "../format.js"
import { ask } from "../dialog.js"
import { byId } from "../dom.js"
import { i18n } from "../../i18n/language.js"

/**
 * Abre el diálogo de observación y lo atiende: al elegir una frase pinta sus casillas, al
 * cambiar una casilla reescribe el texto y al guardar añade la observación al acta.
 *
 * El texto se escribe en el idioma activo al abrir, porque va tal cual al acta y la caja de
 * texto no la toca la traducción automática.
 */
export class RemarkDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "change #note-template": "pickTemplate",
        "input [data-field]": "fieldChanged",
        "change [data-field]": "fieldChanged",
        "click #note-save": "save",
    }

    #app
    #language = "es"

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo con el desplegable de frases y el texto vacío.
     */
    open() {
        this.#language = i18n.language === "ca" ? "ca" : "es"
        this.#app.dialog.open(remarkView({ templates: REMARK_TEMPLATES }), { controller: this })
    }

    /**
     * Plantilla elegida en el desplegable, o undefined si se escribe a mano.
     * @returns {object|undefined}
     */
    #template() {
        return REMARK_TEMPLATES[byId("note-template").value]
    }

    /**
     * Valor de una casilla de la frase, o null si la frase no la tiene.
     * @param {string} field campo
     * @returns {string|null}
     */
    #value(field) {
        return byId("note-fields").querySelector(`[data-field="${field}"]`)?.value ?? null
    }

    /**
     * Pinta las casillas de la frase elegida, conservando el equipo que ya estuviera elegido,
     * y escribe el texto. Sin frase, vacía las casillas y deja el texto como esté.
     */
    pickTemplate() {
        const template = this.#template()
        const box = byId("note-fields")
        if (!template) {
            box.innerHTML = ""
            return
        }
        const team = this.#value("team") || "home"
        const { record, match } = this.#app.session
        box.innerHTML = String(remarkFields({
            template,
            info: record.info,
            team,
            players: match.teams[team].players,
        }))
        this.#write()
    }

    /**
     * Una casilla ha cambiado: si es el equipo y la frase pide jugador, se rehace la lista de
     * jugadores; si no, solo se reescribe el texto.
     * @param {Event} event cambio
     * @param {HTMLElement} control casilla
     */
    fieldChanged(event, control) {
        const template = this.#template()
        if (control.dataset.field === "team" && template?.fields.includes("player")) {
            this.pickTemplate()
            return
        }
        this.#write()
    }

    /**
     * Reescribe el texto de la observación a partir de la frase y las casillas.
     */
    #write() {
        const template = this.#template()
        const { record, match } = this.#app.session
        const side = this.#value("team") || "home"
        const shirt = this.#value("player")
        const period = this.#app.rules.currentPeriod(match)
        const ordinals = ORDINALS[this.#language]
        byId("note-text").value = fillRemark({
            phrase: template.text[this.#language],
            teamName: teamLabel(record.info, side),
            player: match.teams[side].players.find((player) => player.shirt === shirt),
            read: (field) => this.#value(field)?.trim() || BLANK,
            period,
            ordinal: ordinals[period.number] || period.number + "º",
        })
    }

    /**
     * Añade la observación. Si quedan datos por rellenar (___) pide confirmación; si el acta no
     * la acepta, el diálogo sigue abierto con el aviso.
     */
    save() {
        const text = byId("note-text").value.trim()
        if (!text) {
            return
        }
        if (text.includes(BLANK) && !ask(REMARK_TEXT.askIncomplete)) {
            return
        }
        const app = this.#app
        if (!app.session.commit({ kind: "note", text })) {
            app.dialog.close()
            app.notifier.show(REMARK_TEXT.added, { good: true })
        }
    }
}
