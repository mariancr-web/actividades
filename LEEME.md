# Actividades interactivas (visor del libro)

Web estática que muestra las actividades de cada tema para que el alumnado las haga a su ritmo. Se corrigen solas en el navegador, sin cuentas ni base de datos. El progreso se guarda en el dispositivo.

Usa **el mismo archivo** que se importa en Clase en directo (Banco de preguntas → Importar).

## Archivos
| Archivo | Función |
|---|---|
| `index.html` + `visor.js` | El visor: portada con los temas y vista de cada tema |
| `lib.js` | Copia de `lib.js` de Clase en directo (corrección y dibujo de cada tipo). Si se cambia allí, se copia aquí |
| `actividades.css` | Copia de `estilos.css` de Clase en directo, para que las actividades se vean igual |
| `visor.css` | Estilos propios del visor |
| `temas/indice.json` | Lista de temas publicados (curso, número, título, nº de actividades) |
| `temas/<curso>-<materia>-tNN-actividades.json` | Actividades de cada tema |
| `libro-ejemplo.html` | Ejemplo de cómo meter las actividades de un apartado en el libro web |
| `vercel.json` | Permite que el libro web lea los temas desde otra dirección |

## Publicar (igual que Clase en directo)
1. Crea en GitHub un repositorio nuevo, por ejemplo `mariancr-actividades`, y sube todos los archivos de esta carpeta.
2. En Vercel: *Add New → Project*, elige el repositorio, preset **Other**, sin cambiar nada más, y *Deploy*.
3. Quedará en una dirección como `https://mariancr-actividades.vercel.app`.

## Añadir un tema
1. Copia su archivo `…-actividades.json` en `temas/`.
2. Añade una línea a `temas/indice.json` (curso, número, título, número de actividades).
3. Sube los cambios a GitHub; Vercel lo publica solo.

## Direcciones útiles
- Tema completo: `?t=2bach-quim-t01`
- Un apartado (incluye sus subapartados): `?t=2bach-quim-t01&a=4` o `&a=4.2`
- Una sola actividad (para Classroom): `?t=2bach-quim-t01&id=q2b-t01-22`. El botón de enlace de cada actividad copia esta dirección.
- Dentro del libro, sin cabecera: añade `&embed=1` (ver `libro-ejemplo.html`).
- «Probar un archivo» en la portada: abre un JSON de tu ordenador para revisarlo antes de publicarlo.

## Formato de las actividades
Es el JSON del banco de Clase en directo: `{ "app": "clase-en-directo", "version": 1, "preguntas": [ … ] }`, con los campos de cada tipo (ver `resumen-clase-en-directo.md`). Se añaden:
- En cada pregunta: `tema` (p. ej. `2bach-quim-t01`) y `ancla`, el número de apartado de los apuntes (p. ej. `4.2`).
- En el archivo: `curso`, `materia`, `numero`, `titulo` y `apartados` (número → nombre del apartado).
- `soloDirecto: true` para actividades que solo tienen sentido en clase. El muro, las fotos y el dibujo no salen nunca en el visor.

Clase en directo ignora estos campos extra al importar, así que el mismo archivo sirve para los dos sitios.
