/**
 * Propiedades que un partido tiene que cumplir después de cualquier jugada aceptada, sea cual sea
 * el camino que lo ha llevado hasta ahí. El fuzz las comprueba en cada paso; si una falla, el
 * motor ha aceptado algo que el reglamento no permite o ha calculado mal una consecuencia.
 * @module tests/support/invariants.mjs
 */

/** Zonas de la zaga (I, V y VI) en índices de rotación. */
const BACK_ZONES = Object.freeze([0, 4, 5])

/**
 * Puntos necesarios para ganar un periodo.
 * @param {object} match partido
 * @param {object} period periodo
 * @returns {number}
 */
function targetOf(match, period) {
    return period.decider ? match.settings.deciderPoints : match.settings.setPoints
}

/**
 * Sets que hay que ganar para llevarse el partido.
 * @param {object} match partido
 * @returns {number}
 */
function setsNeeded(match) {
    return Math.ceil(match.settings.bestOf / 2)
}

/**
 * Devuelve el primer texto de fallo de una lista de comprobaciones o true si no hay ninguno.
 * @param {Array<string|null>} findings resultados parciales
 * @returns {true|string}
 */
function firstFinding(findings) {
    const found = findings.find((text) => typeof text === "string")
    return found === undefined ? true : found
}

/**
 * Nadie gana más sets de los que hacen falta.
 * @param {object} match partido
 * @returns {true|string}
 */
function setsWithinLimit(match) {
    const limit = setsNeeded(match)
    if (match.setsWon.home > limit || match.setsWon.away > limit) {
        return "demasiados sets ganados"
    }
    return true
}

/**
 * La fase over coincide con que alguien haya llegado a los sets necesarios. Con golden abierto
 * el partido ya está decidido y aun así vuelve a jugarse, por eso se deja fuera.
 * @param {object} match partido
 * @returns {true|string}
 */
function overMeansDecided(match) {
    if (match.golden) {
        return true
    }
    const decided = Math.max(match.setsWon.home, match.setsWon.away) === setsNeeded(match)
    if ((match.phase === "over") !== decided) {
        return "fase over incoherente con los sets ganados"
    }
    return true
}

/**
 * Indica si en un periodo un mismo lado ha cometido más de una falta de rotación habiendo ya
 * tantos anulados. En ese caso la segunda anulación cuenta también los tantos que ya estaban
 * anulados y el registro deja de cuadrar con el marcador; el motor lo hace así a propósito,
 * porque manda la conducta de la referencia, y la invariante no lo trata como fallo.
 * @param {object} match partido
 * @param {object} period periodo
 * @returns {boolean}
 */
function repeatedRollback(match, period) {
    if (!period.rallyLog.some((entry) => entry.voided)) {
        return false
    }
    const faults = match.rotationFaults.filter((fault) => fault.period === period.number)
    return faults.some((fault) => faults.filter((other) => other.side === fault.side).length > 1)
}

/**
 * El marcador de cada periodo coincide con los puntos válidos de su registro (los anulados por
 * una falta de rotación no cuentan).
 * @param {object} match partido
 * @returns {true|string}
 */
function scoreMatchesLog(match) {
    const findings = []
    for (const period of match.periods) {
        if (repeatedRollback(match, period)) {
            continue
        }
        const valid = period.rallyLog.filter((entry) => !entry.voided).length
        if (valid !== period.score.home + period.score.away) {
            findings.push("registro de puntos distinto del marcador en el set " + period.number)
        }
    }
    return firstFinding(findings)
}

/**
 * Indica si en un periodo alguna falta de rotación anuló tantos. Al restar tantos al infractor
 * el set puede cerrarse con más de dos de ventaja por encima del objetivo (FIVB 7.7.2).
 * @param {object} match partido
 * @param {object} period periodo
 * @returns {boolean}
 */
function hadRollback(match, period) {
    return match.rotationFaults.some((fault) => fault.period === period.number && fault.voided > 0)
}

/**
 * Un periodo acabado lo ganó alguien con el objetivo y dos de ventaja, sin pasarse salvo que
 * hubiera tantos anulados; uno en juego no debería seguir abierto si ya se cumple esa condición.
 * @param {object} match partido
 * @returns {true|string}
 */
function periodsEndCorrectly(match) {
    const findings = []
    for (const period of match.periods) {
        const target = targetOf(match, period)
        const { home, away } = period.score
        if (period.winner) {
            const won = period.score[period.winner]
            const lost = period.winner === "home" ? away : home
            const overshoot = won > target && won - lost !== 2 && !hadRollback(match, period)
            if (won < target || won - lost < 2 || overshoot) {
                findings.push("set " + period.number + " acabado mal " + home + "-" + away)
            }
            continue
        }
        if (period.startedAt && Math.max(home, away) >= target && Math.abs(home - away) >= 2) {
            findings.push("set " + period.number + " debería haber acabado " + home + "-" + away)
        }
    }
    return firstFinding(findings)
}

/**
 * Ningún equipo supera el tope de sustituciones normales ni de tiempos por periodo.
 * @param {object} match partido
 * @returns {true|string}
 */
