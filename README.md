# emPat

Acta electrónica para partidos de vóley 6x6 con las reglas FIVB. Corre en el navegador, sin servidor propio ni cuentas de usuario, y guarda las actas en el propio dispositivo. La interfaz está en castellano y en catalán, y el acta impresa se genera sobre los modelos oficiales de la FCVB (estándar, infantil y hoja de observaciones).

## Puesta en marcha

`web/` es una web estática. Basta con servirla con cualquier servidor de archivos:

```
python -m http.server 8080 --bind 127.0.0.1 --directory web
```

y abrir http://127.0.0.1:8080/. El código son módulos ES, así que abrir `index.html` como archivo local no funciona.

Con `?acta=<id>` en la dirección se abre directamente un acta guardada.

## Uso sin conexión

En la primera visita con red, `web/sw.js` guarda todos los archivos de la web en el dispositivo. A partir de ahí la aplicación abre y funciona sin conexión, también al recargar. Cuando se publica una versión nueva, la página lo avisa y solo cambia de versión cuando el anotador pulsa «Actualizar».

Al añadir, quitar o renombrar un archivo de `web/`, hay que actualizar la lista `PRECACHE` de `sw.js` y subir el número de `CACHE_NAME`. La prueba `tests/deploy/offline.test.mjs` avisa si la lista no cuadra.

La web se puede instalar como aplicación gracias a `manifest.webmanifest`.

## Publicación

El flujo `.github/workflows/pages.yml` pasa las pruebas y publica el contenido de `web/` en https://purupurpito.github.io/emPat/ con cada envío a `main`. En la configuración del repositorio, Pages tiene como origen «GitHub Actions», porque la publicación desde una rama solo admite la raíz o `docs/`, no `web/`.

## Organización

- `web/index.html`: esqueleto de la página. `web/boot-guard.js` avisa si la aplicación no llega a arrancar.
- `web/src/rules/`: motor de reglas. No usa el DOM y funciona igual en el navegador y en Node.
- `web/src/app/`: interfaz. Contiene la sesión, el almacén, las pantallas, los diálogos y las vistas.
- `web/src/i18n/`: traducción al catalán.
- `web/src/sheet/`: acta oficial impresa.
- `web/src/pwa/`: registro del service worker y aviso de actualización.
- `web/styles/`: hojas de estilo.
- `web/fuentes/`, `web/impresos/`, `web/iconos/`: tipografías, modelos de acta e iconos.
- `tests/`: pruebas.

Las actas se guardan en `localStorage` en un formato JSON propio y versionado (`"format": "empat/acta"`). La pantalla final permite descargarlas y la portada, importarlas.

## Pruebas

Hace falta Node 20.19, 22.7 o superior (las pruebas cargan los módulos ES de `web/src` sin `package.json`); no hay dependencias que instalar.

- `node tests/run-all.mjs`: todas las pruebas `*.test.mjs` y una tanda corta de partidos al azar.
- `node --test "tests/rules/*.test.mjs"`: solo las reglas (los patrones en `--test` piden Node 22 o superior).
- `node tests/fuzz/random-matches.mjs --games 1500 --seed 7`: partidos simulados al azar contra los invariantes del reglamento.
- `node tests/oracles/swiss-sheet.mjs [--cache carpeta]`: reproduce paso a paso un acta de referencia publicada. Necesita red la primera vez y `pdftotext`.
- `node tests/oracles/league-csv.mjs --minimum 114 [--data carpeta]`: reproduce partidos reales de liga a partir de sus datos abiertos, que descarga si no están en la carpeta.

## Licencia

Todos los derechos reservados. Se puede usar la aplicación publicada en https://purupurpito.github.io/emPat/, pero copiar, modificar o redistribuir el código necesita permiso del autor. Las condiciones completas están en `LICENSE`.

## Aviso

Los modelos de acta de `web/impresos/` son de la Federació Catalana de Voleibol. Mientras la federación no diga otra cosa, el acta oficial sigue siendo la de papel.
