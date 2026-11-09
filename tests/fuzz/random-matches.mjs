/**
 * Partidos al azar contra el motor. Cada partido elige jugadas con unas probabilidades parecidas
 * a las de un partido real, deja que el motor rechace las ilegales y, después de cada jugada
 * aceptada, comprueba las invariantes. Además verifica que aplicar jugada a jugada da el mismo
 * estado que reconstruir desde cero y que el acta sobrevive a pasar por JSON.
 *
 * Uso: node tests/fuzz/random-matches.mjs --games N --seed S
 * Sale con código 1 al primer fallo e imprime la semilla, el partido y el prefijo mínimo.
 * @module tests/fuzz/random-matches.mjs
 */
import { fileURLToPath } from "node:url"
import { loadRules } from "../support/load.mjs"
import { firstBroken } from "../support/invariants.mjs"
import { mulberry32, pick, weighted } from "../support/prng.mjs"
import { firstDifference, snapshot } from "../support/snapshot.mjs"

/** Jugadas por partido como máximo; un partido normal termina con muchas menos. */
const STEP_LIMIT = 900

/** Cada cuántos pasos se compara la aplicación incremental con la reconstrucción. */
const INCREMENTAL_EVERY = 10

/** Probabilidad de deshacer la última jugada en un paso cualquiera. */
const UNDO_CHANCE = 0.03

/**
 * Peso de cada tipo de jugada con el set en marcha. Los tantos dominan, como en la pista.
 * @type {Array<[string, number]>}
 */
const LIVE_ACTIONS = Object.entries({
    rally: 750,
    timeout: 40,
    substitution: 80,
    libero: 60,
    sanction: 15,
    replayRally: 10,
    liberoUnfit: 5,
    improper: 3,
    rotationFault: 5,
    forfeit: 2,
})

/** Niveles de sanción con el set en marcha; el castigo sale el doble. */
const LIVE_LEVELS = [
    "warning",
    "penalty",
    "penalty",
    "delayWarning",
    "delayPenalty",
    "expulsion",
    "disqualification",
]

/** Niveles de sanción al cuerpo técnico entre sets. */
const BREAK_LEVELS = ["penalty", "warning", "delayWarning", "delayPenalty"]

/**
 * Plantilla de un lado: diez jugadores con el 1 de capitán, los líberos pedidos (20 y 21) y el
 * 00, que obliga a distinguirlo del 0.
 * @param {"home"|"away"} side lado
 * @param {number} liberos cuántos líberos (0, 1 o 2)
 * @returns {object} jugada roster
 */
function randomRoster(side, liberos) {
    const players = []
    for (let index = 1; index <= 10; index += 1) {
        players.push({ shirt: String(index), name: side + index, captain: index === 1 })
    }
    for (let index = 0; index < liberos; index += 1) {
        players.push({ shirt: String(20 + index), name: "Lib" + index, libero: true })
    }
    players.push({ shirt: "00", name: side + "00" })
    return { kind: "roster", side, name: side, players }
}

/**
 * Estado de un partido en curso del generador: jugadas aceptadas, reloj y contadores.
 */
class RandomGame {
    #rules
    #rng
    #clock = Date.parse("2030-01-01T10:00:00Z")

    /**
     * @param {object} rules motor
     * @param {() => number} rng generador
     */
    constructor(rules, rng) {
        this.#rules = rules
        this.#rng = rng
        this.settings = { bestOf: pick(rng, [5, 5, 3]), fullSetRule: rng() < 0.3 }
        this.info = {}
        this.plays = []
        this.tried = 0
        this.refused = 0
        this.undone = 0
    }

