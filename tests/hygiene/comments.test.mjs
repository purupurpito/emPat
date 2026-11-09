/**
 * Higiene de comentarios. Extrae todos los comentarios de web/ y tests/ y comprueba que no
 * llevan años sueltos, salvo las citas normativas permitidas.
 * @module tests/hygiene/comments.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { extname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../../", import.meta.url))
const SCANNED_DIRS = ["web", "tests"]
const SCANNED_TYPES = new Set([".js", ".mjs", ".css", ".html"])

/** Citas normativas que pueden llevar años en su nombre; se quitan del texto revisado. */
const ALLOWED_CITATIONS = ["Normativa FIVB 2025-2028"]

const FORBIDDEN = {
    "años": /\b(19|20)\d\d\b/,
}

/** Palabras tras las que una barra abre una expresión regular y no una división. */
const REGEX_KEYWORDS = new Set([
    "return",
    "typeof",
    "case",
    "do",
    "else",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "throw",
    "yield",
    "await",
])

/**
 * Lista recursiva de archivos revisables bajo una carpeta.
 * @param {string} dir carpeta absoluta
 * @returns {string[]}
 */
function listFiles(dir) {
    const found = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            found.push(...listFiles(full))
            continue
        }
        if (SCANNED_TYPES.has(extname(entry.name))) {
            found.push(full)
        }
    }
    return found
}

/**
 * Decide si una barra en la posición dada empieza una expresión regular, mirando lo que hay
 * detrás: un operador, un paréntesis abierto o una palabra clave la anuncian.
 * @param {string} src código
 * @param {number} at posición de la barra
 * @returns {boolean}
 */
function slashOpensRegex(src, at) {
    let back = at - 1
    while (back >= 0 && /\s/.test(src[back])) {
        back -= 1
    }
    if (back < 0) {
        return true
    }
    const prev = src[back]
    if ("(,=:[!&|?{};+-*%<>~^".includes(prev)) {
        return true
    }
    const word = /[A-Za-z_$]+$/.exec(src.slice(Math.max(0, back - 10), back + 1))
    return word !== null && REGEX_KEYWORDS.has(word[0])
}

/**
 * Salta una cadena entre comillas simples o dobles.
 * @param {string} src código
 * @param {number} at posición de la comilla de apertura
 * @returns {number} posición tras la comilla de cierre
 */
function skipQuoted(src, at) {
    const quote = src[at]
    let pos = at + 1
    while (pos < src.length && src[pos] !== quote && src[pos] !== "\n") {
        pos += src[pos] === "\\" ? 2 : 1
    }
    return pos + 1
}

/**
 * Salta una expresión regular literal, con sus clases de caracteres y sus banderas.
 * @param {string} src código
 * @param {number} at posición de la barra de apertura
 * @returns {number} posición tras las banderas
 */
function skipRegex(src, at) {
    let pos = at + 1
    let inClass = false
    while (pos < src.length && src[pos] !== "\n") {
        const char = src[pos]
        if (char === "\\") {
            pos += 2
            continue
        }
        if (char === "[") {
            inClass = true
        } else if (char === "]") {
            inClass = false
        } else if (char === "/" && !inClass) {
            break
        }
        pos += 1
    }
    pos += 1
    while (pos < src.length && /[a-z]/i.test(src[pos])) {
        pos += 1
    }
    return pos
}

/**
 * Extrae los comentarios de código JavaScript. Distingue cadenas, plantillas con huecos
 * anidados y expresiones regulares para no confundir su contenido con un comentario.
 * @param {string} src código
 * @returns {string[]}
 */
