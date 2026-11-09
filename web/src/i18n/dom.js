/**
 * Traducción en vivo del DOM: recorre el árbol y vigila los cambios.
 * @module src/i18n/dom.js
 */

/** Vueltas máximas de traducción sobre un mismo nodo de texto. */
const MAX_ROUNDS = 8

const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * Aplica t una y otra vez hasta que el texto deja de cambiar, con un tope de vueltas.
 * Un nodo de texto recién traducido vuelve a pasar por el traductor cuando cambia, así que lo
 * que se ve al final es este punto fijo y no una sola pasada.
 * @param {string} text texto de partida
 * @param {(text: string) => string} t traductor
 * @returns {string}
 */
export function settle(text, t) {
    let current = text
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const next = t(current)
        if (next === current) {
            break
        }
        current = next
    }
    return current
}

/**
 * Del selector de exclusión se queda con las partes que son atributos. Un elemento solo se
 * salta entero por estar marcado; script, style o textarea solo protegen su texto, y sus
 * atributos (por ejemplo, el placeholder de un textarea) sí se traducen.
 * @param {string} skip selector completo
 * @returns {string} selector de atributos, o "" si no hay ninguno
 */
function markerPart(skip) {
    const markers = []
    for (const part of skip.split(",")) {
        const clean = part.trim()
        if (clean.startsWith("[")) {
            markers.push(clean)
        }
    }
    return markers.join(", ")
}

/**
 * Traduce los nodos de texto y algunos atributos de un árbol y sigue traduciendo lo que se
 * inserte después. Cada nodo de texto se traduce hasta que deja de cambiar; los atributos, una
 * sola vez y solo cuando el elemento entra en el árbol (no se vigilan sus cambios).
 *
 * Si el documento aún se está analizando, espera a DOMContentLoaded para empezar.
 * No toca nada fuera de root, así que la cabecera del documento y su título quedan igual.
 * @param {Node} root raíz
 * @param {(text: string) => string} t traductor
 * @param {{skip?: string, attrs?: string[]}} [options] qué saltar y qué atributos tocar
 * @returns {MutationObserver|null} el observador, o null si no hay MutationObserver
 */
export function watchTree(
    root,
    t,
    {
        skip = "script, style, textarea, [data-keep-text]",
        attrs = ["placeholder", "title", "aria-label"],
    } = {},
) {
    const marked = markerPart(skip)
    const finished = new WeakSet()

    function visitText(node) {
        const parent = node.parentElement
        if (parent === null || parent.closest(skip) !== null) {
            return
        }
        if (finished.has(node)) {
            return
        }
        const translated = settle(node.nodeValue, t)
        if (translated !== node.nodeValue) {
            node.nodeValue = translated
        }
        finished.add(node)
    }

    function visitElement(element) {
        if (marked !== "" && element.closest(marked) !== null) {
            return
        }
        for (const name of attrs) {
            const value = element.getAttribute(name)
            if (!value) {
                continue
            }
            const translated = t(value)
            if (translated !== value) {
                element.setAttribute(name, translated)
            }
        }
        for (const child of element.childNodes) {
            visit(child)
        }
    }

    function visit(node) {
        if (!node) {
            return
        }
        if (node.nodeType === TEXT_NODE) {
            visitText(node)
            return
        }
        if (node.nodeType === ELEMENT_NODE) {
            visitElement(node)
        }
    }

    function onMutations(records) {
        for (const record of records) {
            if (record.type === "characterData") {
                // El texto ha cambiado: la traducción hecha se descarta y se repite.
                finished.delete(record.target)
                visit(record.target)
                continue
            }
            for (const added of record.addedNodes) {
                visit(added)
            }
        }
    }

    const view = root.ownerDocument?.defaultView ?? globalThis
    if (typeof view.MutationObserver !== "function") {
        visit(root)
        return null
    }
    const observer = new view.MutationObserver(onMutations)

    function begin() {
        visit(root)
        observer.observe(root, { childList: true, subtree: true, characterData: true })
    }

    const doc = root.ownerDocument
    if (doc && doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", begin, { once: true })
    } else {
        begin()
    }
    return observer
}
