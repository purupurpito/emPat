/**
 * Catálogo catalán. Son datos: cuatro tablas escritas como texto, con una fila por entrada en
 * la forma `castellano ⇒ catalán`, que se analizan una sola vez al cargar el módulo. Una fila
 * larga sigue en las líneas siguientes con más sangría; al leerla se vuelve a unir con un
 * espacio.
 *
 * Aquí no se decide cuándo se traduce ni en qué orden: eso lo hace el traductor.
 * @module src/i18n/ca.js
 */

/** Separa el texto de origen del de destino dentro de una fila. */
const ARROW = " ⇒ "

/** Sangría de las líneas que continúan la fila anterior. */
const CONTINUATION = "        "

/**
 * Lee una tabla escrita como texto y devuelve sus filas como pares.
 * No valida el contenido: una fila sin flecha es un error de escritura y se avisa al cargar.
 * @param {string} source texto de la tabla
 * @returns {Array<[string, string]>} pares [castellano, catalán] en el orden escrito
 */
function readTable(source) {
    const rows = []
    for (const line of source.split("\n")) {
        if (line.trim() === "") {
            continue
        }
        if (line.startsWith(CONTINUATION)) {
            rows[rows.length - 1] += " " + line.trim()
            continue
        }
        rows.push(line.trim())
    }
    return rows.map(splitRow)
}

/**
 * Parte una fila por la flecha.
 * @param {string} row fila completa
 * @returns {[string, string]}
 */
function splitRow(row) {
    const cut = row.indexOf(ARROW)
    if (cut < 0) {
        throw new Error("fila del catálogo sin flecha: " + row)
    }
    return [row.slice(0, cut), row.slice(cut + ARROW.length)]
}

/**
 * Escapa los caracteres con significado en una expresión regular.
 * Deja fuera el guion y la barra a propósito: escaparlos rompe las expresiones con la marca u.
 * @param {string} text texto literal
 * @returns {string}
 */
export function escapeRegex(text) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
}

/**
 * Huecos que se pueden escribir en el lado castellano de un patrón y la expresión que ocupan.
 * Todos capturan salvo `{s?}`, que solo admite una "s" opcional (plural escrito a medias).
 */
const SLOTS = new Map([
    ["{n}", "(\\d+)"],
    ["{text}", "(.+)"],
    ["{short}", "(.+?)"],
    ["{word}", "(\\S+)"],
    ["{clock}", "(\\d+:\\d\\d)"],
    ["{result}", "(\\d+-\\d+)"],
    ["{s?}", "s?"],
])

/**
 * Transformaciones que el lado catalán puede pedir para un hueco con `{número:nombre}`.
 * Sin nombre, el valor capturado pasa tal cual.
 */
const FILTERS = {
    t: (value, t) => t(value),
    s: (value) => pluralMark(value),
    signer: (value) => signerPhrase(value),
}

/**
 * Terminación de plural catalana para una cantidad escrita con cifras.
 * @param {string} amount cifra capturada
 * @returns {string} "" para uno, "s" para el resto
 */
function pluralMark(amount) {
    if (amount === "1") {
        return ""
    }
    return "s"
}

/**
 * Quien firma, en catalán y con su preposición y artículo ("del", o "de l'" ante vocal),
 * tal como lo da la tabla de firmantes.
 * @param {string} who firmante tal como lo nombra la pantalla
 * @returns {string}
 */
function signerPhrase(who) {
    return SIGNER_NAMES.get(who) ?? "del " + who
}

/**
 * Convierte el lado castellano de un patrón en una expresión anclada a los dos extremos.
 * Sin marcas a propósito: el punto no casa saltos de línea y se trabaja por unidades UTF-16.
 * @param {string} source texto con huecos
 * @returns {RegExp}
 */
function compileSource(source) {
    let body = ""
    for (const piece of source.split(/(\{[^}]+\})/)) {
        body += SLOTS.get(piece) ?? escapeRegex(piece)
    }
    return new RegExp("^" + body + "$")
}

/**
 * Convierte el lado catalán de un patrón en una función que lo rellena con lo capturado.
 * @param {string} target texto con referencias `{1}`, `{2:t}`…
 * @returns {(found: RegExpMatchArray, t: (text: string) => string) => string}
 */
function compileTarget(target) {
    const pieces = target.split(/\{(\d+)(?::(\w+))?\}/)
    return function fill(found, t) {
        let result = pieces[0]
        for (let at = 1; at < pieces.length; at += 3) {
            const value = found[Number(pieces[at])]
            const filter = FILTERS[pieces[at + 1]]
            if (filter === undefined) {
                result += value
            } else {
                result += filter(value, t)
            }
            result += pieces[at + 2]
        }
        return result
    }
}

/**
 * Textos completos con su traducción. Se consultan con el texto ya sin espacios alrededor.
 * Las filas que repiten el mismo texto en los dos lados son intencionadas: al encontrarse aquí,
 * el texto se queda así y no pasa por los patrones ni por los trozos.
 */