export function jsComments(src) {
    const comments = []
    const holes = []
    let pos = 0
    let inTemplate = false
    while (pos < src.length) {
        const char = src[pos]
        const pair = src.slice(pos, pos + 2)
        if (inTemplate) {
            if (char === "\\") {
                pos += 2
            } else if (char === "`") {
                inTemplate = false
                pos += 1
            } else if (pair === "${") {
                holes.push(0)
                inTemplate = false
                pos += 2
            } else {
                pos += 1
            }
            continue
        }
        if (pair === "//") {
            const end = src.indexOf("\n", pos)
            const stop = end === -1 ? src.length : end
            comments.push(src.slice(pos + 2, stop))
            pos = stop
        } else if (pair === "/*") {
            const end = src.indexOf("*/", pos + 2)
            const stop = end === -1 ? src.length : end
            comments.push(src.slice(pos + 2, stop))
            pos = stop + 2
        } else if (char === "\"" || char === "'") {
            pos = skipQuoted(src, pos)
        } else if (char === "`") {
            inTemplate = true
            pos += 1
        } else if (char === "/" && slashOpensRegex(src, pos)) {
            pos = skipRegex(src, pos)
        } else if (char === "{" && holes.length > 0) {
            holes[holes.length - 1] += 1
            pos += 1
        } else if (char === "}" && holes.length > 0) {
            if (holes[holes.length - 1] === 0) {
                holes.pop()
                inTemplate = true
            } else {
                holes[holes.length - 1] -= 1
            }
            pos += 1
        } else {
            pos += 1
        }
    }
    return comments
}

/**
 * Extrae los comentarios de una hoja de estilos, saltando las cadenas.
 * @param {string} src hoja de estilos
 * @returns {string[]}
 */
export function cssComments(src) {
    const comments = []
    let pos = 0
    while (pos < src.length) {
        const char = src[pos]
        if (src.startsWith("/*", pos)) {
            const end = src.indexOf("*/", pos + 2)
            const stop = end === -1 ? src.length : end
            comments.push(src.slice(pos + 2, stop))
            pos = stop + 2
        } else if (char === "\"" || char === "'") {
            pos = skipQuoted(src, pos)
        } else {
            pos += 1
        }
    }
    return comments
}

/**
 * Extrae los comentarios de un documento HTML, incluidos los de sus scripts y estilos en línea.
 * @param {string} src documento
 * @returns {string[]}
 */
export function htmlComments(src) {
    const comments = []
    for (const found of src.matchAll(/<!--([\s\S]*?)-->/g)) {
        comments.push(found[1])
    }
    for (const found of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        comments.push(...jsComments(found[1]))
    }
    for (const found of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
        comments.push(...cssComments(found[1]))
    }
    return comments
}

/**
 * Comentarios de un archivo según su tipo.
 * @param {string} file ruta absoluta
 * @returns {string[]}
 */
function commentsOf(file) {
    const src = readFileSync(file, "utf8")
    const type = extname(file)
    if (type === ".css") {
        return cssComments(src)
    }
    if (type === ".html") {
        return htmlComments(src)
    }
    return jsComments(src)
}

/**
 * Quita del comentario las citas normativas permitidas.
 * @param {string} comment texto del comentario
 * @returns {string}
 */
function withoutCitations(comment) {
    let text = comment
    for (const citation of ALLOWED_CITATIONS) {
        text = text.split(citation).join(" ")
    }
    return text
}

/**
 * Recorre los archivos y devuelve las apariciones de un patrón prohibido.
 * @param {RegExp} pattern patrón
 * @returns {string[]} "ruta: comentario" de cada aparición
 */
function offenders(pattern) {
    const hits = []
    for (const dir of SCANNED_DIRS) {
        for (const file of listFiles(join(ROOT, dir))) {
            for (const comment of commentsOf(file)) {
                if (pattern.test(withoutCitations(comment))) {
                    const where = relative(ROOT, file).replace(/\\/g, "/")
                    hits.push(where + ": " + comment.trim().slice(0, 120))
                }
            }
        }
    }
    return hits
}

describe("higiene de comentarios", function () {
    it("el extractor ignora cadenas, plantillas y expresiones regulares", function () {
        const sample = [
            "const a = \"// no\"",
            "const b = /\\/\\/ tampoco/g",
            "const c = `${d /* dentro */} // fuera de comentario`",
            "// sí",
        ].join("\n")
        assert.deepEqual(jsComments(sample).map((text) => text.trim()), ["dentro", "sí"])
    })

    for (const [label, pattern] of Object.entries(FORBIDDEN)) {
        it("ningún comentario contiene " + label, function () {
            assert.deepEqual(offenders(pattern), [])
        })
    }
})
