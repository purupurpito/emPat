/**
 * Estado completo del partido y despacho de jugadas hacia sus manejadores.
 * @module src/rules/match.js
 */

import { DEFAULT_SETTINGS, PHASE } from "./constants.js"
import { normalizePlay } from "./shirts.js"
import { deny } from "./violation.js"
import { TEXT } from "./messages.js"
import { Team } from "./team.js"
import { Period } from "./period.js"
import * as setupPlays from "./plays/setup.js"
import * as rallyPlays from "./plays/rally.js"
import * as changePlays from "./plays/changes.js"
import * as disciplinePlays from "./plays/discipline.js"
import * as paperworkPlays from "./plays/paperwork.js"

/**
 * Manejador de cada tipo de jugada. Se consulta como Map, y no como objeto, para que un kind
 * como "constructor" no encuentre nada heredado del prototipo.
 * @type {Map<string, (match: Match, play: object, at: string|null) => void>}
 */
const HANDLERS = new Map(Object.entries({
    roster: setupPlays.roster,
    openGolden: setupPlays.openGolden,
    actingCaptain: disciplinePlays.actingCaptain,
    toss: setupPlays.toss,
    lineup: setupPlays.lineup,
    startPeriod: setupPlays.startPeriod,
    rally: rallyPlays.rally,
    timeout: disciplinePlays.timeout,
    substitution: changePlays.substitution,
    liberoIn: changePlays.liberoIn,
    liberoOut: changePlays.liberoOut,
    sanction: disciplinePlays.sanction,
    improper: disciplinePlays.improper,
    note: paperworkPlays.note,
    sign: paperworkPlays.sign,
    rotationFault: rallyPlays.rotationFault,
    forfeit: rallyPlays.forfeit,
    replayRally: rallyPlays.replayRally,
    liberoUnfit: changePlays.liberoUnfit,
    fullSetMark: setupPlays.fullSetMark,
}))

/**
 * Crea un par {home, away} con el mismo valor primitivo o con objetos nuevos por lado.
 * @param {() => unknown} make fábrica del valor inicial
 * @returns {{home: unknown, away: unknown}}
 */
function bothSides(make) {
    return { home: make(), away: make() }
}

/**
 * Partido en memoria. Se construye vacío y avanza con apply; lanza RuleViolation cuando una
 * jugada no es legal y entonces el estado no debe reutilizarse, porque la jugada puede haber
 * dejado cambios a medias. Todas sus propiedades son públicas y de solo lectura para quien no
 * sea un manejador de jugadas.
 */
export class Match {
    /**
     * Crea un partido sin jugadas, mezclando los ajustes con los de serie.
     * @param {object} [settings] ajustes del motor
     * @param {object} [info] datos del encuentro, que el motor guarda sin mirar
     */
    constructor(settings = {}, info = {}) {
        this.settings = { ...DEFAULT_SETTINGS, ...settings }
        this.info = info || {}
        this.phase = PHASE.setup
        this.teams = bothSides(() => new Team("", [], []))
        this.tosses = []
        this.periods = [new Period(1, false)]
        this.setsWon = bothSides(() => 0)
        this.startedAt = null
        this.endedAt = null
        this.golden = null
        this.actingCaptains = []
        this.sanctions = []
        this.warned = bothSides(() => false)
        this.delayWarned = bothSides(() => false)
        this.improperCount = bothSides(() => 0)
        this.disqualified = bothSides(() => new Set())
        this.outForMatch = bothSides(() => new Set())
        this.notes = []
        this.signatures = {}
        this.automatic = []
        this.fullSetMarks = bothSides(() => ({}))
        this.liberoLosses = bothSides(() => [])
        this.pendingPenalties = []
        this.rotationFaults = []
        this.forfeit = null
    }

    /**
     * Aplica una jugada: la normaliza, la despacha por su kind y después revisa el capitán en
     * juego, porque casi cualquier jugada puede cambiar quién está en pista.
     * @param {object} play jugada
     * @throws {RuleViolation} si la jugada no es legal
     */
    apply(play) {
        this.dispatch(play)
        disciplinePlays.refreshActingCaptain(this)
    }

    /**
     * Ejecuta el manejador de la jugada sin la revisión posterior del capitán.
     * @param {object} play jugada tal como llega
     * @throws {RuleViolation} si la jugada no es legal o su kind no existe
     */
    dispatch(play) {
        const normal = normalizePlay(play)
        const handler = HANDLERS.get(normal.kind)
        if (handler === undefined) {
            deny(TEXT.unknownPlay(normal.kind))
        }
        handler(this, normal, normal.at || null)
    }

    /**
     * Periodo actual: el último creado, que puede estar en juego o esperando a empezar.
     * @returns {Period}
     */
    get current() {
        return this.periods[this.periods.length - 1]
    }

    /**
     * Sets necesarios para ganar el partido: la mitad del máximo, redondeando hacia arriba.
     * @returns {number}
     */
    get setsToWin() {
        return Math.ceil(this.settings.bestOf / 2)
    }

    /**
     * Puntos a los que se juega un periodo: los del decisivo o los de un set normal.
     * @param {Period} period periodo
     * @returns {number}
     */
    targetOf(period) {
        if (period.decider) {
            return this.settings.deciderPoints
        }
        return this.settings.setPoints
    }

    /**
     * Uso interno de los manejadores: suma un punto con todos sus efectos.
     * @param {"home"|"away"} side quién gana
     * @param {string} cause causa
     * @param {string|null} at marca de tiempo ISO
     */
    awardRally(side, cause, at) {
        rallyPlays.awardRally(this, side, cause, at)
    }

    /**
     * Uso interno de los manejadores: cierra el set en curso.
     * @param {string|null} at marca de tiempo ISO
     */
    closePeriod(at) {
        rallyPlays.closePeriod(this, at)
    }
}
