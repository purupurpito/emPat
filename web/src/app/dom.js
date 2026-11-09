/**
 * Utilidades mínimas de DOM y una etiqueta de plantilla que escapa por defecto. Las vistas
 * construyen marcado con html`…`: todo lo interpolado se escapa salvo lo que ya es marcado de
 * confianza, de modo que olvidar un escape no abre un agujero.
 * @module src/app/dom.js
 */

/**
 * Busca un elemento por su id en el documento actual.
 * @param {string} id identificador sin almohadilla
 * @returns {HTMLElement|null}
 */
export function byId(id) {
    return document.getElementById(id)
}

/**
 * Entidad que sustituye a un carácter peligroso dentro de HTML.
 * @param {string} char uno de los cinco caracteres especiales
 * @returns {string}
 */
function entityFor(char) {
    switch (char) {
        case "&":
            return "&amp;"
        case "<":
            return "&lt;"
        case ">":
            return "&gt;"
        case "\"":
            return "&quot;"
        default:
            return "&#39;"
    }
}

/**
 * Escapa un valor para insertarlo en texto o en un atributo entre comillas. null y undefined
 * dan cadena vacía; cualquier otro valor se convierte con String. También escapa el apóstrofo,
 * porque algunos atributos podrían ir entre comillas simples.
 * @param {unknown} value valor a escapar
 * @returns {string}
 */
export function escapeHtml(value) {
    const text = String(value ?? "")
    return text.replace(/[<>&'"]/g, entityFor)
}

/**
 * Marcado ya seguro. Envuelve una cadena para que html`…` la inserte sin escapar. Se convierte
 * en texto con String() o al asignarlo a innerHTML.
 */
export class Markup {
    #text

    /**
     * @param {string} text marcado de confianza
     */
    constructor(text) {
        this.#text = text
    }

    /**
     * @returns {string} el marcado tal cual
     */
    toString() {
        return this.#text
    }
}

/**
 * Marca un texto como HTML de confianza. Solo debe usarse con marcado generado por el propio
 * código, nunca con datos escritos por el usuario.
 * @param {string} text marcado
 * @returns {Markup}
 */
export function raw(text) {
    return new Markup(String(text))
}

/**
 * Convierte un valor interpolado en marcado. Las listas se concatenan sin separador, que es lo
 * que necesita un map() de filas; null, undefined y false no producen nada, para poder escribir
 * condiciones cortas; el marcado de confianza pasa tal cual y lo demás se escapa.
 * @param {unknown} value valor interpolado
 * @returns {string}
 */
function interpolate(value) {
    if (value instanceof Markup) {
        return value.toString()
    }
    if (Array.isArray(value)) {
        let joined = ""
        for (const item of value) {
            joined += interpolate(item)
        }
        return joined
    }
    if (value === null || value === undefined || value === false) {
        return ""
    }
    return escapeHtml(value)
}

/**
 * Etiqueta de plantilla para escribir vistas. Junta las partes literales tal cual y escapa cada
 * interpolación según interpolate. Devuelve Markup para que una vista pueda anidarse dentro de
 * otra sin escaparse dos veces.
 * @param {TemplateStringsArray} strings partes literales de la plantilla
 * @param {...unknown} values valores interpolados
 * @returns {Markup}
 */
export function html(strings, ...values) {
    let out = strings[0]
    for (let index = 0; index < values.length; index += 1) {
        out += interpolate(values[index]) + strings[index + 1]
    }
    return new Markup(out)
}

/**
 * Selector que vuelve a encontrar el elemento con el foco después de rehacer el marcado de un
 * contenedor: su id o, si no tiene, todos sus atributos data-. Null si el foco no está dentro
 * del contenedor o el elemento no se puede volver a localizar.
 * @param {HTMLElement} root contenedor que se va a rehacer
 * @returns {string|null}
 */
export function focusKey(root) {
    const active = document.activeElement
    if (!(active instanceof Element) || active === root || !root.contains(active)) {
        return null
    }
    const quote = (text) => (globalThis.CSS?.escape ? CSS.escape(text) : text)
    if (active.id) {
        return "#" + quote(active.id)
    }
    let selector = ""
    for (const attr of active.attributes) {
        if (attr.name.startsWith("data-")) {
            selector += `[${attr.name}="${quote(attr.value)}"]`
        }
    }
    return selector === "" ? null : selector
}

/**
 * Devuelve el foco al elemento que encaja con el selector de focusKey, si sigue existiendo.
 * @param {HTMLElement} root contenedor ya rehecho
 * @param {string|null} key selector
 */
export function restoreFocus(root, key) {
    if (key === null) {
        return
    }
    root.querySelector(key)?.focus({ preventScroll: true })
}
