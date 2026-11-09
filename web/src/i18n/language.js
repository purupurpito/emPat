/**
 * Idioma activo de la interfaz y su selector.
 * @module src/i18n/language.js
 */

import { LITERALS, PATTERNS, FRAGMENTS } from "./ca.js"
import { createTranslator } from "./translator.js"
import { watchTree } from "./dom.js"

/** Clave de almacenamiento con el idioma elegido a mano. */
export const LANGUAGE_KEY = "empat/lengua"

/** Botones del selector, en el orden en que se ven. */
const SWITCH_OPTIONS = [
    ["es", "ES"],
    ["ca", "CA"],
]

/** Traductor al catalán, creado la primera vez que hace falta. */
let catalan = null

/**
 * Devuelve el traductor al catalán, creándolo si aún no existe.
 * @returns {(text: unknown) => unknown}
 */
function catalanT() {
    if (catalan === null) {
        catalan = createTranslator({ LITERALS, PATTERNS, FRAGMENTS }).t
    }
    return catalan
}

/**
 * Identidad: así se "traduce" cuando la interfaz no está en catalán.
 * @param {unknown} text cualquier valor
 * @returns {unknown} el mismo valor
 */
function untouched(text) {
    return text
}

/**
 * Idioma activo y su función de traducción. Mientras no se arranca, el idioma es castellano y t
 * devuelve el texto sin tocar.
 */
export const i18n = {
    language: "es",
    t: untouched,
}

/**
 * Idioma elegido por el usuario o, si no hay, el del navegador.
 *
 * Lo guardado se respeta tal cual aunque no sea "es" ni "ca": en ese caso no se traduce nada
 * pero el documento lleva ese código. Si el almacenamiento no se puede leer, castellano, sin
 * mirar el navegador.
 * @returns {string} normalmente "es" o "ca"
 */
export function pickLanguage() {
    try {
        const stored = globalThis.localStorage.getItem(LANGUAGE_KEY)
        if (stored) {
            return stored
        }
        const browser = (globalThis.navigator?.language || "").toLowerCase()
        if (browser.startsWith("ca")) {
            return "ca"
        }
        return "es"
    } catch {
        return "es"
    }
}

/**
 * Fija el idioma del documento, monta el selector y, en catalán, empieza a traducir el cuerpo.
 * Deja i18n preparado para que el resto de módulos traduzcan los textos que no pasan por el
 * DOM (avisos, confirmaciones).
 * @param {Document} [doc] documento
 * @returns {string} el idioma activo
 */
export function startLanguage(doc = document) {
    const language = pickLanguage()
    i18n.language = language
    if (language === "ca") {
        i18n.t = catalanT()
    } else {
        i18n.t = untouched
    }
    doc.documentElement.lang = language
    if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", () => mountSwitch(doc), { once: true })
    } else {
        mountSwitch(doc)
    }
    if (language === "ca") {
        watchTree(doc.body ?? doc.documentElement, i18n.t)
    }
    return language
}

/**
 * Guarda el idioma y recarga la página. Si no se puede guardar, recarga igualmente.
 * @param {string} code idioma
 */
function setLanguage(code) {
    try {
        globalThis.localStorage.setItem(LANGUAGE_KEY, code)
    } catch {
        // Sin almacenamiento la recarga vuelve al idioma del navegador; no hay más que hacer.
    }
    globalThis.location.reload()
}

/**
 * Pone el selector de idioma en la cabecera. Sale también en castellano, para poder pasar al
 * catalán. No hace nada si no hay cabecera o si ya está puesto.
 * @param {Document} doc documento
 * @returns {HTMLElement|null} el selector nuevo, o null si no se ha puesto
 */
function mountSwitch(doc) {
    const header = doc.querySelector(".topbar-inner")
    if (header === null || header.querySelector(".lang-switch") !== null) {
        return null
    }
    const group = doc.createElement("div")
    group.className = "lang-switch"
    group.setAttribute("role", "group")
    group.setAttribute("aria-label", "Idioma")
    group.setAttribute("data-keep-text", "")
    for (const [code, label] of SWITCH_OPTIONS) {
        const button = doc.createElement("button")
        button.setAttribute("type", "button")
        button.setAttribute("data-lang", code)
        button.textContent = label
        button.setAttribute("aria-pressed", String(code === i18n.language))
        button.addEventListener("click", () => setLanguage(code))
        group.append(button)
    }
    header.append(group)
    return group
}
