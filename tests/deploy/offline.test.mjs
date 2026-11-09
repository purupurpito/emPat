/**
 * Despliegue sin conexión. La aplicación solo abre sin red si el service worker guardó todo lo
 * que la página llega a pedir, y solo se instala si todo lo que pide guardar existe. Aquí se
 * comprueba la lista de sw.js contra el disco, contra lo que enlaza index.html, contra los
 * import de src/ y contra las url() de las hojas de estilo, además del manifiesto.
 * @module tests/deploy/offline.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, posix, relative } from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

/** Carpeta web/ en disco. */
const WEB = fileURLToPath(new URL("../../web/", import.meta.url))

/**
 * Ejecuta sw.js en un contexto aislado con un `module` falso, igual que lo haría require, sin
 * depender de cómo interprete Node la extensión .js en esta carpeta.
 * @returns {{CACHE_NAME: string, PRECACHE: string[]}}
 */
function loadWorker() {
    const sandbox = { module: { exports: {} } }
    vm.runInNewContext(readFileSync(join(WEB, "sw.js"), "utf8"), sandbox, { filename: "sw.js" })
    const { CACHE_NAME, PRECACHE } = sandbox.module.exports
    // El array nace en otro contexto; se copia para que las comparaciones estrictas no
    // tropiecen con un prototipo distinto.
    return { CACHE_NAME, PRECACHE: Array.from(PRECACHE) }
}

/**
 * Todos los archivos bajo una carpeta, como rutas relativas a web/ con barras normales.
 * @param {string} dir carpeta absoluta
 * @returns {string[]}
 */
function filesUnder(dir) {
    const found = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            found.push(...filesUnder(full))
        } else {
            found.push(relative(WEB, full).split("\\").join("/"))
        }
    }
    return found
}

/**
 * Resuelve una referencia relativa escrita en un archivo de web/.
 * @param {string} from ruta del archivo que la contiene, relativa a web/
 * @param {string} ref referencia tal como está escrita
 * @returns {string} ruta relativa a web/, sin consulta ni fragmento
 */
function resolveFrom(from, ref) {
    const clean = ref.split(/[?#]/)[0]
    return posix.normalize(posix.join(posix.dirname(from), clean))
}

/**
 * Referencias locales de index.html: src de script e img y href de link.
 * @returns {string[]} rutas relativas a web/
 */
function pageReferences() {
    const page = readFileSync(join(WEB, "index.html"), "utf8")
    const found = []
    const tags = page.matchAll(/<(script|img|link)\b([^>]*)>/gi)
    for (const [, tag, attrs] of tags) {
        const name = tag.toLowerCase() === "link" ? "href" : "src"
        const value = new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs)
        if (value !== null) {
            found.push(resolveFrom("index.html", value[1] ?? value[2] ?? value[3]))
        }
    }
    return found
}

/**
 * Módulos importados desde src/, por análisis estático: import y export con from, import de
 * efecto y import() con texto fijo. Las rutas sin punto inicial no son locales y se ignoran.
 * @returns {Array<[string, string]>} pares [archivo que importa, ruta importada]
 */
function moduleImports() {
    const pairs = []
    const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\1/g
    for (const file of filesUnder(join(WEB, "src"))) {
        if (!file.endsWith(".js")) {
            continue
        }
        const source = readFileSync(join(WEB, file), "utf8")
        for (const match of source.matchAll(pattern)) {
            pairs.push([file, resolveFrom(file, match[2])])
        }
    }
    return pairs
}

/**
 * Recursos que piden las hojas de estilo con url(), salvo datos en línea.
 * @returns {Array<[string, string]>} pares [hoja, ruta pedida]
 */
function styleUrls() {
    const pairs = []
    for (const file of filesUnder(join(WEB, "styles"))) {
        const source = readFileSync(join(WEB, file), "utf8")
        for (const match of source.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
            if (!match[2].startsWith("data:")) {
                pairs.push([file, resolveFrom(file, match[2])])
            }
        }
    }
    return pairs
}

const { CACHE_NAME, PRECACHE } = loadWorker()
const listed = new Set(PRECACHE)

describe("Lista de precarga del service worker", () => {
    it("coincide con los archivos de web/ salvo sw.js", () => {
        const onDisk = filesUnder(WEB).filter((file) => file !== "sw.js").sort()
        const inList = PRECACHE.filter((path) => path !== "./").sort()
        assert.deepEqual(inList, onDisk)
    })

    it("incluye la raíz", () => {
        assert.ok(listed.has("./"))
    })

    it("no repite ningún archivo", () => {
        assert.equal(listed.size, PRECACHE.length)
    })

    it("no se guarda a sí mismo", () => {
        assert.ok(!listed.has("sw.js"))
    })

    it("usa una caché con el prefijo de la aplicación", () => {
        assert.match(CACHE_NAME, /^empat/)
    })
})

describe("Todo lo que pide la página está guardado", () => {
    it("lo que enlaza index.html", () => {
        const references = pageReferences()
        assert.ok(references.includes("boot-guard.js"))
        assert.ok(references.includes("src/main.js"))
        const missing = references.filter((path) => !listed.has(path))
        assert.deepEqual(missing, [])
    })

    it("cada import de src/", () => {
        const pairs = moduleImports()
        assert.ok(pairs.length > 0)
        const missing = pairs.filter(([, path]) => !listed.has(path))
        assert.deepEqual(missing, [])
    })

    it("cada url() de las hojas de estilo", () => {
        const pairs = styleUrls()
        assert.ok(pairs.length > 0)
        const missing = pairs.filter(([, path]) => !listed.has(path))
        assert.deepEqual(missing, [])
    })
})

describe("Manifiesto de instalación", () => {
    const manifest = JSON.parse(readFileSync(join(WEB, "manifest.webmanifest"), "utf8"))

    it("cada icono existe en disco", () => {
        const missing = manifest.icons.filter((icon) => !existsSync(join(WEB, icon.src)))
        assert.deepEqual(missing, [])
    })

    it("tiene un icono adaptable", () => {
        assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"))
    })

    it("arranca y se limita a la carpeta de la web", () => {
        assert.equal(manifest.start_url, "./")
        assert.equal(manifest.scope, "./")
    })
})
