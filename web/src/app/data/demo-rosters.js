/**
 * Plantillas de muestra para el partido de prueba. Los nombres son inventados.
 * @module src/app/data/demo-rosters.js
 */

/**
 * Tabla de los dos equipos de prueba. Cada bloque empieza con "lado | nombre del equipo"; siguen
 * los jugadores ("dorsal nombre", con [c] para el capitán y [l] para el líbero) y el cuerpo
 * técnico ("rol: nombre").
 */
const SQUADS = `
home | Equipo Azul
    2 Adrià Lozano Ferrer
    4 Marc Esteve Sanz
    6 Joel Navarro Ibáñez
    9 Àlex Cortés Valls
    11 Guillem Roca Pastor [c]
    13 Iker Mena Soto
    14 Pere Albà Quintana
    16 Unai Ribas Duran
    18 Nico Ferrando Gual
    19 Siscu Bonet Arnau
    20 Txema Ruiz Llop [l]
    23 Hèctor Vilar Mas
    coach: Sílvia Ortega Bru
    assistant: Ramon Gual Pérez
away | Equipo Blanco
    1 Eloi Martí Cano
    3 Raül Prieto Sala [l]
    5 Isaac Fuster Pou
    7 Andreu Blasco Mir [c]
    8 Ivan Peris Vidal
    10 Bernat Soria Coll
    12 Lucas Grau Benet [l]
    15 Tomàs Igual Rovira
    17 Oscar Jordà Font
    21 Pau Cid Moreno
    22 Gerard Lluch Rey
    24 Mateu Sáez Pons
    coach: Mireia Tur Calvo
    assistant: Jordi Sabaté Ros`

/**
 * Jugador de una línea "dorsal nombre [marcas]". Las marcas solo aparecen si están.
 * @param {string} line línea sin sangría
 * @returns {{shirt: string, name: string, captain?: true, libero?: true}}
 */
function parsePlayer(line) {
    const marks = line.match(/\[[cl]\]/g) ?? []
    const plain = line.replace(/\s*\[[cl]\]/g, "")
    const gap = plain.indexOf(" ")
    const player = { shirt: plain.slice(0, gap), name: plain.slice(gap + 1) }
    if (marks.includes("[c]")) {
        player.captain = true
    }
    if (marks.includes("[l]")) {
        player.libero = true
    }
    return player
}

/**
 * Analiza la tabla de equipos.
 * @param {string} text tabla
 * @returns {Record<string, {name: string, players: object[], staff: object[]}>}
 */
function parseSquads(text) {
    const squads = {}
    let current = null
    for (const raw of text.split("\n")) {
        const line = raw.trim()
        if (line === "") {
            continue
        }
        if (line.includes(" | ")) {
            const [side, name] = line.split(" | ")
            current = { name, players: [], staff: [] }
            squads[side] = current
        } else if (line.includes(": ")) {
            const [role, name] = line.split(": ")
            current.staff.push({ role, name })
        } else {
            current.players.push(parsePlayer(line))
        }
    }
    return squads
}

/**
 * Jugadores y cuerpo técnico de los dos equipos de prueba, por lado.
 * @type {Readonly<Record<"home"|"away", {name: string, players: object[], staff: object[]}>>}
 */
export const DEMO_ROSTERS = Object.freeze(parseSquads(SQUADS))
