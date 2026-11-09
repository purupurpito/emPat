/**
 * Cambios de jugadores: sustituciones y movimientos del líbero.
 * @module src/rules/plays/changes.js
 */

import { PHASE, isSide } from "../constants.js"
import { deny } from "../violation.js"
import { TEXT } from "../messages.js"

/** Zonas de zaguero por las que puede entrar el líbero: I, V y VI (FIVB 19.3.1.1). */
const BACK_ZONES = Object.freeze([0, 4, 5])

/**
 * Sustitución regular o excepcional (FIVB 15.5 a 15.7). La excepcional sirve cuando no hay
 * cambio legal posible (lesión, expulsión o descalificación): entra cualquiera que no esté en
 * pista salvo los líberos, no cuenta para el tope del set y quien sale queda fuera el resto
 * del partido. La regular sigue las parejas titular-suplente del set.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, leaving, entering, exceptional?}
 * @param {string|null} at marca de tiempo ISO
 * @throws {TypeError} si el lado no es home ni away
 */
export function substitution(match, play, at) {
    const period = match.current
    if (match.phase !== PHASE.live) {
        deny(TEXT.subsNeedLive)
    }
    const side = play.side
    if (!isSide(side)) {
        throw new TypeError("lado desconocido")
    }
    const { leaving, entering } = play
    if (play.exceptional === true) {
        checkExceptional(match, period, side, leaving, entering)
        match.outForMatch[side].add(leaving)
    } else {
        const blocker = substitutionBlocker(match, period, side, leaving, entering)
        if (blocker) {
            deny(blocker)
        }
        pairUp(period, side, leaving, entering)
        period.subCount[side] += 1
    }
    const rotation = period.rotation[side]
    period.rotation[side] = rotation.map((shirt) => swapShirt(shirt, leaving, entering))
    // Un sancionado que estaba fuera por el líbero: el líbero pasa a cubrir al que entra.
    const libero = period.libero[side]
    if (libero && libero.replacing === leaving) {
        period.libero[side] = { ...libero, replacing: entering }
    }
    period.substitutions[side].push({
        leaving,
        entering,
        ...period.scoreFor(side),
        // Se guarda el valor recibido (o false) para no perder un tipo que la interfaz no conoce.
        exceptional: play.exceptional || false,
        at,
    })
    period.mustReplace[side] = period.mustReplace[side].filter((shirt) => shirt !== leaving)
}

/**
 * Comprobaciones de la sustitución excepcional, en orden: quien sale está en pista y no tapado
 * por el líbero; quien entra existe, no es líbero y está disponible.
 * @param {Match} match partido
 * @param {Period} period periodo en juego
 * @param {"home"|"away"} side lado
 * @param {string} leaving quién sale
 * @param {string} entering quién entra
 */
function checkExceptional(match, period, side, leaving, entering) {
    const rotation = period.rotation[side]
    if (!rotation.includes(leaving)) {
        deny(TEXT.notOnCourt(leaving))
    }
    if (hiddenByLibero(period, side, leaving)) {
        deny(TEXT.behindLibero(leaving))
    }
    const player = match.teams[side].find(entering)
    if (!player || player.libero) {
        deny(TEXT.cannotEnter(entering))
    }
    const unavailable = rotation.includes(entering)
        || match.disqualified[side].has(entering)
        || match.outForMatch[side].has(entering)
        || period.expelled[side].has(entering)
    if (unavailable) {
        deny(TEXT.cannotEnter(entering))
    }
}

/**
 * Anota la pareja de una sustitución regular. Si sale un titular, el suplente queda ligado a
 * él (y el titular no se borra de la pareja al volver); si sale un suplente, los dos quedan
 * cerrados para el resto del set (FIVB 15.6).
 * @param {Period} period periodo en juego
 * @param {"home"|"away"} side lado
 * @param {string} leaving quién sale
 * @param {string} entering quién entra
 */
function pairUp(period, side, leaving, entering) {
    if (period.lineup[side].includes(leaving)) {
        period.partners[side][leaving] = entering
        period.hasPlayed[side].add(entering)
        return
    }
    period.closed[side].add(entering)
    period.closed[side].add(leaving)
}