const LITERAL_ROWS = `
    — Texto libre — ⇒ — Text lliure —
    ¿A qué equipo va? ⇒ A quin equip va?
    ¿Confirmas que apruebas y cierras el acta? A partir de ahí no admitirá cambios. ⇒ Confirmes que
        aproves i tanques l'acta? A partir d'aquí no admetrà canvis.
    ¿Falta algún equipo? ⇒ Falta algun equip?
    ¿Quieres eliminar esta acta del dispositivo? ⇒ Vols eliminar aquesta acta del dispositiu?
    ¿Quieres jugar el golden set? Es un set extra de desempate y no altera el resultado de este
        partido. ⇒ Vols jugar el golden set? És un set extra de desempat i no altera el resultat
        d'aquest partit.
    (cualquier jugador fuera de la pista, o nadie para seguir sin líbero) ⇒ (qualsevol jugador fora
        de la pista, o ningú per continuar sense lliure)
    + Añadir jugador ⇒ + Afegeix un jugador
    1er árbitro ⇒ 1r àrbitre
    2º árbitro ⇒ 2n àrbitre
    2º entrenador asistente ⇒ 2n entrenador assistent
    3 (gana el primero en llegar a 2) ⇒ 3 (guanya el primer que n'arriba a 2)
    4, 7 y 9 ⇒ 4, 7 i 9
    5 (gana el primero en llegar a 3) ⇒ 5 (guanya el primer que n'arriba a 3)
    A · Alevín ⇒ A · Aleví
    Abandona el partido ⇒ Abandona el partit
    Abreviatura ⇒ Abreviatura
    Abrir ⇒ Obre
    Acta ⇒ Acta
    Acta aprobada ⇒ Acta aprovada
    Acta electrónica de voleibol ⇒ Acta electrònica de voleibol
    Acta FCVB ⇒ Acta FCVB
    Actas guardadas ⇒ Actes desades
    Actualizar ⇒ Actualitza
    Ahora el sorteo solo corresponde antes del set decisivo. ⇒ Ara el sorteig només correspon abans
        del set decisiu.
    Ahora no ⇒ Ara no
    Ahora no hay ningún líbero en pista. ⇒ Ara no hi ha cap lliure a la pista.
    Amonestación ⇒ Amonestació
    Amonestación por retraso ⇒ Amonestació per retard
    Ampliable a 10 a petición del organizador (FIVB 18.1). ⇒ Ampliable a 10 a petició de
        l'organitzador (FIVB 18.1).
    Anot. asistente ⇒ Anot. assistent
    Anotador ⇒ Anotador
    Anotador asistente ⇒ Anotador assistent
    Antes hay que hacer el sorteo. ⇒ Abans cal fer el sorteig.
    Antes selecciona al jugador que sale. ⇒ Abans selecciona el jugador que surt.
    Añadir ⇒ Afegeix
    Aprobación del acta ⇒ Aprovació de l'acta
    Aprobar y cerrar ⇒ Aprova i tanca
    Atajos de teclado ⇒ Dreceres de teclat
    Atrás ⇒ Enrere
    Aún no hay acciones que deshacer. ⇒ Encara no hi ha accions per desfer.
    Ayuda con el líbero ⇒ Ajuda amb el lliure
    Banquillo ⇒ Banqueta
    Borrar ⇒ Esborra
    Borrar fila ⇒ Esborra la fila
    C · Cadete ⇒ C · Cadet
    Cada equipo debe tener como mínimo 6 jugadores sin contar los líberos. ⇒ Cada equip ha de tenir
        com a mínim 6 jugadors sense comptar els lliures.
    Cancelar ⇒ Cancel·la
    Cap. ⇒ Cap.
    Capitán ⇒ Capità
    Capitán en juego ⇒ Capità en joc
    Capitán local ⇒ Capità local
    Capitán visitante ⇒ Capità visitant
    Cat. ⇒ Cat.
    Categoría ⇒ Categoria
    Categoría inferior ⇒ Categoria inferior
    Categoría inferior según la edad (FCVB, Circular 004) ⇒ Categoria inferior segons l'edat (FCVB,
        Circular 004)
    Cerrar ⇒ Tanca
    Cierre ⇒ Tancament
    CJ ⇒ CJ
    Color ⇒ Color
    Comenzar el golden set ⇒ Comença el golden set
    Comienza el set ⇒ Comença el set
    Competición ⇒ Competició
    Completa el sorteo: saque y lado izquierdo. ⇒ Completa el sorteig: servei i costat esquerre.
    Con las reglas oficiales de la FIVB para 6x6. Funciona sin conexión y guarda todo en tu
        dispositivo. ⇒ Amb les regles oficials de la FIVB per a 6x6. Funciona sense connexió i ho
        desa tot al teu dispositiu.
    Conducta incorrecta · FIVB 21 ⇒ Conducta incorrecta · FIVB 21
    Confirmar ⇒ Confirma
    Confirmar salida ⇒ Confirma la sortida
    Confirmar sustitución ⇒ Confirma la substitució
    Continuar con el sorteo ⇒ Continua amb el sorteig
    Continuar con los equipos ⇒ Continua amb els equips
    Contraseña del 1er árbitro ⇒ Contrasenya del 1r àrbitre
    Contraseña del 1er árbitro incorrecta. ⇒ Contrasenya del 1r àrbitre incorrecta.
    Copia dorsales y nombres de las licencias. Señala al capitán y a los líberos, 2 como máximo. ⇒
        Copia dorsals i noms de les llicències. Assenyala el capità i els lliures, 2 com a màxim.
    Copia dorsales y nombres de las licencias. Señala al capitán; este partido no tiene líbero. ⇒
        Copia dorsals i noms de les llicències. Assenyala el capità; aquest partit no té lliure.
    Correcciones del acta ⇒ Correccions de l'acta
    Correcciones del acta (acciones deshechas en el partido) ⇒ Correccions de l'acta (accions
        desfetes al partit)
    Corregido a mano ⇒ Corregit a mà
    CTA-1 de algunos componentes ⇒ CTA-1 d’alguns components
    CTA-1 de todo el equipo ⇒ CTA-1 de tot l'equip
    Cuando el equipo va a recibir, sugiere por quién puede entrar y, si acaba de sacar el jugador al
        que reemplazaba, propone que vuelva; cuando le toca ir delante, pide confirmar su salida. ⇒
        Quan l'equip va a rebre, suggereix per qui pot entrar i, si acaba de servir el jugador a qui
        substituïa, proposa que torni; quan li toca anar davant, demana confirmar-ne la sortida.
    Cuántos ⇒ Quants
    Cuerpo técnico ⇒ Cos tècnic
    Cumple ⇒ Compleix
    Datos ⇒ Dades
    De acuerdo ⇒ D'acord
    Debe completarse una jugada entre dos reemplazos del líbero. ⇒ S'ha de completar una jugada
        entre dos reemplaçaments del lliure.
    Delegado de equipo ⇒ Delegat d'equip
    Deporte ⇒ Esport
    Descalificación ⇒ Desqualificació
    Descargar una copia del acta ⇒ Baixa una còpia de l'acta
    Deshacer ⇒ Desfés
    Deshacer el último punto ⇒ Desfés l'últim punt
    Desmárcalo si la categoría no usa líbero. ⇒ Desmarca-ho si la categoria no fa servir lliure.
    Detalle del error: el programa del acta no ha llegado a ponerse en marcha (puede que lo bloquee
        el navegador o alguna extensión). ⇒ Detall de l'error: el programa de l'acta no s'ha arribat
        a posar en marxa (potser el bloqueja el navegador o alguna extensió).
    Detalle por sets ⇒ Detall per sets
    DNI que no coincide con la autorización ⇒ DNI que no coincideix amb l'autorització
    Dorsal ⇒ Dorsal
    Dorsal (del 0 al 99, o 00) ⇒ Dorsal (del 0 al 99, o 00)
    Dorsales ⇒ Dorsals
    Duración ⇒ Durada
    Ejemplo ⇒ Exemple
    El acta ha quedado aprobada y cerrada. ⇒ L'acta ha quedat aprovada i tancada.
    El acta se ha reabierto. ⇒ L'acta s'ha reobert.
    El banquillo está vacío. ⇒ La banqueta és buida.
    El capitán en juego solo se designa durante un set. ⇒ El capità en joc només es designa durant
        un set.
    El golden set solo se juega con el partido terminado. ⇒ El golden set només es juga amb el
        partit acabat.
    El líbero no saca: no puede reemplazar al jugador que tiene el saque. ⇒ El lliure no serveix: no
        pot reemplaçar el jugador que té el servei.
    El líbero solo puede entrar durante un set. ⇒ El lliure només pot entrar durant un set.
    El líbero solo reemplaza a zagueros (zonas I, V y VI). ⇒ El lliure només reemplaça zaguers
        (zones I, V i VI).
    El partido ha terminado. ⇒ El partit ha acabat.
    El primer entrenador y hasta 3 personas más. ⇒ El primer entrenador i fins a 3 persones més.
    El primer retraso se sanciona con amonestación por retraso. ⇒ El primer retard se sanciona amb
        amonestació per retard.
    El rival gana punto y saque, y el acta continúa con la rotación correcta. ⇒ El rival guanya punt
        i servei, i l'acta continua amb la rotació correcta.
    El rival se lleva los puntos y sets que le faltan y cada equipo mantiene lo ganado hasta ahora.
        Solo se puede anular con Deshacer. ⇒ El rival s'endú els punts i sets que li falten i cada
        equip manté el que ha guanyat fins ara. Només es pot anul·lar amb Desfés.
    El rival suma punto y saque. ⇒ El rival suma punt i servei.
    El sorteo solo se hace antes del set 1 o del set decisivo. ⇒ El sorteig només es fa abans del
        set 1 o del set decisiu.
    Eliminar ⇒ Elimina
    Empezar en blanco ⇒ Comença en blanc
    en pista ⇒ a la pista
    Encuentro ⇒ Encontre
    Entra ⇒ Entra
    Entrada del líbero ⇒ Entrada del líbero
    Entrenador ⇒ Entrenador
    Entrenador asistente ⇒ Entrenador assistent
    Entrenador local ⇒ Entrenador local
    Entrenador visitante ⇒ Entrenador visitant
    Equipo ⇒ Equip
    Equipo a la izquierda del anotador ⇒ Equip a l'esquerra de l'anotador
    Equipo A: a la izquierda del anotador ⇒ Equip A: a l'esquerra de l'anotador
    Equipo arbitral ⇒ Equip arbitral
    Equipo incompleto o retirada ⇒ Equip incomplet o retirada
    Equipo mostrado ⇒ Equip mostrat
    Equipos ⇒ Equips
    Ese líbero ya se encuentra en pista. ⇒ Aquest lliure ja és a la pista.
    Ese set no llegó a jugarse. ⇒ Aquest set no es va arribar a jugar.
    Espectadores ⇒ Espectadors
    Esta acta ya está aprobada y cerrada; no admite cambios. ⇒ Aquesta acta ja està aprovada i
        tancada; no admet canvis.
    Estado ⇒ Estat
    Este equipo no tiene capitán inscrito en el acta. ⇒ Aquest equip no té capità inscrit a l'acta.
    Este equipo ya fue amonestado: la próxima conducta incorrecta se sanciona con penalización. ⇒
        Aquest equip ja ha estat amonestat: la pròxima conducta incorrecta se sanciona amb
        penalització.
    Este equipo ya tiene amonestación por retraso: el próximo retraso es penalización por retraso. ⇒
        Aquest equip ja té amonestació per retard: el pròxim retard és penalització per retard.
    Este partido se juega sin líbero. ⇒ Aquest partit es juga sense lliure.
    Este set ya ha comenzado. ⇒ Aquest set ja ha començat.
    Este set ya se está jugando. ⇒ Aquest set ja s'està jugant.
    Exportar datos (JSON) ⇒ Exporta les dades (JSON)
    Expulsión ⇒ Expulsió
    Falta ⇒ Falta
    Falta de rotación (o error de orden de saque) ⇒ Falta de rotació (o error d'ordre de servei)
    Falta de rotación registrada: punto para el rival. ⇒ Falta de rotació registrada: punt per al
        rival.
    Falta el nombre de quien firma. ⇒ Falta el nom de qui signa.
    Falta indicar el equipo. ⇒ Falta indicar l'equip.
    Falta la firma ⇒ Falta la signatura
    Falta la firma en el recuadro. ⇒ Falta la signatura al requadre.
    Falta un archivo: ⇒ Falta un fitxer:
    Faltan las formaciones iniciales. ⇒ Falten les formacions inicials.
    Faltan los nombres de los equipos. ⇒ Falten els noms dels equips.
    Fecha ⇒ Data
    Fin ⇒ Final
    Final ⇒ Final
    Firmar ⇒ Signa
    Firmas ⇒ Signatures
    Firmas previas al partido ⇒ Signatures prèvies al partit
    Fisioterapeuta ⇒ Fisioterapeuta
    Formación inicial ⇒ Formació inicial
    Formato ⇒ Format
    Fotografía por falta de documento ⇒ Fotografia per manca de document
    Frase tipo (FCVB, Circular 010) ⇒ Frase tipus (FCVB, Circular 010)
    Ganador ⇒ Guanyador
    Guardar ⇒ Desa
    Ha surgido un problema ⇒ Hi ha hagut un problema
    Hay que confirmarla para seguir: queda apuntada en el acta con el marcador actual. Si el último
        punto estaba mal, deshazlo. FIVB 19.3.1.3. ⇒ Cal confirmar-la per continuar: queda anotada a
        l'acta amb el marcador actual. Si l'últim punt estava malament, desfés-lo. FIVB 19.3.1.3.
    Herramientas ⇒ Eines
    Historial ⇒ Historial
    Hora ⇒ Hora
    I · Infantil ⇒ I · Infantil
    Importar archivo de acta (JSON) ⇒ Importa un fitxer d'acta (JSON)
    Imprimir o exportar a PDF ⇒ Imprimeix o exporta a PDF
    Incapacitado para jugar… ⇒ Incapacitat per jugar…
    Incidencias ⇒ Incidències
    Incomparecencia ⇒ Incompareixença
    Incomparecencia… ⇒ Incompareixença…
    Indica a quién va la sanción. ⇒ Indica a qui va la sanció.
    Indica qué equipo ha cometido la falta. ⇒ Indica quin equip ha comès la falta.
    Indica qué equipo saca. ⇒ Indica quin equip serveix.
    Infantil (FCVB, Circular 011): todos los jugadores inscritos deben jugar como mínimo un set
        entero. Se comprueba al final y admite correcciones manuales. ⇒ Infantil (FCVB, Circular
        011): tots els jugadors inscrits han de jugar com a mínim un set sencer. Es comprova al
        final i admet correccions manuals.
    Inicio ⇒ Inici
    Inscrito que no se presenta ⇒ Inscrit que no es presenta
    J · Juvenil ⇒ J · Juvenil
    Jueces de línea ⇒ Jutges de línia
    Juez de línea 1 ⇒ Jutge de línia 1
    Juez de línea 2 ⇒ Jutge de línia 2
    Jugada repetida: nadie suma punto. ⇒ Jugada repetida: ningú no suma punt.
    Jugador ⇒ Jugador
    La aplicación no ha podido arrancar ⇒ L'aplicació no ha pogut arrencar
    La formación inicial debe tener 6 jugadores. ⇒ La formació inicial ha de tenir 6 jugadors.
    La plantilla la firman el capitán y el entrenador de cada equipo. ⇒ La plantilla la signen el
        capità i l'entrenador de cada equip.
    La reapertura constará en las correcciones del acta. ⇒ La reobertura constarà a les correccions
        de l'acta.
    La red queda arriba. La zona I (zaguero derecho) es la del saque. ⇒ La xarxa queda a dalt. La
        zona I (zaguer dret) és la del servei.
    La repetición de la jugada solo se anota durante un set. ⇒ La repetició de la jugada només
        s'anota durant un set.
    Las sustituciones solo se pueden hacer durante un set. ⇒ Les substitucions només es poden fer
        durant un set.
    Lesión ⇒ Lesió
    Lesionado antes del partido ⇒ Lesionat abans del partit
    Líbero ⇒ Líbero
    Líbero incapacitado ⇒ Lliure incapacitat
    Líbero incapacitado para jugar… ⇒ Lliure incapacitat per jugar…
    Licencia ⇒ Llicència
    Limpiar ⇒ Neteja
    Listo: emPat ya se puede usar sin conexión. ⇒ Fet: emPat ja es pot fer servir sense connexió.
    Local ⇒ Local
    Los puntos que sumó desde ese momento se anulan (FIVB 7.7.2). Si lo dejas vacío, solo se da
        punto y saque al rival. ⇒ Els punts que va sumar des d'aquell moment s'anul·len (FIVB
        7.7.2). Si ho deixes buit, només es dona punt i servei al rival.
    Los tiempos de descanso solo se conceden durante un set. ⇒ Els temps morts només es concedeixen
        durant un set.
    Marcador ⇒ Marcador
    Marcador del equipo infractor al cometerla (si se conoce) ⇒ Marcador de l'equip infractor quan
        la va cometre (si se sap)
    Masajista ⇒ Massatgista
    Médico ⇒ Metge
    Mesa del anotador ⇒ Taula de l'anotador
    Min. ⇒ Min.
    Minutos de intervalo entre sets ⇒ Minuts d'interval entre sets
    Minutos de intervalo tras el 2º set ⇒ Minuts d'interval després del 2n set
    Minutos de retraso ⇒ Minuts de retard
    Mis actas ⇒ Les meves actes
    Modelo FCVB en A4 horizontal. Imprime sin márgenes y al 100 % (tamaño real). ⇒ Model FCVB en A4
        horitzontal. Imprimeix sense marges i al 100 % (mida real).
    Nadie ⇒ Ningú
    NO ⇒ NO
    Nº de partido ⇒ Núm. de partit
    No hay ningún set en juego. ⇒ No hi ha cap set en joc.
    No juega el mínimo de sets ⇒ No juga el mínim de sets
    No juega lo que queda de partido; debe ser sustituido. ⇒ No juga el que queda de partit; ha de
        ser substituït.
    No juega lo que queda de set; debe ser sustituido. ⇒ No juga el que queda de set; ha de ser
        substituït.
    No queda nada por deshacer. ⇒ No queda res per desfer.
    No se ha encontrado el acta. ⇒ No s'ha trobat l'acta.
    No se ha perdido nada: las actas siguen en el dispositivo. ⇒ No s'ha perdut res: les actes
        continuen al dispositiu.
    No se han podido guardar los cambios en este dispositivo. ⇒ No s'han pogut desar els canvis en
        aquest dispositiu.
    Nombre ⇒ Nom
    Nombre del equipo ⇒ Nom de l'equip
    Nombre y apellidos ⇒ Nom i cognoms
    Nueva acta ⇒ Acta nova
    Nueva observación ⇒ Nova observació
    Nueva versión de emPat disponible. ⇒ Nova versió d'emPat disponible.
    Nuevo líbero (re-designación) ⇒ Nou lliure (re-designació)
    Número de espectadores ⇒ Nombre d'espectadors
    Número de espectadores guardado. ⇒ Nombre d'espectadors desat.
    Número de sets ⇒ Nombre de sets
    Observación ⇒ Observació
    Observación guardada en el acta. ⇒ Observació desada a l'acta.
    Observaciones ⇒ Observacions
    Orden de firma: anotador y asistente, capitanes, 2º árbitro y, por último, 1er árbitro (FIVB
        27.2.3.3). ⇒ Ordre de signatura: anotador i assistent, capitans, 2n àrbitre i, per acabar,
        1r àrbitre (FIVB 27.2.3.3).
    Otros miembros del cuerpo técnico ⇒ Altres membres del cos tècnic
    Pabellón ⇒ Pavelló
    Para retrasos, incidencias, lesiones… Queda en el acta junto con la hora. ⇒ Per a retards,
        incidències, lesions… Queda a l'acta juntament amb l'hora.
    Parciales ⇒ Parcials
    Partido ⇒ Partit
    Partido de ejemplo creado. Ahora, sorteo y formación inicial. ⇒ Partit d'exemple creat. Ara,
        sorteig i formació inicial.
    Penalización ⇒ Penalització
    Penalización por retraso ⇒ Penalització per retard
    Pendiente de aprobación ⇒ Pendent d'aprovació
    Población ⇒ Població
    Por ahora no hay forma de enviarla a la FCVB, que aún no dispone de un sistema para recibirla.
        Mientras tanto, imprímela o guárdala como PDF. ⇒ De moment no hi ha manera d'enviar-la a la
        FCVB, que encara no disposa d'un sistema per rebre-la. Mentrestant, imprimeix-la o desa-la
        com a PDF.
    Por empezar ⇒ Per començar
    Por lesión, enfermedad, expulsión, descalificación o decisión del entrenador (FIVB 19.4.1). Un
        líbero incapacitado no puede volver a jugar en este partido. ⇒ Per lesió, malaltia,
        expulsió, desqualificació o decisió de l'entrenador (FIVB 19.4.1). Un lliure incapacitat no
        pot tornar a jugar en aquest partit.
    Preparador físico ⇒ Preparador físic
    Primer saque ⇒ Primer servei
    Primero sustituye al jugador expulsado o descalificado. ⇒ Primer substitueix el jugador expulsat
        o desqualificat.
    Probar con un partido de ejemplo ⇒ Prova amb un partit d'exemple
    Progreso del acta ⇒ Progrés de l'acta
    Protocolo de recogepelotas (Circular 012) ⇒ Protocol d'aplega pilotes (Circular 012)
    Psicólogo ⇒ Psicòleg
    Pulsación doble: solo se ha sumado un punto. ⇒ Doble pulsació: només s'ha sumat un punt.
    Punto ⇒ Punt
    Puntos ⇒ Punts
    Puntos en el set decisivo ⇒ Punts al set decisiu
    Puntos para ganar un set ⇒ Punts per guanyar un set
    Queda registrada sin sanción; si el equipo reincide en el partido, se considera retraso (FIVB
        15.11.3). ⇒ Queda registrada sense sanció; si l'equip reincideix en el partit, es considera
        retard (FIVB 15.11.3).
    Quedan huecos sin rellenar (___). ¿La añado así? ⇒ Queden buits per omplir (___). L'afegeixo
        així?
    Quién ⇒ Qui
    Reabrir ⇒ Reobre
    Reabrir (solo el 1er árbitro) ⇒ Reobre (només el 1r àrbitre)
    Reapertura del acta ⇒ Reobertura de l'acta
    Recargar desde cero ⇒ Recarrega des de zero
    Recuadro de firma ⇒ Requadre de signatura
    Red ⇒ Xarxa
    Reemplaza a (solo zagueros) ⇒ Reemplaça (només zaguers)
    Registrado. ⇒ Registrat.
    Registrar ⇒ Registra
    Registro de todo lo que se ha deshecho en el partido. Forma parte del acta y no se puede
        eliminar. ⇒ Registre de tot el que s'ha desfet al partit. Forma part de l'acta i no es pot
        eliminar.
    Reglas del partido ⇒ Regles del partit
    Regresa el jugador al que reemplazaba, que es el único que puede ocupar su sitio (aparte del
        otro líbero, que tampoco puede jugar en la zona delantera). FIVB 19.3.2. ⇒ Torna el jugador
        a qui reemplaçava, que és l'únic que pot ocupar el seu lloc (a banda de l'altre lliure, que
        tampoc no pot jugar a la zona davantera). FIVB 19.3.2.
    Reintentar ⇒ Torna-ho a provar
    Reloj del set ⇒ Rellotge del set
    Repetir firma ⇒ Signa de nou
    Repetir jugada ⇒ Repeteix la jugada
    Resumen ⇒ Resum
    Retraso: partido de otro deporte ⇒ Retard: partit d'un altre esport
    Retraso: partido escolar anterior ⇒ Retard: partit escolar anterior
    Retraso: partido federado anterior ⇒ Retard: partit federat anterior
    Retraso: un equipo llega tarde ⇒ Retard: un equip arriba tard
    Retrasos · FIVB 16 ⇒ Retards · FIVB 16
    Revisa primero el acta con «Revisar e imprimir». Una vez aprobada queda cerrada: ya no se anota
        ni se deshace nada, aunque las firmas sí se pueden rehacer. Contraseña de prueba para todos:
        0000. ⇒ Revisa primer l'acta amb «Revisa i imprimeix». Un cop aprovada queda tancada: ja no
        s'hi anota ni es desfà res, tot i que les signatures sí que es poden refer. Contrasenya de
        prova per a tothom: 0000.
    Revisar e imprimir ⇒ Revisa i imprimeix
    Saca ⇒ Serveix
    Sale ⇒ Surt
    Salida del líbero ⇒ Sortida del lliure
    Sí, entra el líbero ⇒ Sí, entra el lliure
    Sanción ⇒ Sanció
    Sancionado ⇒ Sancionat
    Sanciones ⇒ Sancions
    Saque ⇒ Servei
    Se acabó el tiempo de descanso. ⇒ S'ha acabat el temps mort.
    Se anota en observaciones, sin DNI (FCVB, Circular 003). ⇒ S'anota a observacions, sense DNI
        (FCVB, Circular 003).
    Se ha importado el acta. ⇒ S'ha importat l'acta.
    Se juega con líbero ⇒ Es juga amb lliure
    Se marcan solos los titulares que han jugado el set entero sin ser sustituidos. Si un caso debe
        contar distinto (por ejemplo, un cambio especial), corrígelo con la casilla y quedará
        señalado con ✎. ⇒ Es marquen sols els titulars que han jugat el set sencer sense ser
        substituïts. Si un cas ha de comptar diferent (per exemple, un canvi especial), corregeix-lo
        amb la casella i quedarà assenyalat amb ✎.
    Se repite la jugada ⇒ Es repeteix la jugada
    Seguir con el partido ⇒ Continua amb el partit
    Set completo obligatorio ⇒ Set complet obligatori
    Sets ganados ⇒ Sets guanyats
    Sí ⇒ Sí
    Si dejas la abreviatura vacía, se usa la propuesta (lista FCVB 26-27). ⇒ Si deixes l'abreviatura
        buida, s'usa la proposada (llista FCVB 26-27).
    Si un equipo no comparece, pierde el partido por 0-3 y cada set por 0-25, y así consta en el
        acta (FIVB 6.4). ⇒ Si un equip no compareix, perd el partit per 0-3 i cada set per 0-25, i
        així consta a l'acta (FIVB 6.4).
    Sin observaciones. ⇒ Sense observacions.
    Sin set completo todavía ⇒ Encara sense set complet
    Solicitud improcedente ⇒ Sol·licitud improcedent
    Solicitudes improcedentes · FIVB 15.11 ⇒ Sol·licituds improcedents · FIVB 15.11
    Solo es posible durante el partido. ⇒ Només és possible durant el partit.
    Solo se puede anotar durante un set. ⇒ Només es pot anotar durant un set.
    Sorteo ⇒ Sorteig
    Sorteo para el set decisivo ⇒ Sorteig per al set decisiu
    Sorteo y formación ⇒ Sorteig i formació
    Sorteos ⇒ Sorteigs
    Sustitución ⇒ Substitució
    Sustitución excepcional: por lesión, enfermedad, expulsión o descalificación cuando no cabe una
        sustitución regular ⇒ Substitució excepcional: per lesió, malaltia, expulsió o
        desqualificació quan no és possible una substitució regular
    Sustituciones ⇒ Substitucions
    Sustituciones en cada set ⇒ Substitucions a cada set
    Texto ⇒ Text
    Tiempo ⇒ Temps
    Tiempo de descanso ⇒ Temps mort
    Tiempos ⇒ Temps morts
    Tiempos de descanso ⇒ Temps morts
    Tiempos de descanso en cada set ⇒ Temps morts a cada set
    Tipo ⇒ Tipus
    Titular ⇒ Titular
    Todavía no has guardado ninguna acta. ⇒ Encara no has desat cap acta.
    Todo el equipo cumple: cada jugador tiene al menos un set completo. ⇒ Tot l'equip compleix: cada
        jugador té com a mínim un set complet.
    Todos lo cumplen ✓ ⇒ Tots ho compleixen ✓
    Total ⇒ Total
    Última acción: ⇒ Última acció:
    Un líbero no entra por sustitución, sino con un reemplazo del líbero. ⇒ Un lliure no entra per
        substitució, sinó amb un reemplaçament del lliure.
    Un mismo dorsal aparece dos veces en la formación inicial. ⇒ Un mateix dorsal apareix dues
        vegades a la formació inicial.
    Uniformidad: camiseta diferente ⇒ Uniformitat: samarreta diferent
    Uniformidad: dorsal con esparadrapo ⇒ Uniformitat: dorsal amb esparadrap
    Uniformidad: líberos con colores invertidos ⇒ Uniformitat: líberos amb colors invertits
    Úsalo solo para desempatar, por ejemplo una eliminatoria a doble partido que acaba igualada. Es
        un set extra a 15 puntos, con sorteo, que no altera el resultado de este partido. ⇒ Fes-lo
        servir només per desempatar, per exemple una eliminatòria a doble partit que acaba igualada.
        És un set extra a 15 punts, amb sorteig, que no altera el resultat d'aquest partit.
    Ver el acta ⇒ Mostra l'acta
    Visitante ⇒ Visitant
    Volver ⇒ Torna
    Vuelta del líbero ⇒ Tornada del lliure
    Volver atrás un punto ⇒ Torna enrere un punt
    X: set entero como titular sin ser sustituido · *: corrección manual del anotador. ⇒ X: set
        sencer com a titular sense ser substituït · *: correcció manual de l'anotador.
    Y · Júnior ⇒ Y · Júnior
    Ya hay un líbero en pista: sácalo antes o cámbialo directamente por el otro líbero. ⇒ Ja hi ha
        un lliure a la pista: fes-lo sortir abans o canvia'l directament per l'altre lliure.
    Ya se ha jugado el golden set. ⇒ Ja s'ha jugat el golden set.
`

