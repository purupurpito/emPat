/**
 * Controlador del diálogo del líbero: entradas, salidas y reemplazos.
 * @module src/app/dialogs/libero.js
 */

import { ZONE_NUMERALS } from "../constants.js"
import { liberoView, noLiberoText } from "../views/dialogs/libero.view.js"
import { teamLabel } from "../views/common.view.js"
import { LiberoUnfitDialog } from "./libero-unfit.js"
import { currentPeriod } from "../../rules/index.js"
import { teamColor } from "../colors.js"

/**
 * Zonas de zaguero en el orden en que se ofrecen: V, VI y I.
 */
const BACK_ZONES = Object.freeze([4, 5, 0])

/**
 * Cambios del líbero de un lado (FIVB 19.3). Con el líbero en pista ofrece su salida, el
 * reemplazo por el otro líbero o declararlo impedido. Sin él, deja elegir líbero y zaguero; cada
 * zaguero se valida con el motor de antemano y, si no puede, queda desactivado con el motivo.
 */
export class LiberoDialog {
    /**
     * Eventos delegados sobre el cuerpo del diálogo.
     */
    static events = {
        "click #libero-unfit": "unfit",
        "click #libero-leave": "leave",
        "click #libero-swap": "swap",
        "click [data-libero]": "pickLibero",
        "click [data-replacing]": "enter",
    }

    #app
    #side = null
    #period = null
    #liberos = []
    #chosen = null
    #other = null

    /**
     * Guarda la aplicación.
     * @param {App} app aplicación
     */
    constructor(app) {
        this.#app = app
    }

    /**
     * Muestra el diálogo, o solo avisa si el equipo no tiene ningún líbero que pueda jugar.
     * @param {{side: string}} options lado
     */
    open({ side }) {
        const session = this.#app.session
        const match = session.match
        this.#side = side
        this.#period = currentPeriod(match)
        this.#liberos = match.teams[side].liberos()
        const out = match.outForMatch[side]
        const playable = this.#liberos.filter((player) => !out.has(player.shirt))
        const team = teamLabel(match.info, side)
        if (playable.length === 0) {
            this.#app.notifier.show(noLiberoText(team))
            return
        }
        const onCourt = this.#period.libero[side]
        if (onCourt) {
            const other = this.#liberos.find((player) => player.shirt !== onCourt.shirt)
            this.#other = other ? other.shirt : null
            const markup = liberoView({
                form: "court",
                team,
                tint: teamColor(this.#app.session.record.info, this.#side),
                libero: onCourt.shirt,
                replacing: onCourt.replacing,
                other: this.#other,
            })
            this.#app.dialog.open(markup, { controller: this })
            return
        }
        this.#chosen = this.#liberos[0].shirt
        this.#app.dialog.open(this.#entryMarkup(), { controller: this, focus: "button" })
    }

    /**
     * Pasa al diálogo del líbero impedido.
     */
    unfit() {
        new LiberoUnfitDialog(this.#app).open({ side: this.#side })
    }

    /**
     * Sale el líbero y vuelve el jugador al que sustituía.
     */
    leave() {
        this.#settle({ kind: "liberoOut", side: this.#side })
    }

    /**
     * Entra el otro líbero por el que está en pista.
     */
    swap() {
        const leaving = this.#period.libero[this.#side].shirt
        this.#settle({ kind: "liberoIn", side: this.#side, libero: this.#other, leaving })
    }

    /**
     * Elige qué líbero entra.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    pickLibero(event, button) {
        this.#chosen = button.dataset.libero
        this.#app.dialog.redraw(this.#entryMarkup())
    }

    /**
     * Entra el líbero elegido por el zaguero del botón.
     * @param {Event} event clic
     * @param {HTMLButtonElement} button botón pulsado
     */
    enter(event, button) {
        if (button.disabled) {
            return
        }
        const leaving = button.dataset.replacing
        this.#settle({ kind: "liberoIn", side: this.#side, libero: this.#chosen, leaving })
    }

    /**
     * Anota la jugada y cierra si el motor la acepta.
     * @param {object} play jugada
     */
    #settle(play) {
        if (!this.#app.session.commit(play)) {
            this.#app.dialog.close()
        }
    }

    /**
     * Marcado de la forma sin el líbero en pista, con cada zaguero ya validado.
     * @returns {Markup}
     */
    #entryMarkup() {
        const { record, match } = this.#app.session
        const side = this.#side
        const backs = BACK_ZONES.map((zone) => {
            const shirt = this.#period.rotation[side][zone]
            const trial = {
                kind: "liberoIn",
                side,
                libero: this.#chosen,
                leaving: shirt,
                at: new Date().toISOString(),
            }
            const refusal = this.#app.rules.check(record.settings, record.info, record.plays, trial)
            return { shirt, zone: ZONE_NUMERALS[zone], refusal }
        })
        return liberoView({
            form: "entry",
            team: teamLabel(match.info, side),
            tint: teamColor(match.info, side),
            liberos: this.#liberos.map((player) => player.shirt),
            libero: this.#chosen,
            backs,
        })
    }
}
