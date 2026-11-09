/**
 * Cobertura del catálogo catalán: que cada texto castellano que la aplicación puede enseñar
 * tenga traducción y que traducir dos veces no cambie nada. No usa ninguna referencia externa:
 * lee las vistas, los mensajes del motor y la vigilancia de arranque del propio árbol.
 *
 * Las vistas se leen sin ejecutarlas: se toma el texto fijo de cada plantilla html`` y se
 * rellenan los huecos con una cifra. Es una aproximación; lo que no se ve así lo vigila la
 * comparación de pantallas.
 * @module tests/i18n/coverage.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const WEB = fileURLToPath(new URL("../../web/", import.meta.url))

const { LITERALS, PATTERNS, FRAGMENTS } = await import(
    pathToFileURL(join(WEB, "src/i18n/ca.js")).href
)
const { createTranslator } = await import(pathToFileURL(join(WEB, "src/i18n/translator.js")).href)
const { settle } = await import(pathToFileURL(join(WEB, "src/i18n/dom.js")).href)

const { t } = createTranslator({ LITERALS, PATTERNS, FRAGMENTS })

/** Relleno para los huecos de una plantilla o los parámetros de un mensaje. */
const FILLER = "7"

/**
 * Textos que, por decisión expresa, se enseñarían en castellano también con la interfaz en
 * catalán; la prueba no los contaría como olvidos. Está vacía: todo texto tiene traducción.
 * @type {RegExp[]}
 */
const KEPT_IN_SPANISH = []

/**
 * Palabras, siglas y abreviaturas que se escriben igual en los dos idiomas. Un texto formado
 * solo por ellas (más cifras y signos) no necesita entrada en el catálogo.
 */
const SAME_IN_BOTH = new Set([
    "C",
    "Ctrl",
    "de",
    "Golden",
    "Min",
    "min",
    "Nº",
    "Pista",
    "Pt",
    "S",
    "Set",
    "set",
    "Sets",
    "T",
    "TD",
    "Z",
])

/**
 * Indica si todas las palabras del texto se escriben igual en catalán.
 * @param {string} core texto sin espacios alrededor
 * @returns {boolean}
 */
function sameInBoth(core) {
    const words = core.match(/[\p{L}]+/gu) ?? []
    return words.every((word) => SAME_IN_BOTH.has(word))
}

/**
 * Un texto está cubierto si el traductor lo cambia, si figura tal cual en el catálogo (aunque
 * se quede igual) o si está en una de las listas de excepciones.
 * @param {string} text texto con los huecos ya rellenos
 * @returns {boolean}
 */
function isCovered(text) {
    const core = text.trim()
    if (core === "" || !/[a-záéíóúñ]/i.test(core)) {
        return true
    }
    if (t(text) !== text || LITERALS.has(core) || sameInBoth(core)) {
        return true
    }
    return KEPT_IN_SPANISH.some((rule) => rule.test(core))
}

/**
 * Recorre una plantilla literal desde su comilla de apertura y devuelve su texto fijo, con
 * cada hueco cambiado por el relleno. Respeta llaves y plantillas anidadas dentro de un hueco.
 * @param {string} source código
 * @param {number} start posición de la comilla invertida que abre
 * @returns {string}
 */
function templateText(source, start) {
    let text = ""
    let at = start + 1
    while (at < source.length && source[at] !== "`") {
        if (source[at] === "\\") {
            text += source[at + 1]
            at += 2
            continue
        }
        if (source.startsWith("${", at)) {
            at = skipHole(source, at + 2)
            text += FILLER
            continue
        }
        text += source[at]
        at += 1
    }
    return text
}

/**
 * Salta un hueco de plantilla y devuelve la posición siguiente a su llave de cierre.
 * @param {string} source código
 * @param {number} from posición justo después de "${"
 * @returns {number}
 */
function skipHole(source, from) {
    let depth = 1
    let at = from
    while (at < source.length && depth > 0) {
        const char = source[at]
        if (char === "`") {
            at = closingBacktick(source, at) + 1
            continue
        }
        if (char === "\"" || char === "'") {
            at = source.indexOf(char, at + 1) + 1
            continue
        }
        if (char === "{") {
            depth += 1
        }
        if (char === "}") {
            depth -= 1
        }
        at += 1
    }
    return at
}

/**
 * Posición de la comilla invertida que cierra la plantilla que empieza en start.
 * @param {string} source código
 * @param {number} start apertura
 * @returns {number}
 */
function closingBacktick(source, start) {
    let at = start + 1
    while (at < source.length && source[at] !== "`") {
        if (source[at] === "\\") {
            at += 2
            continue
        }
        if (source.startsWith("${", at)) {
            at = skipHole(source, at + 2)
            continue
        }
        at += 1
    }
    return at
}

