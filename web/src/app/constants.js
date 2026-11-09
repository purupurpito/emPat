/**
 * Constantes de la interfaz: zonas, firmas, sanciones, marcas y los textos que dicen los
 * servicios (sesión, almacén, avisos) fuera de las vistas.
 * @module src/app/constants.js
 */

/**
 * Numerales romanos de las zonas, de la I (zaguero derecho, el que saca) a la VI.
 * @type {ReadonlyArray<string>}
 */
export const ZONE_NUMERALS = Object.freeze(["I", "II", "III", "IV", "V", "VI"])

/**
 * Nombre visible de cada nivel de sanción. Incluye el registro de solicitud improcedente, que
 * el motor guarda junto a las sanciones aunque no lo sea.
 * @type {Readonly<Record<string, string>>}
 */
export const SANCTION_LABELS = Object.freeze({
    warning: "Amonestación",
    penalty: "Penalización",
    expulsion: "Expulsión",
    disqualification: "Descalificación",
    delayWarning: "Amonestación por retraso",
    delayPenalty: "Penalización por retraso",
    improper: "Solicitud improcedente",
})

/**
 * Rótulo de cada casilla de firma, tanto de las previas como de las del cierre.
 * @type {Readonly<Record<string, string>>}
 */
export const SIGNER_LABELS = Object.freeze({
    scorer: "Anotador",
    assistantScorer: "Anotador asistente",
    homeCaptain: "Capitán local",
    awayCaptain: "Capitán visitante",
    referee2: "2º árbitro",
    referee1: "1er árbitro",
    homeCaptainPre: "Capitán local",
    homeCoachPre: "Entrenador local",
    awayCaptainPre: "Capitán visitante",
    awayCoachPre: "Entrenador visitante",
})

/**
 * Casillas de firma al cerrar el acta, en el orden en que se firma: anotadores, capitanes y
 * árbitros, el primero en último lugar (FIVB 27.2.3.3).
 * @type {ReadonlyArray<string>}
 */
export const CLOSING_SIGNERS = Object.freeze([
    "scorer",
    "assistantScorer",
    "homeCaptain",
    "awayCaptain",
    "referee2",
    "referee1",
])

/**
 * Casillas de firma de la plantilla, previas al partido: capitán y entrenador de cada equipo.
 * @type {ReadonlyArray<string>}
 */
export const OPENING_SIGNERS = Object.freeze([
    "homeCaptainPre",
    "homeCoachPre",
    "awayCaptainPre",
    "awayCoachPre",
])

/**
 * Clave común con la que se aprueba y se reabre el acta. Es una clave de demostración, igual
 * para todos los que aprueban.
 * @type {string}
 */
export const SEAL_PIN = "0000"

/**
 * Casillas que tienen que dar la clave para aprobar el acta.
 * @type {ReadonlyArray<string>}
 */
export const SEAL_SIGNERS = Object.freeze([
    "scorer",
    "homeCaptain",
    "awayCaptain",
    "referee1",
])

/**
 * Respuesta a cualquier jugada sobre un acta aprobada (salvo las firmas).
 * @type {string}
 */
export const SEALED_TEXT = "Esta acta ya está aprobada y cerrada; no admite cambios."

/**
 * Letra con la que se marca cada sanción individual en la lista de jugadores. Los niveles que
 * no aparecen aquí no se marcan.
 * @type {Readonly<Record<string, string>>}
 */
export const FULL_SET_MARKS = Object.freeze({
    warning: "A",
    penalty: "C",
    expulsion: "E",
    disqualification: "D",
})

/**
 * Índices de rotación en el orden en que se pintan las casillas de cada pista. mini es la
 * pista pequeña (red arriba); west y east son las dos mitades de la pista grande vistas desde la
 * mesa. Los zagueros son los índices 4, 5 y 0.
 * @type {Readonly<{mini: number[], west: number[], east: number[]}>}
 */
export const COURT_ORDER = Object.freeze({
    mini: Object.freeze([3, 2, 1, 4, 5, 0]),
    west: Object.freeze([4, 3, 5, 2, 0, 1]),
    east: Object.freeze([1, 0, 2, 5, 3, 4]),
})

/**
 * Datos fijos del partido de prueba. Fecha y hora se ponen al crearlo, y los nombres de los
 * equipos salen de las plantillas de muestra.
 * @type {Readonly<Record<string, string>>}
 */
export const DEMO_INFO = Object.freeze({
    competition: "Partido de ejemplo",
    category: "Júnior",
    matchNo: "DEMO-1",
    venue: "Polideportivo de ejemplo",
    town: "Sant Exemple",
    referee1: "Carla Moya Ferré",
    referee2: "Dídac Serrano Puig",
    scorer: "Berta Llorens Pina",
    assistantScorer: "Òscar Vela Riba",
})