function quotasRespected(match) {
    const findings = []
    for (const period of match.periods) {
        for (const side of ["home", "away"]) {
            if (period.subCount[side] > match.settings.substitutions) {
                findings.push("más sustituciones de las permitidas")
            }
            if (period.timeouts[side].length > match.settings.timeouts) {
                findings.push("más tiempos de los permitidos")
            }
        }
    }
    return firstFinding(findings)
}

/**
 * En el decisivo, una vez que alguien llega al punto de cambio, el cambio de campo ya se hizo.
 * @param {object} match partido
 * @returns {true|string}
 */
function deciderSwitchDone(match) {
    for (const period of match.periods) {
        if (!period.decider || !period.startedAt || period.switched) {
            continue
        }
        if (Math.max(period.score.home, period.score.away) >= match.settings.deciderSwitch) {
            return "set decisivo sin cambio de campo"
        }
    }
    return true
}

/**
 * Con el set en juego, cada lado tiene seis jugadores distintos, todos inscritos, sin líberos
 * colados como jugador normal y sin nadie que no pueda jugar salvo el que espera sustitución.
 * @param {object} match partido
 * @param {object} rules motor
 * @returns {true|string}
 */
function courtIsLegal(match, rules) {
    if (match.phase !== "live") {
        return true
    }
    const period = rules.currentPeriod(match)
    const findings = []
    for (const side of ["home", "away"]) {
        findings.push(courtSideFinding(match, period, side, rules))
    }
    if (!period.serving) {
        findings.push("nadie saca")
    }
    return firstFinding(findings)
}

/**
 * Revisa la pista de un lado.
 * @param {object} match partido
 * @param {object} period periodo en juego
 * @param {"home"|"away"} side lado
 * @param {object} rules motor
 * @returns {string|null}
 */
function courtSideFinding(match, period, side, rules) {
    const rotation = period.rotation[side]
    const libero = period.libero[side]
    const pending = period.mustReplace[side]
    if (new Set(rotation).size !== 6 || rotation.some((shirt) => !shirt)) {
        return "rotación con huecos o repetidos"
    }
    if (new Set(rules.onCourt(period, side)).size !== 6) {
        return "jugador repetido en pista"
    }
    for (const shirt of rotation) {
        const player = match.teams[side].players.find((entry) => entry.shirt === shirt)
        if (!player) {
            return "en pista alguien que no está en el acta (" + shirt + ")"
        }
        if (player.libero && !(libero && libero.shirt === shirt)) {
            return "líbero " + shirt + " en pista como jugador normal"
        }
        const waiting = pending.includes(shirt)
        if (match.disqualified[side].has(shirt) && !waiting) {
            return "descalificado " + shirt + " en pista"
        }
        if (period.expelled[side].has(shirt) && !waiting) {
            return "expulsado " + shirt + " en pista"
        }
        const coveredByLibero = libero !== null && libero.replacing === shirt
        if (match.outForMatch[side].has(shirt) && !waiting && !coveredByLibero) {
            return "jugador fuera del partido " + shirt + " en pista"
        }
    }
    return liberoFinding(period, side)
}

/**
 * El líbero en pista está en la zaga, no saca y ocupa el sitio del jugador al que sustituye.
 * @param {object} period periodo en juego
 * @param {"home"|"away"} side lado
 * @returns {string|null}
 */
function liberoFinding(period, side) {
    const libero = period.libero[side]
    if (!libero) {
        return null
    }
    if (!BACK_ZONES.includes(libero.zone)) {
        return "líbero en la delantera (zona " + (libero.zone + 1) + ")"
    }
    if (period.serving === side && libero.zone === 0) {
        return "el líbero saca"
    }
    if (period.rotation[side][libero.zone] !== libero.replacing) {
        return "el líbero no está en el sitio de su jugador"
    }
    return null
}

/**
 * El cuadro de resultados da los mismos sets ganados que el estado.
 * @param {object} match partido
 * @param {object} rules motor
 * @returns {true|string}
 */
function summaryAgrees(match, rules) {
    const summary = rules.summarize(match)
    const totals = summary.totals
    if (totals.home.won !== match.setsWon.home || totals.away.won !== match.setsWon.away) {
        return "resultados distintos de los sets ganados"
    }
    return true
}

/**
 * Lista de invariantes: nombre y comprobación. Cada comprobación recibe el partido y el motor y
 * devuelve true o el texto del fallo.
 * @type {ReadonlyArray<[string, (match: object, rules: object) => true|string]>}
 */
const INVARIANTS = Object.freeze(Object.entries({
    "sets dentro del límite": setsWithinLimit,
    "fase over coherente": overMeansDecided,
    "marcador igual al registro": scoreMatchesLog,
    "sets cerrados con el reglamento": periodsEndCorrectly,
    "topes de sustituciones y tiempos": quotasRespected,
    "cambio de campo en el decisivo": deciderSwitchDone,
    "pista legal": courtIsLegal,
    "resultados coherentes": summaryAgrees,
}))

/**
 * Pasa todas las invariantes y devuelve la primera que falla.
 * @param {object} match partido
 * @param {object} rules motor
 * @returns {{name: string, text: string}|null}
 */
export function firstBroken(match, rules) {
    for (const [name, verify] of INVARIANTS) {
        const outcome = verify(match, rules)
        if (outcome !== true) {
            return { name, text: outcome }
        }
    }
    return null
}
