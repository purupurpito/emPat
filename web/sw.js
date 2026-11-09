/**
 * Service worker clásico. Al instalarse guarda todos los archivos de la web en una caché con el
 * nombre de su versión y, desde ese momento, sirve la aplicación desde ahí aunque no haya red.
 * Las actas viven en localStorage y no pasan por aquí.
 *
 * Una versión se instala entera o no se instala, y nunca se mezclan archivos de dos versiones.
 * Para publicar cambios hay que tocar este archivo (subir el número de CACHE_NAME y, si cambia
 * algún archivo, la lista PRECACHE): el navegador detecta el cambio, instala la versión nueva
 * aparte y la página ofrece pasar a ella.
 * @file sw.js
 */

/** Todas las cachés de la aplicación empiezan así; las demás no se tocan. */
const CACHE_PREFIX = "empat/"

/** Caché de esta versión. */
const CACHE_NAME = CACHE_PREFIX + "3"

/** Archivos de la web que se guardan al instalar, uno por línea: todos menos este. */
const PRECACHE = `
    ./
    boot-guard.js
    fuentes/OFL.txt
    fuentes/archivo-ext.woff2
    fuentes/archivo.woff2
    icono.svg
    iconos/apple-touch-icon.png
    iconos/icono-192.png
    iconos/icono-512.png
    iconos/icono-maskable-512.png
    impresos/acta-estandar.svg
    impresos/acta-infantil.svg
    impresos/hoja-observaciones.svg
    index.html
    manifest.webmanifest
    src/app/app.js
    src/app/bus.js
    src/app/clocks.js
    src/app/colors.js
    src/app/constants.js
    src/app/data/demo-rosters.js
    src/app/data/remark-templates.js
    src/app/describe.js
    src/app/dialog.js
    src/app/dialogs/incidents.js
    src/app/dialogs/libero-exit.js
    src/app/dialogs/libero-unfit.js
    src/app/dialogs/libero.js
    src/app/dialogs/no-show.js
    src/app/dialogs/remark.js
    src/app/dialogs/reopen.js
    src/app/dialogs/sanction.js
    src/app/dialogs/signature.js
    src/app/dialogs/substitution.js
    src/app/dialogs/timeout.js
    src/app/dom.js
    src/app/format.js
    src/app/keyboard.js
    src/app/notices.js
    src/app/notifier.js
    src/app/record.js
    src/app/router.js
    src/app/screen.js
    src/app/screens/break.screen.js
    src/app/screens/details.screen.js
    src/app/screens/fatal.screen.js
    src/app/screens/final.screen.js
    src/app/screens/home.screen.js
    src/app/screens/live.screen.js
    src/app/screens/paper.screen.js
    src/app/screens/rosters.screen.js
    src/app/screens/toss.screen.js
    src/app/session.js
    src/app/store.js
    src/app/views/break.view.js
    src/app/views/common.view.js
    src/app/views/court.view.js
    src/app/views/details.view.js
    src/app/views/dialogs/incidents.view.js
    src/app/views/dialogs/libero-exit.view.js
    src/app/views/dialogs/libero-unfit.view.js
    src/app/views/dialogs/libero.view.js
    src/app/views/dialogs/no-show.view.js
    src/app/views/dialogs/remark.view.js
    src/app/views/dialogs/reopen.view.js
    src/app/views/dialogs/sanction.view.js
    src/app/views/dialogs/signature.view.js
    src/app/views/dialogs/substitution.view.js
    src/app/views/dialogs/timeout.view.js
    src/app/views/digest.view.js
    src/app/views/fatal.view.js
    src/app/views/final.view.js
    src/app/views/home.view.js
    src/app/views/live.view.js
    src/app/views/panel.view.js
    src/app/views/paper.view.js
    src/app/views/rosters.view.js
    src/app/views/toss.view.js
    src/i18n/ca.js
    src/i18n/dom.js
    src/i18n/language.js
    src/i18n/translator.js
    src/main.js
    src/pwa/updates.js
    src/rules/constants.js
    src/rules/index.js
    src/rules/match.js
    src/rules/messages.js
    src/rules/period.js
    src/rules/plays/changes.js
    src/rules/plays/discipline.js
    src/rules/plays/paperwork.js
    src/rules/plays/rally.js
    src/rules/plays/setup.js
    src/rules/reports.js
    src/rules/shirts.js
    src/rules/team.js
    src/rules/violation.js
    src/sheet/annex.js
    src/sheet/canvas.js
    src/sheet/clubs.js
    src/sheet/decider-block.js
    src/sheet/footer.js
    src/sheet/header.js
    src/sheet/index.js
    src/sheet/layout.js
    src/sheet/metrics.js
    src/sheet/names.js
    src/sheet/period-block.js
    src/sheet/remarks.js
    src/sheet/rosters.js
    src/sheet/warp.js
    styles/base.css
    styles/closing.css
    styles/fonts.css
    styles/match.css
    styles/palette.css
    styles/paper.css
    styles/setup.css
    styles/shell.css`.split(/\s+/).filter(Boolean)

