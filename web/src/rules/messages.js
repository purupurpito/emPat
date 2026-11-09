/**
 * Todos los textos de error del motor, como funciones o cadenas. Es el único lugar del motor
 * con castellano visible; las reglas solo hacen referencia a estas claves.
 * @module src/rules/messages.js
 */

/**
 * Catálogo de mensajes del motor. Cada clave produce exactamente el texto que ve el anotador;
 * los huecos con datos del usuario se rellenan sin normalizar, tal como llegan en la jugada.
 * Cada frase va entera en un solo literal, aunque pase del ancho de línea habitual, porque el
 * catálogo catalán y su prueba de cobertura la reconocen por su forma completa.
 */
export const TEXT = Object.freeze({
    // —— Jugadas y fases ——
    unknownPlay: (kind) => "Tipo de jugada no reconocido: " + kind,
    notLive: "No hay ningún set en juego.",
    matchOver: "El partido ha terminado.",
    rosterClosed: "Con el partido empezado, las plantillas ya no se pueden modificar.",
    alreadyLive: "Este set ya se está jugando.",
    periodStarted: "Este set ya ha comenzado.",
    needMatchRunning: "Solo es posible durante el partido.",
    noteNeedsLive: "Solo se puede anotar durante un set.",
    replayNeedsLive: "La repetición de la jugada solo se anota durante un set.",
    timeoutNeedsLive: "Los tiempos de descanso solo se conceden durante un set.",
    subsNeedLive: "Las sustituciones solo se pueden hacer durante un set.",
    liberoNeedsLive: "El líbero solo puede entrar durante un set.",
    captainNeedsLive: "El capitán en juego solo se designa durante un set.",

    // —— Preguntas por el lado ——
    whichTeamScores: "¿A qué equipo va?",
    whichTeamFaulted: "Indica qué equipo ha cometido la falta.",
    whichTeam: "Falta indicar el equipo.",

    // —— Plantilla ——
    badShirt: (shirt, name) => `Dorsal incorrecto: "${shirt ?? ""}"${name ? " (" + name + ")" : ""}. Usa un número del 0 al 99, o 00.`,
    repeatedShirts: "Hay dos jugadores con el mismo dorsal.",
    oneCaptain: "Marca un solo capitán.",
    badCategory: (shirt) => `Categoría incorrecta para el ${shirt}: elige Y, J, C, I o A.`,
    twoLiberos: "No puede haber más de 2 líberos.",
    rosterTooLong: (limit, withLibero) => `El acta admite ${limit} jugadores como máximo${withLibero ? ", líberos incluidos" : ""}.`,
    staffTooLong: "Además del primer entrenador, solo se admiten 3 oficiales más.",
    liberoDisabled: "El formato de este partido no tiene líbero.",

    // —— Sorteo, alineación e inicio ——
    tossTooLate: "El sorteo solo se hace antes del set 1 o del set decisivo.",
    tossOnlyDecider: "Ahora el sorteo solo corresponde antes del set decisivo.",
    needSixPlayers: "Cada equipo debe tener como mínimo 6 jugadores sin contar los líberos.",
    lineupSize: "La formación inicial debe tener 6 jugadores.",
    lineupRepeats: "Un mismo dorsal aparece dos veces en la formación inicial.",
    liberoStarter: (shirt) => `El ${shirt} es líbero y no puede formar parte de la formación inicial.`,
    cannotPlay: (shirt) => `El ${shirt} no está autorizado a jugar.`,
    missingLineups: "Faltan las formaciones iniciales.",
    missingToss: "Antes hay que hacer el sorteo.",
    missingServer: "Indica qué equipo saca.",

    // —— Desempate y set completo ——
    goldenNotYet: "El golden set solo se juega con el partido terminado.",
    goldenPlayed: "Ya se ha jugado el golden set.",
    periodNotPlayed: "Ese set no llegó a jugarse.",

    // —— Presencia en el acta y en pista ——
    notListed: (shirt) => `El ${shirt} no figura en el acta.`,
    notOnCourt: (shirt) => `El ${shirt} no se encuentra en pista.`,
    alreadyOnCourt: (shirt) => `El ${shirt} ya se encuentra en pista.`,

    // —— Sustituciones ——
    replaceSanctionedFirst: "Primero sustituye al jugador expulsado o descalificado.",
    liberoBySub: "Un líbero no entra por sustitución, sino con un reemplazo del líbero.",
    behindLibero: (shirt) => `El ${shirt} está reemplazado por el líbero: antes debe salir el líbero.`,
    barredForMatch: (shirt) => `El ${shirt} ya no puede jugar más en este partido.`,
    expelledThisSet: (shirt) => `El ${shirt} está expulsado hasta el final del set.`,
    subsUsed: (limit) => `Ya ha agotado las ${limit} sustituciones del set.`,
    starterClosed: (shirt) => `El ${shirt} ya ha salido y regresado en este set: no puede salir otra vez.`,
    starterBack: (shirt) => `El ${shirt} es titular: solo regresa a pista por el suplente que lo sustituyó.`,
    benchUsed: (shirt) => `El ${shirt} ya ha jugado en este set: solo puede volver a entrar por el mismo titular al que sustituyó.`,
    notRegularExit: (shirt) => `El ${shirt} no puede salir mediante una sustitución regular.`,
    onlyStarterBack: (shirt, starter) => `Al ${shirt} solo lo puede relevar el ${starter}, el titular al que sustituyó.`,
    cannotEnter: (shirt) => `El ${shirt} no está autorizado a entrar.`,

    // —— Líbero ——
    noLibero: "Este partido se juega sin líbero.",
    notRegisteredLibero: (shirt) => `El ${shirt} no figura como líbero en el acta.`,
    liberoBarred: (shirt) => `El líbero ${shirt} no está autorizado a jugar.`,
    liberoAlreadyIn: "Ya hay un líbero en pista: sácalo antes o cámbialo directamente por el otro líbero.",
    sameLibero: "Ese líbero ya se encuentra en pista.",
    rallyBetweenSwaps: "Debe completarse una jugada entre dos reemplazos del líbero.",
    backRowOnly: "El líbero solo reemplaza a zagueros (zonas I, V y VI).",
    liberoCannotServe: "El líbero no saca: no puede reemplazar al jugador que tiene el saque.",
    noLiberoOnCourt: "Ahora no hay ningún líbero en pista.",
    notALibero: (shirt) => `El ${shirt} no es un líbero.`,
    noLongerPlays: (shirt) => `El ${shirt} ya no participa en el partido.`,
    alreadyLibero: (shirt) => `El ${shirt} ya es líbero: no hay que volver a designarlo.`,
    otherLiberoLeft: (shirt) => `Aún queda el otro líbero, el ${shirt}: solo se puede re-designar si él tampoco puede jugar (FIVB 19.4.3.1).`,
    successorOnCourt: (shirt) => `El ${shirt} está en pista: para re-designarlo como líbero tiene que estar fuera.`,

    // —— Sanciones y tiempos ——
    whoIsSanctioned: "Indica a quién va la sanción.",
    warningUsed: "Este equipo ya fue amonestado: la próxima conducta incorrecta se sanciona con penalización.",
    delayWarningUsed: "Este equipo ya tiene amonestación por retraso: el próximo retraso es penalización por retraso.",
    firstDelayIsWarning: "El primer retraso se sanciona con amonestación por retraso.",
    timeoutsUsed: (limit) => `Ya ha agotado los ${limit} tiempos de descanso del set.`,

    // —— Capitán en juego ——
    noCaptain: "Este equipo no tiene capitán inscrito en el acta.",
    captainOnCourt: (shirt) => `El capitán (${shirt}) está en pista, así que él es el capitán en juego.`,

    // —— Falta de rotación ——
    badRollback: (top) => `Los puntos del equipo infractor al cometer la falta deben estar entre 0 y ${top}.`,
})
