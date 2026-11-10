/**
 * Avisos que siguen a cada jugada aceptada: tiempos, cambios, capitán en juego y salidas
 * automáticas del líbero.
 * @module src/app/notices.js
 */

import { currentPeriod, needsActingCaptain, rival, SIDES } from "../rules/index.js"
import { UI_TEXT } from "./constants.js"
import { LiberoExitNotice, LiberoLeaveDialog, LiberoReturnDialog } from "./dialogs/libero-exit.js"

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
 * desactivado. Si la salida la tiene que confirmar el anotador, la pide con un diálogo
 * obligatorio cada vez que se pinta la pantalla.
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
        const helps = session.record.settings.liberoPrompt !== false
        if (exits.length > 0 && helps) {
            new LiberoExitNotice(app).open({ exits })
            return
        }
        if (!helps || match.phase !== "live" || pendingExit(match)) {
            return
        }
        const proposal = liberoReturn(match, change.play, app.rules, session.record)
        if (proposal) {
            new LiberoReturnDialog(app).open(proposal)
        }
    })
    // Después del que pinta y del controlador que cierra su propio diálogo tras apuntar.
    const demandExit = () => queueMicrotask(() => requireLiberoExit(app))
    app.bus.on("render", demandExit)
    app.bus.on("record:opened", demandExit)
}

/**
 * Lado cuyo líbero ha rotado a la delantera y aún no tiene la salida apuntada.
 * @param {Match} match partido
 * @returns {string|undefined}
 */
function pendingExit(match) {
    if (match.phase !== "live") {
        return undefined
    }
    const period = currentPeriod(match)
    return SIDES.find((side) => period.liberoMustLeave[side])
}

/**
 * Abre la salida obligatoria del líbero cada vez que se pinta la pantalla con una salida
 * pendiente: tras el punto, al deshacer la salida o al volver a abrir el acta. No depende de
 * la ayuda con el líbero, porque sin apuntarla no se puede seguir.
 * @param {App} app aplicación
 */
function requireLiberoExit(app) {
    const session = app.session
    if (!app.dialog || !session?.record || session.record.sealed || app.dialog.isLocked) {
        return
    }
    let side
    try {
        side = session.match ? pendingExit(session.match) : undefined
    } catch {
        return
    }
    if (side) {
        new LiberoLeaveDialog(app).open({ side })
    }
}

/**
 * Propuesta de vuelta del líbero tras un punto: el equipo acaba de perder el saque, el que
 * sacaba es un jugador al que el líbero ya reemplazó en este set, sigue en la zona I y el
 * líbero está fuera. Propone el último líbero que entró por él y solo si el motor lo admite.
 * @param {Match} match partido tras la jugada
 * @param {object} play jugada aceptada
 * @param {object} rules motor de reglas
 * @param {object} record acta
 * @returns {{side: string, libero: string, server: string}|null}
 */
function liberoReturn(match, play, rules, record) {
    if (play.kind !== "rally" || !match.settings.liberoAllowed) {
        return null
    }
    const period = currentPeriod(match)
    const winner = period.serving
    const side = rival(winner)
    const won = period.turns[winner].at(-1)
    const lost = period.turns[side].at(-1)
    // Cambio de saque: el turno del ganador se ha abierto con este mismo punto.
    if (!won || !lost || won.since !== period.score[winner] || period.libero[side]) {
        return null
    }
    const server = lost.server
    if (period.rotation[side][0] !== server) {
        return null
    }
    const team = match.teams[side]
    const swaps = period.liberoSwaps[side]
        .filter((swap) => swap.leaving === server && team.find(swap.entering)?.libero)
    const libero = swaps.at(-1)?.entering
    if (!libero) {
        return null
    }
    const trial = { kind: "liberoIn", side, libero, leaving: server, at: new Date().toISOString() }
    if (rules.check(record.settings, record.info, record.plays, trial) !== null) {
        return null
    }
    return { side, libero, server }
}