/**
 * Trozos que se cambian dentro de cualquier texto, siempre como palabras completas. Están ya
 * de más largo a más corto (a igual longitud, en el orden de la tabla), para que un trozo
 * largo se aplique primero y uno más corto contenido en él no lo parta.
 */
const FRAGMENT_ROWS = `
    Con el partido empezado, las plantillas ya no se pueden modificar. ⇒ Amb el partit començat, les
        plantilles ja no es poden modificar.
    Además del primer entrenador, solo se admiten 3 oficiales más. ⇒ A més del primer entrenador,
        només s'admeten 3 oficials més.
    se necesitan como mínimo 6 jugadores sin contar los líberos ⇒ calen com a mínim 6 jugadors sense
        comptar els lliures
    No se ha perdido nada: los datos siguen en el dispositivo. ⇒ No s'ha perdut res: les dades
        continuen al dispositiu.
    Esta versión de la aplicación no puede mostrar el acta. ⇒ Aquesta versió de l'aplicació no pot
        mostrar l'acta.
    Dorsales incorrectos guardados con otra versión ⇒ Dorsals incorrectes desats amb una altra
        versió
    los puntos y sets que faltan son para el rival ⇒ els punts i sets que falten són per al rival
    Corrígelos (0-99 o 00) o borra la fila con ✕ ⇒ Corregeix-los (0-99 o 00) o esborra la fila amb ✕
    El formato de este partido no tiene líbero. ⇒ El format d'aquest partit no té lliure.
    Acta reabierta; llevaba aprobada desde las ⇒ Acta reoberta; estava aprovada des de les
    La aplicación tarda demasiado en cargar. ⇒ L'aplicació triga massa a carregar.
    Algo ha fallado al cargar la aplicación. ⇒ Alguna cosa ha fallat en carregar l'aplicació.
    Hay dos jugadores con el mismo dorsal. ⇒ Hi ha dos jugadors amb el mateix dorsal.
    el contenido no corresponde a un acta ⇒ el contingut no correspon a una acta
    Pon el dorsal o borra la fila con ✕ ⇒ Posa el dorsal o esborra la fila amb ✕
    No puede haber más de 2 líberos. ⇒ No hi pot haver més de 2 lliures.
    se le anulan los puntos desde el ⇒ se li anul·len els punts des del
    Pendiente para el inicio del set ⇒ Pendent per a l'inici del set
    Usa un número del 0 al 99, o 00 ⇒ Fes servir un número del 0 al 99, o 00
    Categoría incorrecta para el ⇒ Categoria incorrecta per al
    Esta versión no sabe abrirla ⇒ Aquesta versió no la sap obrir
    Tipo de jugada no reconocido ⇒ Tipus de jugada no reconegut
    puntos desde que la cometió ⇒ punts des que la va cometre
    designa capitán en juego al ⇒ designa capità en joc el
    nuevo líbero re-designado ⇒ nou lliure re-designat
    Penalización por retraso ⇒ Penalització per retard
    penalización por retraso ⇒ penalització per retard
    Amonestación por retraso ⇒ Amonestació per retard
    comete falta de rotación ⇒ comet falta de rotació
    Set completo obligatorio ⇒ Set complet obligatori
    Sustitución excepcional ⇒ Substitució excepcional
    falta marcar al capitán ⇒ falta marcar el capità
    pide tiempo de descanso ⇒ demana temps mort
    incapacitado para jugar ⇒ incapacitat per jugar
    Marca un solo capitán. ⇒ Marca un sol capità.
    Solicitud improcedente ⇒ Sol·licitud improcedent
    cambio de campo a los ⇒ canvi de camp als
    jugadores como máximo ⇒ jugadors com a màxim
    Entrenador visitante ⇒ Entrenador visitant
    elige Y, J, C, I o A ⇒ tria Y, J, C, I o A
    el partido ha durado ⇒ el partit ha durat
    pulsa para cambiarlo ⇒ prem per canviar-lo
    punto para el rival ⇒ punt per al rival
    se repite la jugada ⇒ es repeteix la jugada
    Resumen del partido ⇒ Resum del partit
    Se repite la jugada ⇒ Es repeteix la jugada
    Se desmarca el set ⇒ Es desmarca el set
    Partido de ejemplo ⇒ Partit d'exemple
    falta de rotación ⇒ falta de rotació
    equipo incompleto ⇒ equip incomplet
    Capitán visitante ⇒ Capità visitant
    Dorsal incorrecto ⇒ Dorsal incorrecte
    dorsal incorrecto ⇒ dorsal incorrecte
    líberos incluidos ⇒ lliures inclosos
    Detalle del error ⇒ Detall de l'error
    preparador físico ⇒ preparador físic
    Formación inicial ⇒ Formació inicial
    Equipo incompleto ⇒ Equip incomplet
    capitán en juego ⇒ capità en joc
    no puede seguir ⇒ no pot continuar
    Descalificación ⇒ Desqualificació
    Incomparecencia ⇒ Incompareixença
    Se marca el set ⇒ Es marca el set
    Comienza el set ⇒ Comença el set
    El acta admite ⇒ L'acta admet
    La ha cometido ⇒ L'ha comesa
    al entrenador ⇒ a l'entrenador
    Capitán local ⇒ Capità local
    por el líbero ⇒ pel líbero
    2º entrenador ⇒ 2n entrenador
    como completo ⇒ com a complet
    Amonestación ⇒ Amonestació
    Penalización ⇒ Penalització
    penalización ⇒ penalització
    se le anulan ⇒ se li anul·len
    no comparece ⇒ no compareix
    Sustitución ⇒ Substitució
    Observación ⇒ Observació
    punto para ⇒ punt per a
    incompleto ⇒ incomplet
    (decisivo) ⇒ (decisiu)
    sin dorsal ⇒ sense dorsal
    sin nombre ⇒ sense nom
    Punto para ⇒ Punt per a
    al equipo ⇒ a l'equip
    Expulsión ⇒ Expulsió
    cambiarlo ⇒ canviar-lo
    Visitante ⇒ Visitant
    en blanco ⇒ en blanc
    asistente ⇒ assistent
    psicólogo ⇒ psicòleg
    masajista ⇒ massatgista
    izquierda ⇒ esquerra
    completo ⇒ complet
    (recibe) ⇒ (rep)
    decisivo ⇒ decisiu
    Comienzo ⇒ Començament
    (previa) ⇒ (prèvia)
    saque de ⇒ servei de
    Sanción ⇒ Sanció
    ya jugó ⇒ ja va jugar
    ganador ⇒ guanyador
    cambiar ⇒ canviar
    Sorteo ⇒ Sorteig
    Cambio ⇒ Canvi
    Tiempo ⇒ Temps
    Inicio ⇒ Inici
    (saca) ⇒ (serveix)
    inicio ⇒ inici
    por el ⇒ pel
    médico ⇒ metge
    Punto ⇒ Punt
    salió ⇒ va sortir
    Firma ⇒ Signatura
    sale ⇒ surt
    saca ⇒ serveix
    Sale ⇒ Surt
    fin ⇒ final
    por ⇒ per
`

