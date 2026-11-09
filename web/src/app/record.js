/**
 * Formato del acta guardada y exportada: creación, serialización y lectura con validación.
 *
 * Un acta es { format, version, id, createdAt, updatedAt, stage, settings, info, plays } y,
 * cuando hace falta, demo, setAside, amendments y sealed. El estado del partido nunca se guarda:
 * se reconstruye con el motor a partir de plays.
 * @module src/app/record.js
 */

import { DEFAULT_SETTINGS } from "../rules/index.js"
import { UI_TEXT } from "./constants.js"

/**
 * Marca de formato que identifica un archivo de acta.
 */
const FORMAT_TAG = "empat/acta"

/**
 * Versión del formato; cualquier otra se rechaza.
 */
const FORMAT_VERSION = 1

/**
 * Indica si los datos corresponden a un partido de formato infantil, que se juega sin líbero y
 * con set obligatorio por jugador. Se decide por el texto de competición y categoría.
 * @param {object} info datos del encuentro
 * @returns {boolean}
 */
export function isKidsFormat(info) {
    const label = `${info.competition || ""} ${info.category || ""}`
    return /INFANTIL/i.test(label)
}

/**
 * Ajustes iniciales para unos datos: los de serie y, en infantil, sin líbero y con set
 * obligatorio. Luego se pueden cambiar en la pantalla de datos.
 * @param {object} info datos del encuentro
 * @returns {object}
 */
export function initialSettings(info) {
    if (isKidsFormat(info)) {
        return { ...DEFAULT_SETTINGS, liberoAllowed: false, fullSetRule: true }
    }
    return { ...DEFAULT_SETTINGS }
}

/**
 * Crea un acta vacía en el paso de datos. La fecha de cambio la pone el almacén al guardar.
 * @param {object} info datos del encuentro
 * @param {object} settings ajustes
 * @param {string} id identificador
 * @returns {object} acta
 */
export function createRecord(info, settings, id) {
    return {
        format: FORMAT_TAG,
        version: FORMAT_VERSION,
        id,
        createdAt: new Date().toISOString(),
        stage: "details",
        settings,
        info,
        plays: [],
    }
}

/**
 * Convierte el acta en el texto que se exporta: JSON con un espacio de sangría, legible a mano
 * y aún compacto.
 * @param {object} record acta
 * @returns {string}
 */
export function serializeRecord(record) {
    return JSON.stringify(record, null, 1)
}

/**
 * Comprueba la forma mínima de un acta ya analizada.
 * @param {unknown} data valor leído
 * @returns {boolean}
 */
function looksLikeRecord(data) {
    if (data === null || typeof data !== "object") {
        return false
    }
    if (data.format !== FORMAT_TAG || data.version !== FORMAT_VERSION) {
        return false
    }
    if (!Array.isArray(data.plays)) {
        return false
    }
    return data.info !== null && typeof data.info === "object"
}

/**
 * Lee un acta desde texto y comprueba su forma básica. No reproduce las jugadas: eso lo hace
 * quien importa, con el motor. Cualquier problema da el mismo error, porque al usuario solo le
 * sirve saber que el archivo no vale.
 * @param {string} text contenido
 * @returns {object} acta
 * @throws {Error} "no es un acta" si el texto no es un acta de este formato
 */
export function parseRecordFile(text) {
    let data
    try {
        data = JSON.parse(text)
    } catch {
        throw new Error(UI_TEXT.notRecord)
    }
    if (!looksLikeRecord(data)) {
        throw new Error(UI_TEXT.notRecord)
    }
    return data
}