/**
 * Cambia un dorsal de la rotación si es el que sale.
 * @param {string} shirt dorsal de la rotación
 * @param {string} leaving quién sale
 * @param {string} entering quién entra
 * @returns {string}
 */
function swapShirt(shirt, leaving, entering) {
    if (shirt === leaving) {
        return entering
    }
    return shirt
}

/**
 * Indica si un jugador está en el banquillo porque el líbero ocupa su sitio. No cuenta si está
 * pendiente de sustitución por sanción, porque entonces se le puede cambiar directamente.
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @returns {boolean}
 */
function hiddenByLibero(period, side, shirt) {
    const libero = period.libero[side]
    if (!libero || libero.replacing !== shirt) {
        return false
    }
    return !period.mustReplace[side].includes(shirt)
}

/**
 * Titular por el que entró un suplente en este set, o undefined.
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @param {string} substitute dorsal del suplente
 * @returns {string|undefined}
 */
function starterOf(period, side, substitute) {
    const pairs = period.partners[side]
    return Object.keys(pairs).find((starter) => pairs[starter] === substitute)
}

/**
 * Explica por qué no se puede hacer una sustitución regular concreta (FIVB 15.5 y 15.6).
 * Devuelve el primer motivo en este orden: quien entra no está en el acta, es líbero; quien
 * sale está tapado por el líbero o no está en pista; quien entra ya está en pista, no puede
 * volver en el partido o está expulsado; tope de sustituciones; y las reglas de parejas. La
 * interfaz lo usa para desactivar opciones sin intentar la jugada.
 * @param {Match} match partido
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @param {string|null} leaving quién sale
 * @param {string} entering quién entra
 * @returns {string|null} motivo o null si es posible
 */
export function substitutionBlocker(match, period, side, leaving, entering) {
    const rotation = period.rotation[side]
    const incoming = match.teams[side].find(entering)
    if (!incoming) {
        return TEXT.notListed(entering)
    }
    if (incoming.libero) {
        return TEXT.liberoBySub
    }
    if (hiddenByLibero(period, side, leaving)) {
        return TEXT.behindLibero(leaving)
    }
    if (!rotation.includes(leaving)) {
        return TEXT.notOnCourt(leaving)
    }
    if (rotation.includes(entering) || period.libero[side]?.shirt === entering) {
        return TEXT.alreadyOnCourt(entering)
    }
    if (match.disqualified[side].has(entering) || match.outForMatch[side].has(entering)) {
        return TEXT.barredForMatch(entering)
    }
    if (period.expelled[side].has(entering)) {
        return TEXT.expelledThisSet(entering)
    }
    const limit = match.settings.substitutions
    if (period.subCount[side] >= limit) {
        return TEXT.subsUsed(limit)
    }
    const starters = period.lineup[side]
    if (starters.includes(leaving)) {
        return starterLeaving(period, side, leaving, entering)
    }
    const starter = starterOf(period, side, leaving)
    if (starter === undefined) {
        return TEXT.notRegularExit(leaving)
    }
    if (starter !== entering) {
        return TEXT.onlyStarterBack(leaving, starter)
    }
    return null
}

/**
 * Reglas de parejas cuando sale un titular: no puede salir dos veces, no entra otro titular y
 * no entra un suplente que ya jugó por otro.
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @param {string} leaving titular que sale
 * @param {string} entering quién entra
 * @returns {string|null}
 */
function starterLeaving(period, side, leaving, entering) {
    if (period.closed[side].has(leaving)) {
        return TEXT.starterClosed(leaving)
    }
    if (period.lineup[side].includes(entering)) {
        return TEXT.starterBack(entering)
    }
    if (period.hasPlayed[side].has(entering)) {
        return TEXT.benchUsed(entering)
    }
    return null
}

/**
 * Indica si el jugador está inscrito como líbero en ese lado.
 * @param {Match} match partido
 * @param {"home"|"away"} side lado
 * @param {string} shirt dorsal
 * @returns {boolean}
 */
function isRegisteredLibero(match, side, shirt) {
    return Boolean(match.teams[side].find(shirt)?.libero)
}

/**
 * Indica si el líbero aún no puede volver a cambiar: entre dos reemplazos tiene que haber una
 * jugada completada (FIVB 19.3.2.1). Fuera del set en juego no se exige.
 * @param {Match} match partido
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @returns {boolean}
 */