/**
 * Textos visibles de un archivo de vista: nodos de texto y atributos traducibles de cada
 * plantilla html``.
 * @param {string} source código de la vista
 * @returns {string[]}
 */
function viewTexts(source) {
    const found = []
    let from = source.indexOf("html`")
    while (from >= 0) {
        const markup = templateText(source, from + 4)
        for (const tag of markup.matchAll(/<[^>]*>/g)) {
            for (const attr of tag[0].matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)) {
                found.push(attr[1])
            }
        }
        for (const piece of markup.split(/<[^>]*>/)) {
            found.push(piece)
        }
        from = source.indexOf("html`", from + 5)
    }
    return found.filter((text) => text.trim() !== "")
}

/**
 * Archivos de vista, incluidos los de diálogos.
 * @param {string} dir carpeta
 * @returns {string[]}
 */
function viewFiles(dir) {
    if (!existsSync(dir)) {
        return []
    }
    const files = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...viewFiles(full))
            continue
        }
        if (entry.name.endsWith(".view.js")) {
            files.push(full)
        }
    }
    return files
}

/**
 * Todos los textos que puede producir el catálogo de mensajes del motor, con los parámetros
 * rellenos.
 * @param {object} catalog TEXT
 * @returns {string[]}
 */
function messageTexts(catalog) {
    const texts = []
    for (const entry of Object.values(catalog)) {
        if (typeof entry === "string") {
            texts.push(entry)
            continue
        }
        if (typeof entry === "function") {
            const args = Array.from({ length: Math.max(entry.length, 3) }, () => FILLER)
            texts.push(String(entry(...args)))
        }
    }
    return texts
}

/**
 * Literales de cadena de un script clásico, sin interpretar escapes salvo la comilla.
 * @param {string} source código
 * @returns {string[]}
 */
function stringLiterals(source) {
    const found = []
    for (const match of source.matchAll(/"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'/g)) {
        found.push((match[1] ?? match[2]).replace(/\\(["'])/g, "$1"))
    }
    return found
}

describe("Catálogo catalán", () => {
    it("tiene las tres tablas cargadas", () => {
        assert.ok(LITERALS.size > 0)
        assert.ok(PATTERNS.length > 0)
        assert.ok(FRAGMENTS.length > 0)
    })

    it("guarda los trozos de más largo a más corto", () => {
        const lengths = FRAGMENTS.map(([from]) => from.length)
        const sorted = [...lengths].sort((a, b) => b - a)
        assert.deepEqual(lengths, sorted)
    })

    it("no repite trozos ni guarda los que se quedan igual", () => {
        const seen = new Set()
        for (const [from, to] of FRAGMENTS) {
            assert.notEqual(from, to, from)
            assert.ok(!seen.has(from), from)
            seen.add(from)
        }
    })

    it("no deja espacios sobrantes en las claves", () => {
        for (const key of LITERALS.keys()) {
            assert.equal(key, key.trim())
        }
    })
})

describe("Idempotencia", () => {
    it("traducir dos veces una frase completa da lo mismo que una", () => {
        for (const key of LITERALS.keys()) {
            const once = t(key)
            assert.equal(t(once), once, key)
        }
    })

    it("el punto fijo de cada texto del catálogo es estable", () => {
        const samples = [...LITERALS.keys(), ...LITERALS.values()]
        for (const [from, to] of FRAGMENTS) {
            samples.push(from, to)
        }
        for (const text of samples) {
            const fixed = settle(text, t)
            assert.equal(t(fixed), fixed, text)
        }
    })

    it("lo que no tiene letras o no es texto pasa sin tocar", () => {
        for (const value of ["", "   ", "12", "3:05", "7-5", "·", null, undefined, 7]) {
            assert.equal(t(value), value)
        }
    })
})

describe("Cobertura de los textos de la aplicación", () => {
    it("cada mensaje del motor tiene traducción", async () => {
        const { TEXT } = await import(pathToFileURL(join(WEB, "src/rules/messages.js")).href)
        const missing = messageTexts(TEXT).filter((text) => !isCovered(text))
        assert.deepEqual(missing, [])
    })

    it("cada texto fijo de las vistas tiene traducción", () => {
        const missing = []
        for (const file of viewFiles(join(WEB, "src/app/views"))) {
            for (const text of viewTexts(readFileSync(file, "utf8"))) {
                if (!isCovered(text)) {
                    missing.push(text.trim())
                }
            }
        }
        assert.deepEqual(missing, [])
    })

    it("la vigilancia de arranque lleva el catalán que da el catálogo", () => {
        const literals = stringLiterals(readFileSync(join(WEB, "boot-guard.js"), "utf8"))
        const present = new Set(literals)
        const wrong = []
        for (const text of literals) {
            const translated = t(text)
            if (translated !== text && !present.has(translated)) {
                wrong.push(text)
            }
        }
        assert.deepEqual(wrong, [])
    })
})