/**
 * Frases con datos. Se prueban en este orden y gana la primera que encaja. En el lado
 * castellano, los huecos son `{n}` (cifras), `{text}` (cualquier cosa), `{short}` (lo mínimo),
 * `{word}` (sin espacios), `{clock}` (m:ss), `{result}` (marcador) y `{s?}` (plural opcional).
 * En el catalán, `{1}` repite el primer hueco; `{1:t}` lo traduce a su vez; `{1:s}` pone la
 * "s" de plural según la cifra; `{1:signer}` nombra al firmante.
 * Una frase con un trozo opcional se escribe dos veces, primero con el trozo: es el mismo
 * orden en que lo probaría una expresión con alternativa.
 */
const PATTERN_ROWS = `
    Sets ganados: {n} ⇒ Sets guanyats: {1}
    · {text} ⇒ · {1:t}
    {n} inscrito{s?} ⇒ {1} inscrit{1:s}
    Tipo de jugada no reconocido: {text} ⇒ Tipus de jugada no reconegut: {1}
    El {word} es líbero y no puede formar parte de la formación inicial. ⇒ El {1} és lliure i no pot
        formar part de la formació inicial.
    El {word} no está autorizado a jugar. ⇒ El {1} no està autoritzat a jugar.
    El {word} no está autorizado a entrar. ⇒ El {1} no està autoritzat a entrar.
    El líbero {word} no está autorizado a jugar. ⇒ El lliure {1} no està autoritzat a jugar.
    El {word} no figura en el acta. ⇒ El {1} no figura a l'acta.
    El {word} no figura como líbero en el acta. ⇒ El {1} no figura com a lliure a l'acta.
    El {word} no se encuentra en pista. ⇒ El {1} no és a la pista.
    El {word} ya se encuentra en pista. ⇒ El {1} ja és a la pista.
    El {word} está reemplazado por el líbero: antes debe salir el líbero. ⇒ El {1} està reemplaçat
        pel lliure: abans ha de sortir el lliure.
    El {word} ya no puede jugar más en este partido. ⇒ El {1} ja no pot jugar més en aquest partit.
    El {word} está expulsado hasta el final del set. ⇒ El {1} està expulsat fins al final del set.
    El {word} ya ha salido y regresado en este set: no puede salir otra vez. ⇒ El {1} ja ha sortit i
        tornat en aquest set: no pot tornar a sortir.
    El {word} es titular: solo regresa a pista por el suplente que lo sustituyó. ⇒ El {1} és
        titular: només torna a la pista pel suplent que el va substituir.
    El {word} ya ha jugado en este set: solo puede volver a entrar por el mismo titular al que
        sustituyó. ⇒ El {1} ja ha jugat en aquest set: només pot tornar a entrar pel mateix titular
        a qui va substituir.
    El {word} no puede salir mediante una sustitución regular. ⇒ El {1} no pot sortir mitjançant una
        substitució regular.
    Al {word} solo lo puede relevar el {word}, el titular al que sustituyó. ⇒ Al {1} només el pot
        rellevar el {2}, el titular a qui va substituir.
    El {word} no es un líbero. ⇒ El {1} no és un lliure.
    El {word} ya no participa en el partido. ⇒ El {1} ja no participa en el partit.
    El {word} ya es líbero: no hay que volver a designarlo. ⇒ El {1} ja és lliure: no cal tornar-lo
        a designar.
    El {word} está en pista: para re-designarlo como líbero tiene que estar fuera. ⇒ El {1} és a la
        pista: per re-designar-lo com a lliure ha d'estar fora.
    Aún queda el otro líbero, el {word}: solo se puede re-designar si él tampoco puede jugar (FIVB
        19.4.3.1). ⇒ Encara queda l'altre lliure, el {1}: només es pot re-designar si ell tampoc no
        pot jugar (FIVB 19.4.3.1).
    Ya ha agotado las {n} sustituciones del set. ⇒ Ja ha esgotat les {1} substitucions del set.
    Ya ha agotado los {n} tiempos de descanso del set. ⇒ Ja ha esgotat els {1} temps morts del set.
    El capitán ({word}) está en pista, así que él es el capitán en juego. ⇒ El capità ({1}) és a la
        pista, així que ell és el capità en joc.
    Los puntos del equipo infractor al cometer la falta deben estar entre 0 y {n}. ⇒ Els punts de
        l'equip infractor quan va cometre la falta han d'estar entre 0 i {1}.
    No se ha podido importar el archivo: {text} ⇒ No s'ha pogut importar el fitxer: {1:t}
    ¿Quieres deshacer "{text}"? ⇒ Vols desfer "{1:t}"?
    Se ha deshecho: {text} ⇒ S'ha desfet: {1:t}
    Último tiempo de descanso del set para {text} (n.º {n}). ⇒ Últim temps mort del set per a {1}
        (núm. {2}).
    Última sustitución del set para {text} (n.º {n}). ⇒ Última substitució del set per a {1} (núm.
        {2}).
    {text} ya lleva {n} sustituciones en este set. ⇒ {1} ja porta {2} substitucions en aquest set.
    {text}: el capitán ({word}) está fuera de la pista; designa al capitán en juego. ⇒ {1}: el
        capità ({2}) és fora de la pista; designa el capità en joc.
    Terminado {result} ⇒ Acabat {1}
    En curso · sets {result} ⇒ En curs · sets {1}
    La formación inicial de {text} está incompleta. ⇒ La formació inicial de {1} està incompleta.
    Comenzar set {n} ⇒ Comença el set {1}
    El {word} pasa a ser capitán en juego. ⇒ El {1} passa a ser capità en joc.
    El {word} pasa a ser líbero. ⇒ El {1} passa a ser lliure.
    Capitán ({word}) fuera de la pista. Elige capitán en juego: ⇒ Capità ({1}) fora de la pista.
        Tria capità en joc:
    ¿Por quién entra el líbero {word}? ⇒ Per qui entra el lliure {1}?
    Sustitución obligatoria: {text} ⇒ Substitució obligatòria: {1}
    El intervalo terminó hace {clock} ⇒ L'interval va acabar fa {1}
    Quedan {clock} de intervalo ⇒ Queden {1} d'interval
    Golden set · partido terminado {result} ⇒ Golden set · partit acabat {1}
    Set {n} para {text}, {result} ⇒ Set {1} per a {2}, {3}
    Set de desempate a {n} puntos, con sorteo y cambio de campo cuando un equipo alcanza {n}. El
        resultado del partido se mantiene. ⇒ Set de desempat a {1} punts, amb sorteig i canvi de
        camp quan un equip arriba a {2}. El resultat del partit es manté.
    Set decisivo a {n} puntos, con sorteo y cambio de campo cuando un equipo alcanza {n}. ⇒ Set
        decisiu a {1} punts, amb sorteig i canvi de camp quan un equip arriba a {2}.
    Se cambia de campo y empieza sacando {text}. ⇒ Es canvia de camp i comença servint {1}.
    Contraseña · {text} ⇒ Contrasenya · {1:t}
    Contraseña del {text} incorrecta. ⇒ Contrasenya {1:signer} incorrecta.
    Victoria de {text}, {result} ⇒ Victòria de {1}, {2}
    Por incomparecencia de {text}. ⇒ Per incompareixença de {1}.
    Equipo incompleto: {text} en el set {n} ({result}). ⇒ Equip incomplet: {1} al set {2} ({3}).
    Jugadores sin set completo: {text} ⇒ Jugadors sense set complet: {1}
    El anotador, los capitanes y el 1er árbitro la aprobaron el {short}. Desde entonces no se puede
        anotar ni deshacer nada. ⇒ L'anotador, els capitans i el 1r àrbitre la van aprovar el {1}.
        Des d'aleshores no s'hi pot anotar ni desfer res.
    Aprobada el {short} por anotador, capitanes y 1er árbitro ⇒ Aprovada el {1} per l'anotador, els
        capitans i el 1r àrbitre
    Resumen generado con emPat el {short}. No es un documento oficial. ⇒ Resum generat amb emPat el
        {1}. No és un document oficial.
    Incomparecencia de {text}: partido 0-3 con todos los sets 0-25. ⇒ Incompareixença de {1}: partit
        0-3 amb tots els sets 0-25.
    Jugadores cadetes inscritos por {text}: {text}. ⇒ Jugadors cadets inscrits per {1}: {2}.
    Delegado/a de {text}: {text}. ⇒ Delegat/da de {1}: {2}.
    Al mejor de {n} ⇒ Al millor de {1}
    Falta de rotación registrada: punto para el rival (puntos anulados: {n}). ⇒ Falta de rotació
        registrada: punt per al rival (punts anul·lats: {1}).
    ¿Confirmas que {text} no puede continuar, por equipo incompleto o retirada? El partido terminará
        aquí. ⇒ Confirmes que {1} no pot continuar, per equip incomplet o retirada? El partit
        acabarà aquí.
    {text} no tiene ningún líbero disponible. ⇒ {1} no té cap lliure disponible.
    Cambiar por el otro líbero ({word}) ⇒ Canvia per l'altre lliure ({1})
    Sacar al líbero; vuelve el {word} ⇒ Fes sortir el lliure; torna el {1}
    Está en pista el {word}, en lugar del {word}. ⇒ És a la pista el {1}, en lloc del {2}.
    : el líbero {word} rota a la zona IV y debe salir. ⇒ : el lliure {1} rota a la zona IV i ha de
        sortir.
    El líbero {word} ha rotado a la zona IV y tiene que salir. ⇒ El lliure {1} ha rotat a la zona IV
        i ha de sortir.
    El líbero {word} ha rotado a la zona IV: tiene que salir y vuelve el {word}. ⇒ El lliure {1} ha
        rotat a la zona IV: ha de sortir i torna el {2}.
    El líbero {word} ha rotado a la delantera: antes de seguir, apunta su salida. ⇒ El lliure {1} ha
        rotat a la davantera: abans de continuar, anota'n la sortida.
    Ha sacado el {word} y el equipo ha perdido el saque. ⇒ Ha servit el {1} i l'equip ha perdut el
        servei.
    ¿Entra el líbero {word} por el {word}? ⇒ Entra el lliure {1} pel {2}?
    Queda disponible el otro líbero, el {word}. ⇒ Queda disponible l'altre lliure, el {1}.
    Firma · {text} ⇒ Signatura · {1:t}
    Ningún suplente puede relevar al {word} con una sustitución regular. ⇒ Cap suplent no pot
        rellevar el {1} amb una substitució regular.
    Sustituciones usadas en el set: {n} de {n}. ⇒ Substitucions fetes al set: {1} de {2}.
    {n} de {n} en este set (último) · {text} ⇒ {1} de {2} en aquest set (l'últim) · {3}
    {n} de {n} en este set · {text} ⇒ {1} de {2} en aquest set · {3}
    {text} · Equipo ⇒ {1:t} · Equip
`

