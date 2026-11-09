/**
 * Pantalla: sorteo y alineaciones. Exporta además las piezas del selector de formación y el
 * arranque de set, que el intervalo entre sets reutiliza.
 * @module src/app/screens/toss.screen.js
 */

import { Screen } from "../screen.js"
import { TOSS_TEXT, lineupOptions, tossView } from "../views/toss.view.js"
import { NoShowDialog } from "../dialogs/no-show.js"
import { teamLabel } from "../views/common.view.js"
import { teamColor } from "../colors.js"
import { saveAndRender } from "./details.screen.js"

/**
 * Jugadores que pueden estar en la formación: ni líberos, ni descalificados, ni fuera del
 * partido.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @returns {object[]}
 */
function eligibleStarters(match, side) {
    const banned = [match.disqualified[side], match.outForMatch[side]]
    return match.teams[side].players.filter((player) => !player.libero
        && !banned.some((group) => group.has(player.shirt)))
}

/**
 * Rehace las opciones de los seis desplegables de un equipo: cada jugador aparece solo en el
 * desplegable donde está elegido o en los que siguen libres. Se rehace la lista entera en vez
 * de esconder opciones, porque algunos móviles enseñan igualmente las escondidas. La primera
 * vez se parte de la formación previa (data-prefill), que después se vacía.
 * @param {HTMLElement} box contenedor con data-lineup-side
 * @param {Match} match partido
 */
export function refreshLineupBox(box, match) {
    const players = eligibleStarters(match, box.dataset.lineupSide)
    const selects = [...box.querySelectorAll("select")]
    const wanted = (select) => select.value || select.dataset.prefill
    const taken = selects.map(wanted).filter(Boolean)
    for (const select of selects) {
        const chosen = wanted(select)
        select.dataset.prefill = ""
        const free = players.filter((player) => player.shirt === chosen
            || !taken.includes(player.shirt))
        select.innerHTML = String(lineupOptions({ players: free, chosen }))
    }
}

/**
 * Rellena por primera vez todos los selectores de formación de un contenedor.
 * @param {HTMLElement} root contenedor de la pantalla
 * @param {Match} match partido
 */
export function fillLineups(root, match) {
    for (const box of root.querySelectorAll("[data-lineup-side]")) {
        refreshLineupBox(box, match)
    }
}

/**
 * Formación elegida para un equipo, por índice de zona; las vacías quedan a null.
 * @param {HTMLElement} root contenedor de la pantalla
 * @param {"home"|"away"} side lado
 * @returns {Array<string|null>}
 */
function readLineup(root, side) {
    const shirts = []
    for (const select of root.querySelectorAll(`[data-lineup-side="${side}"] select`)) {
        shirts[Number(select.dataset.zone)] = select.value || null
    }
    return shirts
}

/**
 * Empieza un set con las formaciones elegidas y, si toca, el sorteo. Todo va en un solo bloque
 * que se valida entero y solo entonces se guarda: o entra todo o no entra nada.
 * @param {App} app aplicación
 * @param {HTMLElement} root contenedor de la pantalla
 * @param {boolean} withToss si el set lleva sorteo
 * @returns {boolean} si el set empezó
 */
export function startPeriodBatch(app, root, withToss) {
    const marked = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value
    const plays = []
    if (withToss) {
        const server = marked("server")
        const left = marked("left")
        if (!server || !left) {
            app.notifier.show(TOSS_TEXT.missingToss)
            return false
        }
        plays.push({ kind: "toss", server, left })
    }
    for (const side of ["home", "away"]) {
        const shirts = readLineup(root, side)
        if (shirts.some((shirt) => !shirt)) {
            app.notifier.show(TOSS_TEXT.missingLineup(teamLabel(app.session.record.info, side)))
            return false
        }
        plays.push({ kind: "lineup", side, shirts })
    }
    plays.push({ kind: "startPeriod" })
    if (app.session.commitBatch(plays) !== null) {
        return false
    }
    scrollTo(0, 0)
    return true
}

/**
 * Sorteo del primer set y formación inicial de los dos equipos, con acceso a la no
 * presentación de un equipo.
 */
export class TossScreen extends Screen {
    /**
     * Eventos delegados de la pantalla.
     */
    static events = {
        "change [data-lineup-side]": "lineupChanged",
        "click #go-back": "back",
        "click #start-period": "start",
        "click #no-show": "noShow",
    }

    /**
     * Marcado de la pantalla.
     * @returns {Markup}
     */
    view() {
        const session = this.app.session
        const info = session.record.info
        const period = this.app.rules.currentPeriod(session.match)
        const teams = ["home", "away"].map((side) => ({
            side,
            tint: teamColor(info, side),
            prefill: period.lineup[side],
        }))
        return tossView({ info, server: period.firstServer, left: period.leftSide, teams })
    }

    /**
     * Rellena los desplegables de formación.
     */
    mounted() {
        fillLineups(this.root, this.app.session.match)
    }

    /**
     * Rehace las opciones del equipo cuyo desplegable ha cambiado.
     * @param {Event} event cambio
     * @param {HTMLElement} box contenedor del equipo
     */
    lineupChanged(event, box) {
        refreshLineupBox(box, this.app.session.match)
    }

    /**
     * Vuelve a las plantillas.
     */
    back() {
        this.app.session.record.stage = "rosters"
        saveAndRender(this.app)
    }

    /**
     * Empieza el primer set con sorteo.
     */
    start() {
        startPeriodBatch(this.app, this.root, true)
    }

    /**
     * Abre el diálogo de no presentación.
     */
    noShow() {
        new NoShowDialog(this.app).open()
    }
}
