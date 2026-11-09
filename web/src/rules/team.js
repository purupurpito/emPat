/**
 * Plantilla de un equipo dentro del estado del partido: nombre, jugadores y cuerpo técnico.
 * @module src/rules/team.js
 */

import { normalizeShirt } from "./shirts.js"

/**
 * Equipo inscrito. Guarda copias propias de los jugadores porque algunas jugadas (como la
 * redesignación de líbero) modifican el jugador del estado, y la jugada original pertenece al
 * acta guardada. Solo tiene tres propiedades públicas: name, players y staff.
 */
export class Team {
    /**
     * Crea un equipo con los datos ya preparados; no copia ni valida nada.
     * @param {string} name nombre visible
     * @param {object[]} players jugadores {shirt, name, captain, libero, category}
     * @param {object[]} staff cuerpo técnico {role, name}
     */
    constructor(name, players, staff) {
        this.name = name
        this.players = players
        this.staff = staff
    }

    /**
     * Crea el equipo desde una jugada roster, copiando jugadores con el dorsal normalizado y el
     * cuerpo técnico. Si la jugada no trae nombre se conserva el que ya se conocía.
     * @param {object} play jugada roster ya validada
     * @param {string} previousName nombre conocido
     * @returns {Team}
     */
    static fromPlay(play, previousName) {
        const name = play.name || previousName
        const players = play.players.map((player) => copyPlayer(player))
        const staff = (play.staff || []).map((member) => ({ ...member }))
        return new Team(name, players, staff)
    }

    /**
     * Busca un jugador por dorsal ya normalizado. La comparación es estricta: "0" y "00" son
     * jugadores distintos.
     * @param {string} shirt dorsal
     * @returns {object|undefined}
     */
    find(shirt) {
        return this.players.find((player) => player.shirt === shirt)
    }

    /**
     * Devuelve el capitán del equipo, o null si nadie lleva la marca.
     * @returns {object|null}
     */
    captain() {
        return this.players.find((player) => player.captain) || null
    }

    /**
     * Lista los jugadores marcados como líbero, incluidos los redesignados.
     * @returns {object[]}
     */
    liberos() {
        return this.players.filter((player) => player.libero)
    }
}

/**
 * Copia superficial de un jugador con el dorsal en forma canónica.
 * @param {object} player jugador tal como llega en la jugada
 * @returns {object}
 */
function copyPlayer(player) {
    return { ...player, shirt: normalizeShirt(player.shirt) }
}