/**
 * Guarda PRECACHE completo en la caché de esta versión. Pide cada archivo saltándose la caché
 * HTTP del navegador para no guardar copias atrasadas. Si falla uno, falla la instalación y se
 * queda la versión que ya había.
 * @param {ExtendableEvent} event evento install
 */
function onInstall(event) {
    event.waitUntil(storeEverything())
}

/**
 * Abre la caché de la versión y descarga en ella toda la lista.
 * @returns {Promise<void>}
 */
async function storeEverything() {
    const cache = await caches.open(CACHE_NAME)
    const requests = PRECACHE.map((path) => new Request(path, { cache: "reload" }))
    await cache.addAll(requests)
}

/**
 * Al activarse borra las cachés de otras versiones de la aplicación y se pone al mando de las
 * pestañas abiertas.
 * @param {ExtendableEvent} event evento activate
 */
function onActivate(event) {
    event.waitUntil(dropOtherVersions().then(() => self.clients.claim()))
}

/**
 * Borra toda caché de la aplicación que no sea la de esta versión. Se compara con "empat" a
 * secas para barrer también nombres de caché con otro separador.
 * @returns {Promise<boolean[]>}
 */
async function dropOtherVersions() {
    const names = await caches.keys()
    const stale = names.filter((name) => name.startsWith("empat") && name !== CACHE_NAME)
    return Promise.all(stale.map((name) => caches.delete(name)))
}

/**
 * La página manda "activate-now" cuando el anotador acepta la versión nueva.
 * @param {ExtendableMessageEvent} event mensaje
 */
function onMessage(event) {
    if (event.data === "activate-now") {
        self.skipWaiting()
    }
}

/**
 * Solo atiende peticiones GET del propio origen; el resto sigue su camino normal.
 * @param {FetchEvent} event petición
 */
function onFetch(event) {
    const request = event.request
    if (request.method !== "GET") {
        return
    }
    if (new URL(request.url).origin !== self.location.origin) {
        return
    }
    event.respondWith(answer(request))
}

/**
 * Respuesta desde la caché, sin mirar la parte de búsqueda de la URL. Toda navegación recibe
 * index.html, así que ?acta=… abre igual sin conexión. Lo que no está guardado se pide a la red
 * y, si tampoco hay red, se responde con un error de red.
 * @param {Request} request petición
 * @returns {Promise<Response>}
 */
async function answer(request) {
    const cache = await caches.open(CACHE_NAME)
    let key = request
    if (request.mode === "navigate") {
        key = "index.html"
    }
    const stored = await cache.match(key, { ignoreSearch: true })
    if (stored) {
        return stored
    }
    try {
        return await fetch(request)
    } catch (error) {
        return Response.error()
    }
}

if (typeof self === "object" && typeof self.addEventListener === "function") {
    self.addEventListener("install", onInstall)
    self.addEventListener("activate", onActivate)
    self.addEventListener("message", onMessage)
    self.addEventListener("fetch", onFetch)
}

// En Node no hay self; la prueba de despliegue lee la lista por aquí.
if (typeof module === "object") {
    module.exports = { CACHE_NAME, PRECACHE }
}
