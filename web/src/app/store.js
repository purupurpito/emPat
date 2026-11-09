/**
 * Almacén de actas y plantillas en el almacenamiento local del dispositivo.
 *
 * Claves: "empat/acta/<id>" para cada acta y "empat/plantilla/<nombre del equipo>" para la
 * última plantilla escrita de cada equipo. Las actas se guardan en JSON compacto.
 * @module src/app/store.js
 */

import { isValidShirt } from "../rules/index.js"
import { parseRecordFile } from "./record.js"

/**
 * Prefijo de las claves de acta.
 */
const RECORD_PREFIX = "empat/acta/"

/**
 * Prefijo de las claves de plantilla.
 */
const SQUAD_PREFIX = "empat/plantilla/"

/**
 * Lee y escribe actas y plantillas. Todo acceso al almacenamiento va protegido: un
 * almacenamiento lleno, bloqueado o con datos rotos no debe tumbar la interfaz.
 */
export class RecordStore {
    #storage

    /**
     * Usa el almacenamiento indicado; las pruebas pasan uno falso.
     * @param {Storage} [storage] almacenamiento
     */
    constructor(storage = globalThis.localStorage) {
        this.#storage = storage
    }

    /**
     * Genera un identificador corto para un acta nueva: el instante en base 36 y cuatro
     * caracteres al azar, suficiente para un solo dispositivo.
     * @returns {string}
     */
    newId() {
        const stamp = Date.now().toString(36)
        return stamp + Math.random().toString(36).slice(2, 6)
    }

    /**
     * Actas guardadas, saneadas y de la más reciente a la más antigua. Las entradas con JSON
     * ilegible se saltan; las que se leen pero el motor no sabe abrir sí salen, con el
     * identificador de su clave si no traen uno, para que la portada pueda ofrecer borrarlas.
     * @returns {object[]}
     */
    list() {
        const found = []
        for (const key of this.#keys()) {
            if (!key.startsWith(RECORD_PREFIX)) {
                continue
            }
            const stored = this.#readJson(key)
            if (stored === null || typeof stored !== "object") {
                continue
            }
            const record = Array.isArray(stored) ? {} : stored
            if (typeof record.id !== "string" || record.id === "") {
                record.id = key.slice(RECORD_PREFIX.length)
            }
            found.push(this.sanitize(record))
        }
        found.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        return found
    }

    /**
     * Carga un acta saneada.
     * @param {string} id identificador
     * @returns {object|null} null si no existe o no se puede leer
     */
    load(id) {
        const record = this.#readJson(RECORD_PREFIX + id)
        if (record === null || typeof record !== "object") {
            return null
        }
        return this.sanitize(record)
    }

    /**
     * Guarda el acta y actualiza su fecha de cambio. No avisa: decide quien llama.
     * @param {object} record acta
     * @returns {boolean} si se pudo guardar
     */
    save(record) {
        record.updatedAt = new Date().toISOString()
        return this.#write(RECORD_PREFIX + record.id, JSON.stringify(record))
    }

    /**
     * Borra un acta.
     * @param {string} id identificador
     */
    remove(id) {
        try {
            this.#storage.removeItem(RECORD_PREFIX + id)
        } catch {
            // Sin acceso al almacenamiento no hay nada que borrar.
        }
    }

    /**
     * Recuerda la plantilla de un equipo tal como se escribió, filas a medias incluidas, para
     * ofrecerla la próxima vez que juegue.
     * @param {string} teamName nombre del equipo
     * @param {{players: object[], staff: object[]}} squad filas
     */
    rememberTeam(teamName, { players, staff }) {
        this.#write(SQUAD_PREFIX + teamName, JSON.stringify({ players, staff }))
    }

    /**
     * Recupera la plantilla recordada de un equipo.
     * @param {string} teamName nombre del equipo
     * @returns {{players: object[], staff: object[]}|null}
     */
    recallTeam(teamName) {
        return this.#readJson(SQUAD_PREFIX + teamName)
    }

    /**
     * Aparta a record.setAside los jugadores con dorsal no válido mientras el partido no ha
     * empezado, para corregirlos en la pantalla de plantillas en lugar de que el motor rechace
     * el acta entera. Si aparta alguno, lleva el acta a ese paso y la guarda tal cual, sin
     * tocar su fecha de cambio. Un valor que no es un acta se devuelve sin tocar.
     * @param {object} record acta
     * @returns {object} la misma acta
     */
    sanitize(record) {
        if (!this.#setAsideInvalid(record)) {
            return record
        }
        record.stage = "rosters"
        this.#write(RECORD_PREFIX + record.id, JSON.stringify(record))
        return record
    }

    /**
     * Importa un acta desde texto: la lee, la sanea, comprueba que el motor sabe reconstruirla y
     * la guarda. Si su identificador ya está en uso recibe uno nuevo, para no pisar otra acta.
     * @param {string} text contenido del archivo
     * @param {{replay: Function}} rules motor
     * @returns {object} acta guardada
     * @throws {Error} si no es un acta o el motor la rechaza
     */
    importText(text, rules) {
        const record = parseRecordFile(text)
        this.#setAsideInvalid(record)
        rules.replay(record.settings, record.info, record.plays)
        if (!record.id || this.#read(RECORD_PREFIX + record.id) !== null) {
            record.id = this.newId()
        }
        this.save(record)
        return record
    }

    /**
     * Saca de las jugadas de plantilla los jugadores con dorsal no válido, si el partido no ha
     * empezado. El dorsal apartado se guarda como texto para poder enseñarlo.
     * @param {object} record acta
     * @returns {boolean} si se apartó alguno
     */
    #setAsideInvalid(record) {
        if (!record || !Array.isArray(record.plays)) {
            return false
        }
        if (record.plays.some((play) => play.kind === "startPeriod")) {
            return false
        }
        let moved = false
        record.plays = record.plays.map((play) => {
            if (play.kind !== "roster" || !Array.isArray(play.players)) {
                return play
            }
            const rejected = play.players.filter((player) => !isValidShirt(player.shirt))
            if (rejected.length === 0) {
                return play
            }
            moved = true
            record.setAside ??= {}
            record.setAside[play.side] ??= []
            for (const player of rejected) {
                record.setAside[play.side].push({ ...player, shirt: String(player.shirt ?? "") })
            }
            const kept = play.players.filter((player) => isValidShirt(player.shirt))
            return { ...play, players: kept }
        })
        return moved
    }

    /**
     * Claves presentes en el almacenamiento.
     * @returns {string[]}
     */
    #keys() {
        const keys = []
        try {
            for (let index = 0; index < this.#storage.length; index += 1) {
                keys.push(this.#storage.key(index))
            }
        } catch {
            return keys
        }
        return keys
    }

    /**
     * Texto guardado en una clave.
     * @param {string} key clave
     * @returns {string|null}
     */
    #read(key) {
        try {
            return this.#storage.getItem(key)
        } catch {
            return null
        }
    }

    /**
     * Valor JSON guardado en una clave; null si falta o está roto.
     * @param {string} key clave
     * @returns {any}
     */
    #readJson(key) {
        const text = this.#read(key)
        if (text === null) {
            return null
        }
        try {
            return JSON.parse(text)
        } catch {
            return null
        }
    }

    /**
     * Escribe un texto en una clave.
     * @param {string} key clave
     * @param {string} text valor
     * @returns {boolean} si se pudo escribir
     */
    #write(key, text) {
        try {
            this.#storage.setItem(key, text)
            return true
        } catch {
            return false
        }
    }
}