/** Firmantes tal como salen en el aviso de contraseña incorrecta. */
const SIGNER_ROWS = `
    anotador ⇒ de l'anotador
    capitán local ⇒ del capità local
    capitán visitante ⇒ del capità visitant
    1er árbitro ⇒ del 1r àrbitre
`

/** Firmantes en catalán, ya con preposición y artículo, para el filtro `signer`. */
const SIGNER_NAMES = new Map(readTable(SIGNER_ROWS))

/**
 * Textos completos: castellano sin espacios alrededor → catalán.
 * @type {Map<string, string>}
 */
export const LITERALS = new Map(readTable(LITERAL_ROWS))

/**
 * Frases con datos, en orden de prueba. Cada una lleva la expresión anclada y la función que
 * compone el catalán; esa función recibe el traductor para los huecos que se traducen a su vez.
 * @type {ReadonlyArray<{pattern: RegExp, fill: Function}>}
 */
export const PATTERNS = Object.freeze(
    readTable(PATTERN_ROWS).map(([source, target]) => Object.freeze({
        pattern: compileSource(source),
        fill: compileTarget(target),
    })),
)

/**
 * Trozos [castellano, catalán] ya ordenados de más largo a más corto. Sin repetidos y sin los
 * que se quedarían igual.
 * @type {ReadonlyArray<readonly [string, string]>}
 */
export const FRAGMENTS = Object.freeze(readTable(FRAGMENT_ROWS).map((pair) => Object.freeze(pair)))
