/**
 * Localiza y carga módulos de web/ desde las pruebas. Las rutas se resuelven a partir de este
 * archivo y se convierten en URL file:, que es lo único que import() acepta de forma fiable en
 * Windows y en Unix a la vez.
 * @module tests/support/load.mjs
 */
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/** Carpeta raíz de la copia de trabajo (la que contiene web/ y tests/). */
export const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url))

/** Carpeta web/ con la aplicación. */
const WEB_ROOT = resolve(PROJECT_ROOT, "web")

/**
 * Convierte una ruta relativa a web/ en una URL importable.
 * @param {string} relativePath ruta con barras normales, por ejemplo "src/app/record.js"
 * @returns {string} URL file:
 */
function webModuleUrl(relativePath) {
    return pathToFileURL(resolve(WEB_ROOT, relativePath)).href
}

/**
 * Importa cualquier módulo ES de web/.
 * @param {string} relativePath ruta relativa a web/
 * @returns {Promise<object>} espacio de nombres del módulo
 */
export async function loadWebModule(relativePath) {
    return import(webModuleUrl(relativePath))
}

/**
 * Importa la fachada pública del motor. La variable de entorno EMPAT_RULES permite apuntar a otro
 * módulo con el mismo contrato, lo que sirve para comprobar que las propias pruebas son correctas
 * contra una implementación de control.
 * @returns {Promise<object>} espacio de nombres de src/rules/index.js
 */
export async function loadRules() {
    const override = process.env.EMPAT_RULES
    if (override) {
        return import(pathToFileURL(resolve(override)).href)
    }
    return loadWebModule("src/rules/index.js")
}
