/**
 * Formato del acta y almacén local: creación, lectura, saneado e importación.
 * @module tests/app/store.test.mjs
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { fakeRules, loadSource, MemoryStorage } from "./fakes.mjs"

const record = await loadSource("app/record.js")
const { RecordStore } = await loadSource("app/store.js")

/**
 * Acta mínima con una plantilla por lado.
 * @param {string} id identificador
 * @param {object[]} [extra] jugadas añadidas
 * @returns {object}
 */
function sampleRecord(id, extra = []) {
    const made = record.createRecord({ homeName: "Norte", awayName: "Sur" }, {}, id)
    made.plays.push({
        kind: "roster",
        side: "home",
        name: "Norte",
        players: [{ shirt: "7", name: "Ana" }, { shirt: "544", name: "Bea" }],
        staff: [],
    })
    made.plays.push(...extra)
    return made
}

describe("formato del acta", () => {
    it("un acta nueva empieza en datos, sin jugadas y con marca de formato", () => {
        const made = record.createRecord({ town: "Vila" }, { bestOf: 3 }, "x1")
        assert.equal(made.format, "empat/acta")
        assert.equal(made.version, 1)
        assert.equal(made.stage, "details")
        assert.deepEqual(made.plays, [])
        assert.equal(made.info.town, "Vila")
        assert.equal(typeof made.createdAt, "string")
    })

    it("la ida y vuelta por texto conserva el acta", () => {
        const made = sampleRecord("x2")
        const text = record.serializeRecord(made)
        assert.equal(text, JSON.stringify(made, null, 1))
        assert.deepEqual(record.parseRecordFile(text), made)
    })

    it("rechaza JSON roto, formato ajeno, otra versión y piezas que faltan", () => {
        const good = sampleRecord("x3")
        const variants = [
            "{",
            "null",
            JSON.stringify({ ...good, format: "otro" }),
            JSON.stringify({ ...good, version: 2 }),
            JSON.stringify({ ...good, plays: {} }),
            JSON.stringify({ ...good, info: "x" }),
            JSON.stringify({ ...good, info: null }),
            JSON.stringify({ id: "a", ev: [], datos: {}, cfg: {} }),
        ]
        for (const text of variants) {
            assert.throws(() => record.parseRecordFile(text), { message: "el contenido no corresponde a un acta" })
        }
    })

    it("los datos infantiles dan ajustes sin líbero y con set obligatorio", () => {
        const kids = record.initialSettings({ competition: "Lliga", category: "Infantil" })
        assert.equal(kids.liberoAllowed, false)
        assert.equal(kids.fullSetRule, true)
        const adults = record.initialSettings({})
        assert.equal(adults.liberoAllowed, true)
        assert.equal(adults.fullSetRule, false)
        assert.equal(record.isKidsFormat({ category: "cadete infantil" }), true)
    })
})

describe("almacén", () => {
    it("guarda con fecha de cambio y vuelve a leer", () => {
        const store = new RecordStore(new MemoryStorage())
        const made = sampleRecord("a1")
        made.plays = []
        assert.equal(store.save(made), true)
        assert.equal(typeof made.updatedAt, "string")
        assert.deepEqual(store.load("a1"), made)
    })

    it("un almacenamiento que falla no revienta: save da false y load null", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        storage.broken = true
        assert.equal(store.save(record.createRecord({}, {}, "b1")), false)
        assert.equal(store.load("b1"), null)
        assert.deepEqual(store.list(), [])
        assert.equal(store.recallTeam("Norte"), null)
        store.remove("b1")
    })

    it("lista solo actas, de la más reciente a la más antigua, sin las ilegibles", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        storage.setItem("empat/acta/old", JSON.stringify({ id: "old", updatedAt: "2" }))
        storage.setItem("empat/acta/new", JSON.stringify({ id: "new", updatedAt: "9" }))
        storage.setItem("empat/acta/rota", "{no")
        storage.setItem("empat/plantilla/Norte", JSON.stringify({ id: "no" }))
        assert.deepEqual(store.list().map((item) => item.id), ["new", "old"])
    })

    it("lista con el id de su clave las entradas sin id o que no son un objeto", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        storage.setItem("empat/acta/vacia", "{}")
        storage.setItem("empat/acta/lista", "[1, 2]")
        storage.setItem("empat/acta/numero", "7")
        const ids = store.list().map((item) => item.id).sort()
        assert.deepEqual(ids, ["lista", "vacia"])
    })

    it("borra un acta", () => {
        const store = new RecordStore(new MemoryStorage())
        const made = record.createRecord({}, {}, "c1")
        store.save(made)
        store.remove("c1")
        assert.equal(store.load("c1"), null)
    })

    it("recuerda la plantilla tal como se escribió", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const squad = { players: [{ shirt: "", name: "Ana" }], staff: [{ role: "coach" }] }
        store.rememberTeam("Club Norte", squad)
        assert.ok(storage.getItem("empat/plantilla/Club Norte"))
        assert.deepEqual(store.recallTeam("Club Norte"), squad)
        assert.equal(store.recallTeam("Otro"), null)
    })

    it("sanea: aparta dorsales no válidos y lleva el acta a plantillas", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const made = sampleRecord("d1")
        made.plays[0].players.push({ shirt: null, name: "Cris" })
        storage.setItem("empat/acta/d1", JSON.stringify(made))
        const loaded = store.load("d1")
        assert.equal(loaded.stage, "rosters")
        assert.deepEqual(loaded.plays[0].players, [{ shirt: "7", name: "Ana" }])
        assert.deepEqual(loaded.setAside.home, [
            { shirt: "544", name: "Bea" },
            { shirt: "", name: "Cris" },
        ])
        const stored = JSON.parse(storage.getItem("empat/acta/d1"))
        assert.equal(stored.stage, "rosters")
        assert.equal(stored.updatedAt, undefined)
    })

    it("no sanea un acta con el partido empezado", () => {
        const store = new RecordStore(new MemoryStorage())
        const made = sampleRecord("d2", [{ kind: "startPeriod" }])
        store.sanitize(made)
        assert.equal(made.stage, "details")
        assert.equal(made.plays[0].players.length, 2)
        assert.equal(made.setAside, undefined)
    })

    it("importa: sanea, prueba con el motor y da id nuevo si choca", () => {
        const store = new RecordStore(new MemoryStorage())
        const first = sampleRecord("e1")
        first.plays = []
        store.save(first)
        const text = record.serializeRecord(sampleRecord("e1"))
        const imported = store.importText(text, fakeRules)
        assert.notEqual(imported.id, "e1")
        assert.equal(imported.setAside.home.length, 1)
        assert.deepEqual(store.load(imported.id), imported)
        assert.deepEqual(store.load("e1").plays, [])
    })

    it("no guarda nada si el motor no sabe reconstruir el acta importada", () => {
        const storage = new MemoryStorage()
        const store = new RecordStore(storage)
        const broken = record.createRecord({ broken: true }, {}, "f1")
        assert.throws(() => store.importText(record.serializeRecord(broken), fakeRules))
        assert.equal(storage.length, 0)
    })

    it("los identificadores nuevos son cortos y distintos", () => {
        const store = new RecordStore(new MemoryStorage())
        const first = store.newId()
        assert.match(first, /^[0-9a-z]+$/)
        assert.notEqual(first, store.newId())
    })
})