function tooSoonForLibero(match, period, side) {
    return period.rallyCount === period.lastLiberoRally[side] && match.phase === PHASE.live
}

/**
 * Entrada del líbero por un zaguero (FIVB 19.3), o cambio de un líbero por el otro, que ocupa
 * el mismo sitio. No puede entrar por quien va a sacar.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, libero, leaving}
 * @param {string|null} at marca de tiempo ISO
 */
export function liberoIn(match, play, at) {
    const period = match.current
    if (!match.settings.liberoAllowed) {
        deny(TEXT.noLibero)
    }
    if (match.phase !== PHASE.live) {
        deny(TEXT.liberoNeedsLive)
    }
    const { side, libero, leaving } = play
    if (!isRegisteredLibero(match, side, libero)) {
        deny(TEXT.notRegisteredLibero(libero))
    }
    const barred = match.disqualified[side].has(libero)
        || period.expelled[side].has(libero)
        || match.outForMatch[side].has(libero)
    if (barred) {
        deny(TEXT.liberoBarred(libero))
    }
    const present = period.libero[side]
    if (present) {
        swapLiberos(match, period, play, at)
        return
    }
    const zone = period.rotation[side].indexOf(leaving)
    if (zone < 0) {
        deny(TEXT.notOnCourt(leaving))
    }
    if (!BACK_ZONES.includes(zone)) {
        deny(TEXT.backRowOnly)
    }
    if (zone === 0 && period.serving === side) {
        deny(TEXT.liberoCannotServe)
    }
    if (tooSoonForLibero(match, period, side)) {
        deny(TEXT.rallyBetweenSwaps)
    }
    period.libero[side] = { shirt: libero, replacing: leaving, zone }
    logSwap(period, side, libero, leaving, at)
    period.lastLiberoRally[side] = period.rallyCount
}

/**
 * Cambio directo de un líbero por el otro sin pasar por el jugador (FIVB 19.3.2.2).
 * @param {Match} match partido
 * @param {Period} period periodo en juego
 * @param {object} play jugada {side, libero, leaving}
 * @param {string|null} at marca de tiempo ISO
 */
function swapLiberos(match, period, play, at) {
    const { side, libero, leaving } = play
    const present = period.libero[side]
    if (leaving !== present.shirt) {
        deny(TEXT.liberoAlreadyIn)
    }
    if (libero === leaving) {
        deny(TEXT.sameLibero)
    }
    if (tooSoonForLibero(match, period, side)) {
        deny(TEXT.rallyBetweenSwaps)
    }
    logSwap(period, side, libero, leaving, at)
    period.libero[side] = { ...present, shirt: libero }
    period.lastLiberoRally[side] = period.rallyCount
}

/**
 * Apunta un movimiento del líbero con el marcador del lado.
 * @param {Period} period periodo
 * @param {"home"|"away"} side lado
 * @param {string} entering quién entra
 * @param {string} leaving quién sale
 * @param {string|null} at marca de tiempo ISO
 */
function logSwap(period, side, entering, leaving, at) {
    period.liberoSwaps[side].push({ entering, leaving, ...period.scoreFor(side), at })
}

/**
 * Salida del líbero: vuelve el jugador al que sustituía. No mira la fase; la jugada
 * completada entre reemplazos solo se exige con el set en juego.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side}
 * @param {string|null} at marca de tiempo ISO
 */
export function liberoOut(match, play, at) {
    const period = match.current
    const side = play.side
    const present = period.libero[side]
    if (!present) {
        deny(TEXT.noLiberoOnCourt)
    }
    // La salida obligatoria por rotar a la delantera no espera a otra jugada.
    if (!period.liberoMustLeave[side] && tooSoonForLibero(match, period, side)) {
        deny(TEXT.rallyBetweenSwaps)
    }
    logSwap(period, side, present.replacing, present.shirt, at)
    period.liberoMustLeave[side] = false
    period.libero[side] = null
    period.lastLiberoRally[side] = period.rallyCount
}