/**
 * Textos que muestran los servicios. Los que llevan datos son funciones; el resto, cadenas.
 * Se agrupan aquí para que el castellano visible no se reparta por módulos sin vista.
 */
export const UI_TEXT = Object.freeze({
    saveFailed: "No se han podido guardar los cambios en este dispositivo.",
    doubleTap: "Pulsación doble: solo se ha sumado un punto.",
    missingRecord: "No se ha encontrado el acta.",
    nothingToUndo: "No queda nada por deshacer.",
    demoReady: "Partido de ejemplo creado. Ahora, sorteo y formación inicial.",
    sealed: "El acta ha quedado aprobada y cerrada.",
    reopened: "El acta se ha reabierto.",
    wrongReopenPin: "Contraseña del 1er árbitro incorrecta.",
    slowBoot: "La aplicación tarda demasiado en cargar.",
    defaultSubtitle: "Acta electrónica de voleibol",
    homeFallback: "Local",
    awayFallback: "Visitante",
    notRecord: "el contenido no corresponde a un acta",
    badImport: (reason) => "No se ha podido importar el archivo: " + reason,
    askUndo: (what) => `¿Quieres deshacer "${what}"?`,
    undone: (what) => "Se ha deshecho: " + what,
    reopenNote: (time) => "Acta reabierta; llevaba aprobada desde las " + time,
    lastTimeout: (team, count) => `Último tiempo de descanso del set para ${team} (n.º ${count}).`,
    lateSubstitution: (team, count, last) => {
        if (last) {
            return `Última sustitución del set para ${team} (n.º ${count}).`
        }
        return `${team} ya lleva ${count} sustituciones en este set.`
    },
    captainLeft: (team, shirt) => {
        const lead = `${team}: el capitán (${shirt}) está fuera de la pista`
        return lead + "; designa al capitán en juego."
    },
})

/**
 * Frases del registro de jugadas. Cada entrada recibe la jugada y una función que da el nombre
 * de un lado; las que dependen de otras tablas reciben además lo que necesitan.
 */
export const PLAY_PHRASES = Object.freeze({
    causes: Object.freeze({
        penalty: "penalización",
        delayPenalty: "penalización por retraso",
        rotationFault: "falta de rotación",
        forfeit: "equipo incompleto",
    }),
    rally: (team, cause) => {
        if (cause === "") {
            return `Punto para ${team}`
        }
        return `Punto para ${team} (${cause})`
    },
    timeout: (team) => `${team} pide tiempo de descanso`,
    substitution: (team, play) => {
        const label = play.exceptional ? "Sustitución excepcional" : "Sustitución"
        return `${label} de ${team}: entra ${play.entering} por ${play.leaving}`
    },
    liberoIn: (team, play) => `Entra el líbero ${play.libero} de ${team} por el ${play.leaving}`,
    liberoOut: (team) => `Sale el líbero de ${team}`,
    sanctionShirt: (shirt) => "al " + shirt,
    sanctionTeam: "al equipo",
    sanctionStaff: (title) => "al " + title.toLowerCase(),
    sanction: (label, whom, team) => `${label} ${whom} · ${team}`,
    improper: (team) => `Solicitud improcedente de ${team}`,
    startPeriod: "Comienza el set",
    toss: "Sorteo",
    lineup: (team) => `Formación inicial de ${team}`,
    note: "Observación",
    sign: "Firma",
    openGolden: "Golden set",
    actingCaptain: (team, play) => `${team}: capitán en juego, el ${play.shirt}`,
    replayRally: "Se repite la jugada",
    rotationFault: (team, other, from) => {
        let voided = ""
        if (from !== null && from !== undefined) {
            voided = ` (se le anulan los puntos desde el ${from})`
        }
        return `${team} comete falta de rotación; punto para ${other}${voided}`
    },
    noShow: (team) => `Incomparecencia de ${team}`,
    shortHanded: (team) => `Equipo incompleto: ${team}`,
    liberoUnfit: (team, play) => {
        const extra = play.successor ? ` · nuevo líbero re-designado: ${play.successor}` : ""
        return `${team}: líbero ${play.libero} incapacitado para jugar${extra}`
    },
    fullSetMark: (team, play) => {
        const verb = play.value ? "Se marca" : "Se desmarca"
        return `${verb} el set ${play.period} del ${play.shirt} (${team}) como completo`
    },
    roster: (team) => `Plantilla de ${team}`,
})
