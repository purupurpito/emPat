/**
 * Avisos que siguen a cada jugada aceptada: tiempos, cambios, capitán en juego y salidas
 * automáticas del líbero.
 * @module src/app/notices.js
 */

import { currentPeriod, needsActingCaptain, SIDES } from "../rules/index.js"
import { UI_TEXT } from "./constants.js"
import { LiberoExitNotice } from "./dialogs/libero-exit.js"

/**
 * Nombre de un lado según los datos del acta.
 * @param {object} info datos
 * @param {string} side lado
 * @returns {string}
 */
function nameOf(info, side) {
    if (side === "home") {
        return info.homeName
    }
    return info.awayName
}

/**
 * Aviso de pausas y cambios: el 2º árbitro avisa del último tiempo de descanso y de la
 * penúltima y última sustitución (FIVB 24.2.7). Las sustituciones excepcionales no cuentan.
 * @param {Match} match partido tras la jugada
 * @param {object} play jugada aceptada
 * @param {string} team nombre del equipo
 * @returns {string|null}
 */
function quotaLine(match, play, team) {
    const period = currentPeriod(match)
    if (play.kind === "timeout") {
        const used = period.timeouts[play.side].length
        if (used === match.settings.timeouts) {
            return UI_TEXT.lastTimeout(team, used)
        }
        return null
    }
    const used = period.subCount[play.side]
    const limit = match.settings.substitutions
    if (play.exceptional || used < limit - 1) {
        return null
    }
    return UI_TEXT.lateSubstitution(team, used, used === limit)
}

/**
 * Líneas de aviso para una jugada recién aceptada.
 * @param {Match} match partido tras la jugada
 * @param {object} info datos del acta
 * @param {{play: object, captainBefore: {home: boolean, away: boolean}}} change jugada y
 *     capitanes que ya había que designar sin esta jugada
 * @returns {string[]}
 */
function linesFor(match, info, { play, captainBefore }) {
    const lines = []
    const counted = play.kind === "timeout" || play.kind === "substitution"
    if (counted && match.phase === "live") {
        const line = quotaLine(match, play, nameOf(info, play.side))
        if (line !== null) {
            lines.push(line)
        }
    }
    // Solo se avisa cuando el capitán acaba de salir, no mientras sigue fuera.
    for (const side of SIDES) {
        if (captainBefore[side] || !needsActingCaptain(match, side)) {
            continue
        }
        const captain = match.teams[side].players.find((player) => player.captain)
        lines.push(UI_TEXT.captainLeft(nameOf(info, side), captain.shirt))
    }
    return lines
}

/**
 * Escucha las jugadas confirmadas y muestra los avisos que correspondan. Si hay varios salen
 * juntos en un solo aviso, para que uno no tape al otro. Si el líbero ha tenido que salir
 * solo al rotar a delantero, abre además el diálogo que lo explica, salvo que el acta lo tenga
 * desactivado.
 * @param {App} app aplicación
 */
export function installNotices(app) {
    app.bus.on("play:committed", (change) => {
        const session = app.session
        const match = session.match
        if (!match) {
            return
        }
        const lines = linesFor(match, session.record.info, change)
        if (lines.length > 0) {
            app.notifier.many(lines)
        }
        const exits = match.automatic
            .slice(change.autoBefore)
            .filter((entry) => entry.kind === "liberoAutoOut")
        if (exits.length > 0 && session.record.settings.liberoPrompt !== false) {
            new LiberoExitNotice(app).open({ exits })
        }
    })
}