    /**
     * Intenta añadir una jugada: si el motor la acepta se guarda con su hora.
     * @param {object} play jugada sin hora
     * @returns {boolean} si se aceptó
     */
    offer(play) {
        this.#clock += 15000
        const stamped = { ...play, at: new Date(this.#clock).toISOString() }
        this.tried += 1
        const verdict = this.#rules.check(this.settings, this.info, this.plays, stamped)
        if (verdict !== null) {
            this.refused += 1
            return false
        }
        this.plays.push(stamped)
        return true
    }

    /** Partido reconstruido con las jugadas actuales. */
    state() {
        return this.#rules.replay(this.settings, this.info, this.plays)
    }

    /**
     * Elige y propone seis titulares al azar para cada lado entre los que pueden jugar.
     * @param {object} match partido
     */
    offerLineups(match) {
        for (const side of ["home", "away"]) {
            const free = match.teams[side].players
                .filter((player) => this.#canStart(match, side, player))
                .map((player) => player.shirt)
            const chosen = []
            while (chosen.length < 6 && free.length > 0) {
                const index = Math.floor(this.#rng() * free.length)
                chosen.push(free.splice(index, 1)[0])
            }
            this.offer({ kind: "lineup", side, shirts: chosen })
        }
    }

    /**
     * Indica si un jugador puede ser titular: no es líbero ni está fuera del partido.
     * @param {object} match partido
     * @param {"home"|"away"} side lado
     * @param {object} player jugador
     * @returns {boolean}
     */
    #canStart(match, side, player) {
        if (player.libero) {
            return false
        }
        const shirt = player.shirt
        return !match.disqualified[side].has(shirt) && !match.outForMatch[side].has(shirt)
    }
}

/**
 * Sorteo al azar.
 * @param {() => number} rng generador
 * @returns {object} jugada toss
 */
function randomToss(rng) {
    return { kind: "toss", server: pick(rng, ["home", "away"]), left: pick(rng, ["home", "away"]) }
}

/**
 * Juega un partido al azar. El observador recibe el partido reconstruido en cada paso, justo
 * al empezarlo, y puede devolver un texto para cortar el partido con ese fallo.
 * @param {object} rules motor
 * @param {() => number} rng generador
 * @param {(match: object, game: RandomGame) => string|null} [observe] comprobación por paso
 * @returns {{settings: object, info: object, plays: object[], failure: string|null,
 *     tried: number, refused: number, undone: number}}
 */
export function generateMatch(rules, rng, observe = () => null) {
    const game = new RandomGame(rules, rng)
    game.offer(randomRoster("home", pick(rng, [0, 1, 2])))
    game.offer(randomRoster("away", pick(rng, [0, 1, 2])))
    game.offer(randomToss(rng))
    game.offerLineups(game.state())
    game.offer({ kind: "startPeriod" })
    let failure = null
    for (let step = 0; step < STEP_LIMIT && failure === null; step += 1) {
        const match = game.state()
        failure = observe(match, game)
        if (failure !== null || match.phase === "over") {
            break
        }
        failure = advance(rules, rng, game, match)
    }
    return {
        settings: game.settings,
        info: game.info,
        plays: game.plays,
        failure,
        tried: game.tried,
        refused: game.refused,
        undone: game.undone,
    }
}

/**
 * Da un paso del partido según la fase.
 * @param {object} rules motor
 * @param {() => number} rng generador
 * @param {RandomGame} game partido en curso
 * @param {object} match estado actual
 * @returns {string|null} fallo del propio generador o null
 */
function advance(rules, rng, game, match) {
    if (match.phase === "break") {
        return stepBetweenPeriods(rules, rng, game, match)
    }
    if (rng() < UNDO_CHANCE && game.plays.length > 6) {
        return stepUndo(rules, rng, game)
    }
    const period = rules.currentPeriod(match)
    if (period.mustReplace.home.length > 0 || period.mustReplace.away.length > 0) {
        return stepReplaceSanctioned(game, match, period)
    }
    const captainSide = pick(rng, ["home", "away"])
    if (rules.needsActingCaptain(match, captainSide) && rng() < 0.5) {
        const shirt = pick(rng, rules.onCourt(period, captainSide))
        game.offer({ kind: "actingCaptain", side: captainSide, shirt })
        return null
    }
    stepLive(rules, rng, game, match, period)
    return null
}

/**
 * Entre sets: a veces una sanción al entrenador, el sorteo si toca, alineaciones e inicio.
 * @param {object} rules motor
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @param {object} match estado
 * @returns {string|null}
 */
function stepBetweenPeriods(rules, rng, game, match) {
    if (rng() < 0.1) {
        const side = pick(rng, ["home", "away"])
        game.offer({ kind: "sanction", side, target: "coach", level: pick(rng, BREAK_LEVELS) })
    }
    const period = rules.currentPeriod(match)
    if (period.decider && !period.firstServer) {
        game.offer(randomToss(rng))
    }
    game.offerLineups(match)
    if (!game.offer({ kind: "startPeriod" })) {
        return "no se puede empezar el set"
    }
    return null
}

/**
 * Deshace la última jugada y comprueba que el estado coincide con el del prefijo; a veces la
 * rehace.
 * @param {object} rules motor
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @returns {string|null}
 */
function stepUndo(rules, rng, game) {
    const expected = snapshot(rules.replay(game.settings, game.info, game.plays.slice(0, -1)))
    const last = game.plays.pop()
    game.undone += 1
    if (snapshot(game.state()) !== expected) {
        return "deshacer no deja el estado anterior"
    }
    if (rng() < 0.5) {
        game.plays.push(last)
    }
    return null
}

/**
 * Sustituye al primer expulsado o descalificado pendiente: primero con una sustitución normal y,
 * si no hay ninguna legal, con una excepcional.
 * @param {RandomGame} game partido
 * @param {object} match estado
 * @param {object} period periodo en juego
 * @returns {string|null}
 */
function stepReplaceSanctioned(game, match, period) {
    const side = period.mustReplace.home.length > 0 ? "home" : "away"
    const leaving = period.mustReplace[side][0]
    const bench = match.teams[side].players
        .filter((player) => !player.libero && !period.rotation[side].includes(player.shirt))
        .map((player) => player.shirt)
    for (const entering of bench) {
        if (game.offer({ kind: "substitution", side, leaving, entering })) {
            return null
        }
    }
    for (const entering of bench) {
        if (game.offer({ kind: "substitution", side, leaving, entering, exceptional: true })) {
            return null
        }
    }
    return "expulsado sin forma de sustituirlo (equipo incompleto)"
}

/**
 * Elige una jugada con el set en marcha y la propone.
 * @param {object} rules motor
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @param {object} match estado
 * @param {object} period periodo en juego
 */
function stepLive(rules, rng, game, match, period) {
    const side = pick(rng, ["home", "away"])
    const shirts = match.teams[side].players.map((player) => player.shirt)
    const action = weighted(rng, LIVE_ACTIONS)
    if (action === "rally" || action === "timeout" || action === "improper") {
        game.offer({ kind: action, side })
    } else if (action === "substitution") {
        const play = { kind: "substitution", side, leaving: pick(rng, period.rotation[side]) }
        play.entering = pick(rng, shirts)
        if (rng() < 0.05) {
            play.exceptional = true
        }
        game.offer(play)
    } else if (action === "libero") {
        offerLiberoChange(rng, game, match, period, side)
    } else if (action === "sanction") {
        const targets = ["team", "coach", ...period.rotation[side], ...shirts]
        const level = pick(rng, LIVE_LEVELS)
        game.offer({ kind: "sanction", side, target: pick(rng, targets), level })
    } else if (action === "replayRally") {
        game.offer({ kind: "replayRally" })
    } else if (action === "liberoUnfit") {
        offerLiberoUnfit(rng, game, match, side, shirts)
    } else if (action === "rotationFault") {
        offerRotationFault(rng, game, period, side)
    } else {
        game.offer({ kind: "forfeit", side, reason: "shortHanded" })
    }
}

/**
 * Entrada, salida o cambio de líbero, si el lado tiene alguno.
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @param {object} match estado
 * @param {object} period periodo
 * @param {"home"|"away"} side lado
 */
function offerLiberoChange(rng, game, match, period, side) {
    const liberos = match.teams[side].players
        .filter((player) => player.libero)
        .map((player) => player.shirt)
    if (liberos.length === 0) {
        return
    }
    const current = period.libero[side]
    if (current && rng() < 0.5) {
        game.offer({ kind: "liberoOut", side })
        return
    }
    let leaving = pick(rng, period.rotation[side])
    if (current && rng() < 0.3) {
        leaving = current.shirt
    }
    game.offer({ kind: "liberoIn", side, libero: pick(rng, liberos), leaving })
}

/**
 * Declara impedido a un líbero que todavía juega; a veces redesigna a otro jugador.
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @param {object} match estado
 * @param {"home"|"away"} side lado
 * @param {string[]} shirts dorsales del lado
 */
function offerLiberoUnfit(rng, game, match, side, shirts) {
    const available = match.teams[side].players
        .filter((player) => player.libero && !match.outForMatch[side].has(player.shirt))
        .map((player) => player.shirt)
    if (available.length === 0) {
        return
    }
    const play = { kind: "liberoUnfit", side, libero: pick(rng, available) }
    if (rng() < 0.6) {
        play.successor = pick(rng, shirts)
    }
    game.offer(play)
}

/**
 * Falta de rotación, a veces con el momento exacto para anular puntos (FIVB 7.7.2).
 * @param {() => number} rng generador
 * @param {RandomGame} game partido
 * @param {object} period periodo
 * @param {"home"|"away"} side lado
 */
function offerRotationFault(rng, game, period, side) {
    const play = { kind: "rotationFault", side }
    if (rng() < 0.3) {
        play.rollbackTo = Math.floor(rng() * (period.score[side] + 1))
    }
    game.offer(play)
}

/**
 * Comprueba que aplicar jugada a jugada sobre un Match vivo da el mismo estado que replay.
 * @param {object} rules motor
 * @param {object} generated partido generado
 * @param {number} count número de jugadas a aplicar
 * @returns {string|null}
 */
function incrementalFinding(rules, generated, count) {
    const live = new rules.Match(generated.settings, generated.info)
    for (const play of generated.plays.slice(0, count)) {
        live.apply(play)
    }
    const prefix = generated.plays.slice(0, count)
    const rebuilt = rules.replay(generated.settings, generated.info, prefix)
    const where = firstDifference(snapshot(live), snapshot(rebuilt))
    return where === null ? null : "apply encadenado distinto de replay en " + where
}

/**
 * Comprueba que el acta da el mismo partido después de pasar por JSON.
 * @param {object} rules motor
 * @param {object} generated partido generado
 * @returns {string|null}
 */
function jsonFinding(rules, generated) {
    const copy = JSON.parse(JSON.stringify(generated.plays))
    const direct = snapshot(rules.replay(generated.settings, generated.info, generated.plays))
    const viaJson = snapshot(rules.replay(generated.settings, generated.info, copy))
    const where = firstDifference(direct, viaJson)
    return where === null ? null : "el acta cambia al pasar por JSON en " + where
}

/**
 * Todos los fallos que interesan de un prefijo: invariantes, incremental y JSON.
 * @param {object} rules motor
 * @param {object} settings ajustes
 * @param {object} info datos
 * @param {object[]} plays jugadas
 * @returns {string|null}
 */
function prefixFinding(rules, settings, info, plays) {
    let match
    try {
        match = rules.replay(settings, info, plays)
    } catch (error) {
        return error instanceof rules.RuleViolation ? null : "error del motor: " + error.message
    }
    const broken = firstBroken(match, rules)
    if (broken !== null) {
        return broken.name + ": " + broken.text
    }
    const generated = { settings, info, plays }
    return incrementalFinding(rules, generated, plays.length) ?? jsonFinding(rules, generated)
}

/**
 * Recorta un prefijo que falla quitando jugadas una a una (de la penúltima hacia atrás) mientras
 * el fallo siga apareciendo con el mismo nombre. La última jugada se conserva: es la que dispara.
 * @param {object} rules motor
 * @param {object} settings ajustes
 * @param {object} info datos
 * @param {object[]} plays prefijo que falla
 * @param {string} finding texto del fallo
 * @returns {object[]} prefijo mínimo
 */
export function shrinkPrefix(rules, settings, info, plays, finding) {
    const label = finding.split(":")[0]
    let current = plays
    for (let index = current.length - 2; index >= 0; index -= 1) {
        const candidate = current.slice(0, index).concat(current.slice(index + 1))
        const outcome = prefixFinding(rules, settings, info, candidate)
        if (outcome !== null && outcome.split(":")[0] === label) {
            current = candidate
        }
    }
    return current
}

/**
 * Lee --games y --seed de la línea de órdenes.
 * @param {string[]} args argumentos
 * @returns {{games: number, seed: number}}
 */
function readOptions(args) {
    const options = { games: 1500, seed: 90210 }
    for (let index = 0; index < args.length; index += 1) {
        const value = Number(args[index + 1])
        if (args[index] === "--games" && Number.isFinite(value)) {
            options.games = value
        }
        if (args[index] === "--seed" && Number.isFinite(value)) {
            options.seed = value
        }
    }
    return options
}

/**
 * Juega una tanda de partidos y devuelve el primer fallo con su prefijo mínimo.
 * @param {object} rules motor
 * @param {{games: number, seed: number}} options cuántos partidos y con qué semilla
 * @returns {{games: number, tried: number, refused: number, undone: number,
 *     failure: null|{game: number, text: string, plays: object[], minimal: object[]}}}
 */
export function runBatch(rules, options) {
    const rng = mulberry32(options.seed)
    const totals = { games: 0, tried: 0, refused: 0, undone: 0, failure: null }
    for (let game = 0; game < options.games && totals.failure === null; game += 1) {
        let steps = 0
        const generated = generateMatch(rules, rng, function observe(match, current) {
            steps += 1
            const broken = firstBroken(match, rules)
            if (broken !== null) {
                return broken.name + ": " + broken.text
            }
            if (steps % INCREMENTAL_EVERY === 0) {
                return incrementalFinding(rules, current, current.plays.length)
            }
            return null
        })
        totals.games += 1
        totals.tried += generated.tried
        totals.refused += generated.refused
        totals.undone += generated.undone
        const text = generated.failure
            ?? incrementalFinding(rules, generated, generated.plays.length)
            ?? jsonFinding(rules, generated)
        if (text !== null) {
            const { settings, info, plays } = generated
            const minimal = shrinkPrefix(rules, settings, info, plays, text)
            totals.failure = { game, text, settings, plays, minimal }
        }
    }
    return totals
}

/**
 * Punto de entrada de la línea de órdenes.
 * @param {string[]} args argumentos
 * @returns {Promise<number>} código de salida
 */
export async function runRandomMatches(args) {
    const options = readOptions(args)
    const rules = await loadRules()
    const startedAt = Date.now()
    const totals = runBatch(rules, options)
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(totals.games + " partidos · " + totals.tried + " jugadas propuestas ("
        + totals.refused + " rechazadas) · " + totals.undone + " deshacer · " + seconds
        + " s · semilla " + options.seed)
    if (totals.failure === null) {
        console.log("Ninguna invariante rota.")
        return 0
    }
    const failure = totals.failure
    console.log("FALLO en el partido " + failure.game + " con semilla " + options.seed + ": "
        + failure.text)
    console.log("ajustes: " + JSON.stringify(failure.settings))
    console.log("última jugada: " + JSON.stringify(failure.plays.at(-1)))
    console.log("prefijo mínimo (" + failure.minimal.length + " jugadas):")
    for (const play of failure.minimal) {
        console.log("  " + JSON.stringify(play))
    }
    return 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    process.exitCode = await runRandomMatches(process.argv.slice(2))
}
