/**
 * Atajos de teclado del partido.
 *
 * La estructura (cuándo se atiende una tecla) está separada de la tabla de atajos: cada
 * atajo dice qué tecla reconoce y qué hace con la aplicación.
 * @module src/app/keyboard.js
 */

import { currentPeriod, rival } from "../rules/index.js"

/**
 * Elementos con foco en los que las teclas son para escribir, no atajos.
 */
const TYPING_TAGS = /INPUT|TEXTAREA|SELECT/

/**
 * Atajos del partido en juego, por orden de comprobación. Cada uno tiene matches(evento) y
 * run(app). Todos anulan la acción por defecto del navegador.
 */
const MATCH_SHORTCUTS = Object.freeze([
    {
        matches: (event) => event.key === "ArrowLeft",
        run: (app) => {
            const left = currentPeriod(app.session.match).leftSide
            app.session.commit({ kind: "rally", side: left })
        },
    },
    {
        matches: (event) => event.key === "ArrowRight",
        run: (app) => {
            const left = currentPeriod(app.session.match).leftSide
            app.session.commit({ kind: "rally", side: rival(left) })
        },
    },
    {
        matches: (event) => (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z",
        run: (app) => {
            app.session.undo()
        },
    },
])

/**
 * Indica si la aplicación está en condiciones de atender atajos del partido: acta abierta, set
 * en juego, sin diálogo y sin el foco en un campo de texto.
 * @param {App} app aplicación
 * @returns {boolean}
 */
function acceptsMatchKeys(app) {
    const session = app.session
    if (session.record === null || session.match === null) {
        return false
    }
    if (session.match.phase !== "live" || app.dialog.isOpen) {
        return false
    }
    return !TYPING_TAGS.test(document.activeElement?.tagName)
}

/**
 * Escape cierra el diálogo abierto; en el partido, las flechas dan el punto al equipo de ese
 * lado de la mesa y Ctrl+Z (o Cmd+Z) deshace.
 * @param {App} app aplicación
 */
export function installShortcuts(app) {
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && app.dialog.isOpen) {
            app.dialog.close()
            return
        }
        if (!acceptsMatchKeys(app)) {
            return
        }
        for (const shortcut of MATCH_SHORTCUTS) {
            if (shortcut.matches(event)) {
                event.preventDefault()
                shortcut.run(app)
            }
        }
    })
}