/**
 * Líbero que no puede seguir (lesión, enfermedad, expulsión o descalificación) y su posible
 * redesignación (FIVB 19.4). Con otro líbero disponible no se redesigna (FIVB 19.4.3.1); uno
 * expulsado en este set no cuenta como disponible. El redesignado pasa a ser líbero el resto
 * del partido. Si el impedido estaba en pista, le sustituye el nuevo o el otro líbero; si no
 * hay, vuelve el jugador.
 * @param {Match} match partido que se modifica
 * @param {object} play jugada ya normalizada {side, libero, successor?}
 * @param {string|null} at marca de tiempo ISO
 */
export function liberoUnfit(match, play, at) {
    const period = match.current
    if (!match.settings.liberoAllowed) {
        deny(TEXT.noLibero)
    }
    if (match.phase !== PHASE.live && match.phase !== PHASE.break) {
        deny(TEXT.needMatchRunning)
    }
    const side = play.side
    const team = match.teams[side]
    const injured = play.libero
    if (!team.find(injured)?.libero) {
        deny(TEXT.notALibero(injured))
    }
    const gone = match.outForMatch[side]
    if (gone.has(injured)) {
        deny(TEXT.noLongerPlays(injured))
    }
    const wasOnCourt = period.libero[side]?.shirt === injured
    let successor = null
    if (play.successor !== null && play.successor !== undefined) {
        successor = redesignate(match, period, side, injured, play.successor)
    }
    gone.add(injured)
    match.liberoLosses[side].push({
        libero: injured,
        successor,
        period: period.number,
        ...period.scoreFor(side),
        at,
    })
    if (!wasOnCourt) {
        return
    }
    const cover = successor || spareLibero(team, gone, injured)
    if (cover) {
        logSwap(period, side, cover, injured, at)
        period.libero[side] = { ...period.libero[side], shirt: cover }
    } else {
        logSwap(period, side, period.libero[side].replacing, injured, at)
        period.libero[side] = null
    }
    period.lastLiberoRally[side] = period.rallyCount
}

/**
 * Comprueba y aplica la redesignación de un jugador como líbero. Modifica el jugador del
 * estado, que desde ese momento cuenta como líbero.
 * @param {Match} match partido
 * @param {Period} period periodo actual
 * @param {"home"|"away"} side lado
 * @param {string} injured líbero impedido
 * @param {string} shirt dorsal propuesto
 * @returns {string} dorsal del nuevo líbero
 */
function redesignate(match, period, side, injured, shirt) {
    const chosen = match.teams[side].find(shirt)
    if (!chosen) {
        deny(TEXT.notListed(shirt))
    }
    if (chosen.libero) {
        deny(TEXT.alreadyLibero(shirt))
    }
    const players = match.teams[side].players
    const other = players.find((player) => isAvailableLibero(match, period, side, player, injured))
    if (other) {
        deny(TEXT.otherLiberoLeft(other.shirt))
    }
    if ((period.rotation[side] || []).includes(shirt)) {
        deny(TEXT.successorOnCourt(shirt))
    }
    if (match.disqualified[side].has(shirt) || match.outForMatch[side].has(shirt)) {
        deny(TEXT.cannotPlay(shirt))
    }
    chosen.libero = true
    chosen.redesignated = true
    return chosen.shirt
}

/**
 * Indica si un jugador es otro líbero que aún puede jugar en este set.
 * @param {Match} match partido
 * @param {Period} period periodo actual
 * @param {"home"|"away"} side lado
 * @param {object} player candidato
 * @param {string} injured líbero impedido
 * @returns {boolean}
 */
function isAvailableLibero(match, period, side, player, injured) {
    if (!player.libero || player.shirt === injured) {
        return false
    }
    const shirt = player.shirt
    if (match.outForMatch[side].has(shirt) || match.disqualified[side].has(shirt)) {
        return false
    }
    return !period.expelled[side].has(shirt)
}

/**
 * Dorsal de otro líbero que pueda cubrir la pista; para esto solo se descartan los que han
 * quedado fuera del partido.
 * @param {Team} team equipo
 * @param {Set<string>} gone fuera del partido
 * @param {string} injured líbero impedido
 * @returns {string|undefined}
 */
function spareLibero(team, gone, injured) {
    for (const player of team.players) {
        if (player.libero && player.shirt !== injured && !gone.has(player.shirt)) {
            return player.shirt
        }
    }
    return undefined
}
