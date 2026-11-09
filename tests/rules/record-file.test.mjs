/**
 * Archivo del acta y almacén local: ida y vuelta por JSON, rechazo de lo que el contenido no corresponde a un acta de
 * este formato y saneado de plantillas con dorsales imposibles.
 * @module tests/rules/record-file.test.mjs
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { loadRules, loadWebModule } from "../support/load.mjs"
import { snapshot } from "../support/snapshot.mjs"
import { liberoIn, sanction, substitution } from "../support/plays.mjs"
import { Table } from "../support/table.mjs"

const rules = await loadRules()
const recordModule = await loadWebModule("src/app/record.js")
const { RecordStore } = await loadWebModule("src/app/store.js")

/**
 * Almacenamiento en memoria con la interfaz de localStorage. Puede configurarse para fallar al
 * escribir, como un navegador sin espacio o en modo privado.
 */
class MemoryStorage {
    #items = new Map()

    /** @param {{failWrites?: boolean}} [options] comportamiento */
    constructor(options = {}) {
        this.failWrites = Boolean(options.failWrites)
    }

    get length() {
        return this.#items.size
    }

    key(index) {
        return [...this.#items.keys()][index] ?? null
    }

    getItem(key) {
        return this.#items.has(key) ? this.#items.get(key) : null
    }

    setItem(key, value) {
        if (this.failWrites) {
            throw new Error("QuotaExceededError")
        }
        this.#items.set(key, String(value))
    }

    removeItem(key) {
        this.#items.delete(key)
    }
}

/**
 * Acta con un partido jugado a medias: un set acabado, sustituciones, líbero y sanciones.
 * @returns {object} Record
 */
function playedRecord() {
    const table = Table.ready(rules).burst("home", 3).burst("away", 2)
    table.play(substitution("home", 3, 7))
    table.play(liberoIn("away", 12, 6))
    table.play(sanction("away", "coach", "warning"))
    table.burst("home", 22).lineups().start().burst("away", 4)
    const info = { homeName: "CV LOCAL", awayName: "CV VISITANTE" }
    const record = recordModule.createRecord(info, {}, "abc")
    record.plays = table.plays.map((play) => ({ ...play }))
    return record
}

/**
 * Acta en preparación con un dorsal imposible en la plantilla local.
 * @param {boolean} started si ya tiene el inicio del primer set
 * @returns {object} Record
 */
function recordWithBadShirt(started) {
    const record = recordModule.createRecord({}, {}, "bad")
    const players = [
        { shirt: "1", name: "Uno" },
        { shirt: 544, name: "Mal" },
        { shirt: "2", name: "Dos" },
    ]
    record.plays = [{ kind: "roster", side: "home", name: "L", players }]
    if (started) {
        record.plays.push({ kind: "startPeriod" })
    }
    return record
}

describe("formato del acta", function () {
    it("un acta nueva lleva la marca, la versión y empieza en datos", function () {
        const record = recordModule.createRecord({ homeName: "A" }, { bestOf: 3 }, "x1")
        assert.equal(record.format, "empat/acta")
        assert.equal(record.version, 1)
        assert.equal(record.id, "x1")
        assert.equal(record.stage, "details")
        assert.deepEqual(record.plays, [])
        assert.equal(record.info.homeName, "A")
        assert.equal(record.settings.bestOf, 3)
    })

    it("se serializa con sangría de un espacio", function () {
        const record = recordModule.createRecord({}, {}, "x2")
        assert.equal(recordModule.serializeRecord(record), JSON.stringify(record, null, 1))
    })

    it("ida y vuelta: el partido y el resumen son los mismos", function () {
        const record = playedRecord()
        const back = recordModule.parseRecordFile(recordModule.serializeRecord(record))
        const before = rules.replay(record.settings, record.info, record.plays)
        const after = rules.replay(back.settings, back.info, back.plays)
        assert.equal(snapshot(after), snapshot(before))
        assert.deepEqual(rules.summarize(after), rules.summarize(before))
    })

    const valid = { format: "empat/acta", version: 1, plays: [], info: {} }
    const rejected = {
        "un JSON roto": "{\"format\":",
        "un formato ajeno": JSON.stringify({ ...valid, format: "otra/cosa" }),
        "la versión 2": JSON.stringify({ ...valid, version: 2 }),
        "un acta sin marca de formato": JSON.stringify({ id: "a", cfg: {}, datos: {}, ev: [] }),
        "jugadas que no son lista": JSON.stringify({ ...valid, plays: {} }),
        "datos que no son objeto": JSON.stringify({ ...valid, info: "x" }),
    }
    for (const [label, text] of Object.entries(rejected)) {
        it("rechaza " + label, function () {
            assert.throws(() => recordModule.parseRecordFile(text), { message: "el contenido no corresponde a un acta" })
        })
    }
})

describe("almacén local", function () {
    it("guarda, carga, lista y borra", function () {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const record = recordModule.createRecord({}, {}, "r1")
        assert.equal(store.save(record), true)
        assert.equal(typeof record.updatedAt, "string")
        assert.notEqual(storage.getItem("empat/acta/r1"), null)
        assert.equal(store.load("r1").id, "r1")
        assert.deepEqual(store.list().map((entry) => entry.id), ["r1"])
        store.remove("r1")
        assert.equal(store.load("r1"), null)
        assert.deepEqual(store.list(), [])
    })

    it("lista de la más reciente a la más antigua e ignora lo que no entiende", function () {
        const storage = new MemoryStorage()
        const stamps = [["old", "2026-01-01T00:00:00.000Z"], ["new", "2026-02-01T00:00:00.000Z"]]
        for (const [id, updatedAt] of stamps) {
            const record = recordModule.createRecord({}, {}, id)
            record.updatedAt = updatedAt
            storage.setItem("empat/acta/" + id, JSON.stringify(record))
        }
        storage.setItem("empat/acta/broken", "{no")
        storage.setItem("empat/plantilla/CV", JSON.stringify({ players: [], staff: [] }))
        storage.setItem("otra/cosa", "{}")
        const store = new RecordStore(storage)
        assert.deepEqual(store.list().map((entry) => entry.id), ["new", "old"])
    })

    it("si el dispositivo no deja escribir, save devuelve false sin lanzar", function () {
        const store = new RecordStore(new MemoryStorage({ failWrites: true }))
        assert.equal(store.save(recordModule.createRecord({}, {}, "r2")), false)
    })

    it("recuerda las plantillas por nombre de equipo tal como se escribieron", function () {
        const store = new RecordStore(new MemoryStorage())
        const squad = {
            players: [{ shirt: "07", name: "Ana" }],
            staff: [{ role: "coach", name: "Eva" }],
        }
        store.rememberTeam("CV Prueba", squad)
        assert.deepEqual(store.recallTeam("CV Prueba"), squad)
        assert.equal(store.recallTeam("Otro"), null)
    })

    it("los identificadores nuevos son cortos, en base 36 y distintos", function () {
        const store = new RecordStore(new MemoryStorage())
        const first = store.newId()
        assert.match(first, /^[0-9a-z]{9,}$/)
        assert.notEqual(store.newId(), first)
    })
})

describe("saneado de plantillas", function () {
    it("aparta los dorsales imposibles y vuelve a las plantillas", function () {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const record = store.sanitize(recordWithBadShirt(false))
        assert.deepEqual(record.plays[0].players.map((player) => player.shirt), ["1", "2"])
        assert.deepEqual(record.setAside.home, [{ shirt: "544", name: "Mal" }])
        assert.equal(record.stage, "rosters")
        assert.equal(JSON.parse(storage.getItem("empat/acta/bad")).stage, "rosters", "y lo guarda")
    })

    it("con el partido empezado no toca nada", function () {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const record = store.sanitize(recordWithBadShirt(true))
        assert.equal(record.plays[0].players.length, 3)
        assert.equal(record.setAside, undefined)
        assert.equal(record.stage, "details")
        assert.equal(storage.getItem("empat/acta/bad"), null)
    })

    it("al cargar un acta guardada también se sanea", function () {
        const storage = new MemoryStorage()
        storage.setItem("empat/acta/bad", JSON.stringify(recordWithBadShirt(false)))
        const loaded = new RecordStore(storage).load("bad")
        assert.equal(loaded.stage, "rosters")
        assert.equal(loaded.setAside.home.length, 1)
    })
})

describe("importación", function () {
    it("importa un acta válida conservando su id si está libre", function () {
        const store = new RecordStore(new MemoryStorage())
        const imported = store.importText(recordModule.serializeRecord(playedRecord()), rules)
        assert.equal(imported.id, "abc")
        assert.equal(store.load("abc").plays.length, imported.plays.length)
    })

    it("da un id nuevo si ya hay un acta con ese id", function () {
        const store = new RecordStore(new MemoryStorage())
        const text = recordModule.serializeRecord(playedRecord())
        store.importText(text, rules)
        const second = store.importText(text, rules)
        assert.notEqual(second.id, "abc")
        assert.equal(store.list().length, 2)
    })

    it("rechaza lo que el contenido no corresponde a un acta", function () {
        const store = new RecordStore(new MemoryStorage())
        assert.throws(() => store.importText("[]", rules), { message: "el contenido no corresponde a un acta" })
        assert.deepEqual(store.list(), [])
    })
})
