/**
 * Conducta del traductor y del idioma activo, con catálogos pequeños hechos a medida y con el
 * catálogo real en los casos que dependen de él.
 * @module tests/i18n/translator.test.mjs
 */
import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import * as catalog from "../../web/src/i18n/ca.js"
import { createTranslator } from "../../web/src/i18n/translator.js"
import { settle } from "../../web/src/i18n/dom.js"
import { i18n, pickLanguage, LANGUAGE_KEY } from "../../web/src/i18n/language.js"

/**
 * Catálogo mínimo para probar el orden de las etapas sin depender de las tablas reales.
 * @param {object} parts tablas que se quieren sustituir
 * @returns {object}
 */
function tiny(parts) {
    return { LITERALS: new Map(), PATTERNS: [], FRAGMENTS: [], ...parts }
}

const { t } = createTranslator(catalog)

describe("Etapas del traductor", () => {
    it("una frase completa gana a los patrones y a los trozos", () => {
        const own = createTranslator(tiny({
            LITERALS: new Map([["Hola mundo", "Hola món"]]),
            FRAGMENTS: [["mundo", "terra"]],
        }))
        assert.equal(own.t("Hola mundo"), "Hola món")
    })

    it("una frase que se traduce a sí misma corta el paso a los trozos", () => {
        const own = createTranslator(tiny({
            LITERALS: new Map([["Local", "Local"]]),
            FRAGMENTS: [["Local", "Casa"]],
        }))
        assert.equal(own.t("Local"), "Local")
    })

    it("los trozos solo casan palabras completas", () => {
        const own = createTranslator(tiny({ FRAGMENTS: [["por", "per"]] }))
        assert.equal(own.t("por portero"), "per portero")
    })

    it("los trozos se encadenan sobre el resultado del anterior", () => {
        const own = createTranslator(tiny({ FRAGMENTS: [["uno dos", "dos"], ["dos", "tres"]] }))
        assert.equal(own.t("uno dos"), "tres")
    })

    it("conserva los espacios de alrededor", () => {
        assert.equal(t("  Abrir \n"), "  Obre \n")
    })

    it("interpreta los $ del resultado como un reemplazo de cadena", () => {
        const own = createTranslator(tiny({ FRAGMENTS: [["club", "$&$&"]] }))
        assert.equal(own.t("el club"), "el el clubel club")
    })
})

describe("Patrones del catálogo real", () => {
    it("traduce los huecos que se piden traducidos", () => {
        assert.equal(t("Firma · Datos"), "Signatura · Dades")
    })

    it("elige la variante con el trozo opcional cuando está", () => {
        assert.equal(
            t("2 de 2 en este set (último) · Local"),
            "2 de 2 en aquest set (l'últim) · Local",
        )
        assert.equal(t("1 de 2 en este set · Local"), "1 de 2 en aquest set · Local")
    })

    it("pone el plural según la cifra", () => {
        assert.equal(t("1 inscrito"), "1 inscrit")
        assert.equal(t("3 inscritos"), "3 inscrits")
    })

    it("apostrofa al anotador en el aviso de contraseña", () => {
        assert.equal(
            t("Contraseña del anotador incorrecta."),
            "Contrasenya de l'anotador incorrecta.",
        )
    })

    it("cambia líbero por lliure al final, en plural y en singular", () => {
        assert.equal(t("Líberos y líbero"), "Lliures y lliure")
    })
})

describe("Punto fijo", () => {
    it("se detiene a las ocho vueltas aunque el texto siga cambiando", () => {
        let calls = 0
        const grow = (text) => {
            calls += 1
            return text + "x"
        }
        assert.equal(settle("a", grow), "axxxxxxxx")
        assert.equal(calls, 8)
    })
})

describe("Elección de idioma", () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    const savedNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator")

    function fakeStorage(value) {
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            value: { getItem: (key) => (key === LANGUAGE_KEY ? value : null) },
        })
    }

    function fakeBrowser(language) {
        Object.defineProperty(globalThis, "navigator", { configurable: true, value: { language } })
    }

    afterEach(() => {
        for (const [name, descriptor] of [["localStorage", saved], ["navigator", savedNavigator]]) {
            if (descriptor === undefined) {
                delete globalThis[name]
            } else {
                Object.defineProperty(globalThis, name, descriptor)
            }
        }
    })

    it("respeta lo guardado tal cual", () => {
        fakeStorage("fr")
        fakeBrowser("ca-ES")
        assert.equal(pickLanguage(), "fr")
    })

    it("sin nada guardado sigue al navegador", () => {
        fakeStorage(null)
        fakeBrowser("CA")
        assert.equal(pickLanguage(), "ca")
    })

    it("si el almacenamiento falla, castellano", () => {
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                throw new Error("bloqueado")
            },
        })
        fakeBrowser("ca")
        assert.equal(pickLanguage(), "es")
    })

    it("antes de arrancar, i18n no traduce", () => {
        assert.equal(i18n.t("Abrir"), "Abrir")
    })
})
