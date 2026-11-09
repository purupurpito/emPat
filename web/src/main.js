/**
 * Punto de entrada del navegador. Arranca el idioma, crea la aplicación y vigila que el primer
 * pintado llegue; si algo revienta por el camino, deriva a la pantalla de error.
 * @module src/main.js
 */

import { startLanguage } from "./i18n/language.js"
import { App } from "./app/app.js"
import { showFatal } from "./app/screens/fatal.screen.js"
import { UI_TEXT } from "./app/constants.js"

/**
 * Plazo para el primer pintado; pasado, se da por fallido.
 */
const BOOT_DEADLINE_MS = 15000

/**
 * Secuencia de arranque: idioma, aplicación, captura de errores globales mientras no haya
 * pintado, aviso de arranque lento y apertura del acta pedida en la URL. Una vez pintado, los
 * errores sueltos no sustituyen la pantalla: se quedan en la consola.
 * @returns {App} la aplicación creada
 */
export function boot() {
    startLanguage()
    const app = new App()
    addEventListener("error", (event) => {
        if (!app.booted) {
            showFatal(event.error || event.message)
        }
    })
    addEventListener("unhandledrejection", (event) => {
        if (!app.booted) {
            showFatal(event.reason)
        }
    })
    setTimeout(() => {
        if (!app.booted) {
            showFatal(new Error(UI_TEXT.slowBoot))
        }
    }, BOOT_DEADLINE_MS)
    const recordId = new URLSearchParams(location.search).get("acta")
    app.start(recordId)
    return app
}

if (typeof document !== "undefined") {
    boot()
}
