// Editor de actividades del libro: abre un tema, crea y edita sus actividades con el editor de
// Clase en directo (editor.js) y descarga el archivo listo para subir a la carpeta temas/.
import { esc, sencillo, TIPOS, CURSOS, cursoDe, nuevoId } from './lib.js';
import { crearEditor, tarjetasTipos, ICONOS } from './editor.js';

const app = document.getElementById('app');
const dlg = document.getElementById('dlg');
const CLAVE = 'ae-borrador';
const MATERIA = { BioGeo: 'bg', FyQ: 'fyq', 'Química': 'quim' };
const LOGO = 'https://marca.mariancr.es/logo/horizontal/mcr_horizontal_negativo.svg';
const SOLO_DIRECTO = ['wall', 'photo', 'draw'];

let doc = null;          // tema abierto: { app, version, tema, curso, materia, numero, titulo, apartados, preguntas }
let indice = [];         // temas publicados (temas/indice.json)

const leerBorrador = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } };
function guardarBorrador() {
  doc.editado = Date.now();
  try { localStorage.setItem(CLAVE, JSON.stringify(doc)); return true; }
  catch { aviso('El navegador no tiene sitio para guardar el borrador (seguramente por las imágenes). Descarga el archivo para no perder los cambios.'); return false; }
}
function aviso(msg, ok = false) {
  const p = app.querySelector('#aviso'); if (!p) return;
  p.textContent = msg; p.className = ok ? 'estado-act ok' : 'aviso';
}

const barra = () => `<header class="mcr-barra"><a class="mcr-barra__marca" href="./editor.html"><img src="${LOGO}" alt="mariancr"><span class="mcr-barra__nombre">Editor de actividades</span></a>
  <a class="mcr-btn mcr-btn--peq" href="./" target="_blank" rel="noopener">Ver la web</a></header>`;
const pie = '<footer class="mcr-pie-app">mariancr · Editor de actividades</footer>';
const idTema = d => `${d.curso}-${MATERIA[d.materia] || 'x'}-t${String(d.numero || 0).padStart(2, '0')}`;
const nombreTema = d => `Tema ${d.numero} · ${d.titulo || 'Sin título'}`;
function colorCurso(curso) {
  const b = document.body;
  [...b.classList].filter(c => c.startsWith('curso-')).forEach(c => b.classList.remove(c));
  b.classList.add('curso-' + (cursoDe(curso) ? curso : 'general'));
}

// ── Inicio: elegir tema ──────────────────────────────────────────
async function inicio() {
  colorCurso('general');
  try { indice = await (await fetch('temas/indice.json', { cache: 'no-cache' })).json(); } catch { indice = []; }
  const b = leerBorrador();
  app.innerHTML = `${barra()}
  <section class="mcr-trama-banda"><div class="mcr-contenedor mcr-hero"><div class="mcr-hero__fila"><div><h1>Editor de actividades</h1>
    <p class="hero-sub">Crea y cambia las actividades de cada tema. Al terminar, descargas el archivo y lo subes a la carpeta <code>temas</code> del repositorio.</p></div>
    <div class="hero-acc"><button type="button" class="mcr-btn mcr-btn--prim" id="nuevo">Nuevo tema</button>
    <label class="mcr-btn mcr-btn--sec">Abrir un archivo<input type="file" id="archivo" accept=".json,application/json" hidden></label></div></div></div></section>
  <main class="mcr-contenedor visor-main">
    <p id="aviso" class="aviso" role="alert"></p>
    ${b?.preguntas ? `<h2 class="mcr-seccion">Borrador sin descargar</h2>
      <ul class="mcr-lista"><li class="mcr-tarjeta curso-${esc(b.curso)}"><div><span class="mcr-tarjeta__titulo">${esc(nombreTema(b))}</span>
        <div class="mcr-tarjeta__meta">${esc(cursoDe(b.curso)?.nombre || '')} · ${b.preguntas.length} actividades · cambiado el ${new Date(b.editado || Date.now()).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
        <div class="mcr-tarjeta__acc"><button type="button" class="mcr-btn mcr-btn--peq mcr-btn--prim" id="seguir">Seguir editando</button></div></li></ul>` : ''}
    <h2 class="mcr-seccion">Temas publicados</h2>
    ${indice.length ? `<ul class="mcr-lista">${indice.map((t, i) => `<li class="mcr-tarjeta curso-${esc(t.curso)}"><div><span class="mcr-tarjeta__titulo">${esc(nombreTema(t))}</span>
      <div class="mcr-tarjeta__meta">${esc(cursoDe(t.curso)?.nombre || '')} · ${esc(t.materia || '')} · ${t.actividades} actividades</div></div>
      <div class="mcr-tarjeta__acc"><button type="button" class="mcr-btn mcr-btn--peq" data-abrir="${i}">Editar</button></div></li>`).join('')}</ul>`
      : '<p class="mcr-vacio">Todavía no hay temas publicados.</p>'}
  </main>${pie}`;
  app.querySelector('#nuevo').onclick = () => datosTema(null);
  app.querySelector('#seguir')?.addEventListener('click', () => { doc = b; vistaTema(); });
  app.querySelectorAll('[data-abrir]').forEach(x => x.onclick = async () => {
    const t = indice[Number(x.dataset.abrir)];
    if (b?.preguntas && b.tema === t.tema && !confirmarEnLinea(x, 'Tienes un borrador de este tema. Pulsa otra vez para abrir la versión publicada y descartarlo.')) return;
    try { abrir(await (await fetch(`temas/${encodeURIComponent(t.tema)}-actividades.json`, { cache: 'no-cache' })).json()); }
    catch { aviso('No se ha podido abrir ese tema.'); }
  });
  app.querySelector('#archivo').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { abrir(JSON.parse(await f.text())); } catch { aviso('Ese archivo no es un archivo de actividades (JSON).'); }
  };
}

// Pide pulsar dos veces en lugar de un cuadro de confirmación
function confirmarEnLinea(boton, texto) {
  if (boton.dataset.seguro) return true;
  const original = boton.textContent;
  boton.dataset.seguro = '1'; boton.textContent = 'Pulsa otra vez';
  aviso(texto);
  setTimeout(() => { delete boton.dataset.seguro; boton.textContent = original; }, 4000);
  return false;
}

function abrir(d) {
  const preguntas = Array.isArray(d) ? d : d.preguntas || [];
  const meta = Array.isArray(d) ? {} : d;
  const tema = meta.tema || preguntas[0]?.tema || '';
  const m = tema.match(/^(\w+)-(\w+)-t(\d+)$/);
  const curso = meta.curso || m?.[1] || '2bach';
  doc = {
    app: 'clase-en-directo', version: 1,
    tema, curso, materia: meta.materia || cursoDe(curso)?.materia || '', numero: meta.numero || (m ? Number(m[3]) : 1),
    titulo: meta.titulo || '', apartados: meta.apartados || {},
    preguntas: preguntas.filter(p => p && TIPOS[p.type] && p.type !== 'slide' && p.prompt).map(p => ({ ...p, id: p.id || nuevoId() }))
  };
  if (!doc.tema) doc.tema = idTema(doc);
  guardarBorrador();
  vistaTema();
}

// ── Datos del tema ───────────────────────────────────────────────
function datosTema(actual) {
  const d = actual || { curso: '2bach', numero: 1, titulo: '', apartados: {} };
  const aps = Object.entries(d.apartados || {}).map(([k, v]) => `${k} | ${v}`).join('\n');
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-tema">
    <h2>${actual ? 'Datos del tema' : 'Nuevo tema'}</h2>
    <div class="rejilla-tema">
      <label>Curso<select id="d-curso">${CURSOS.map(c => `<option value="${c.id}" ${c.id === d.curso ? 'selected' : ''}>${esc(c.nombre)} · ${esc(c.materia)}</option>`).join('')}</select></label>
      <label>Número<input id="d-num" type="number" min="0" max="30" value="${esc(d.numero)}" required></label>
    </div>
    <label>Título<input id="d-tit" value="${esc(d.titulo)}" placeholder="Química del carbono" required maxlength="80"></label>
    <label>Apartados de los apuntes <span class="meta">(uno por línea: número | nombre)</span>
      <textarea id="d-aps" rows="8" placeholder="1 | Introducción&#10;1.1 | Propiedades generales&#10;2 | El átomo de carbono&#10;2.1 | Enlaces C–C" spellcheck="false">${esc(aps)}</textarea></label>
    <p class="ayuda">Los apartados sirven para agrupar las actividades y colocarlas en el libro. Escribe los mismos números que en los apuntes.</p>
    <p class="aviso" id="d-err" role="alert"></p>
    <div class="pie"><button type="button" class="btn" id="d-cancel">Cancelar</button><button class="btn primario">${actual ? 'Guardar' : 'Crear tema'}</button></div>
  </form>`;
  dlg.showModal();
  dlg.querySelector('#d-cancel').onclick = () => dlg.close();
  dlg.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const curso = dlg.querySelector('#d-curso').value;
    const numero = Number(dlg.querySelector('#d-num').value);
    const titulo = dlg.querySelector('#d-tit').value.trim();
    if (!titulo) { dlg.querySelector('#d-err').textContent = 'Escribe el título del tema.'; return; }
    const apartados = {};
    for (const l of dlg.querySelector('#d-aps').value.split('\n')) {
      const k = l.indexOf('|'); if (k < 0) continue;
      const n = l.slice(0, k).trim(), nom = l.slice(k + 1).trim();
      if (n) apartados[n] = nom;
    }
    const nuevo = { curso, materia: cursoDe(curso).materia, numero, titulo, apartados };
    const temaAntes = actual?.tema;
    doc = actual ? Object.assign(doc, nuevo) : { app: 'clase-en-directo', version: 1, ...nuevo, preguntas: [] };
    doc.tema = idTema(doc);
    if (temaAntes && temaAntes !== doc.tema) doc.preguntas.forEach(p => { p.tema = doc.tema; });
    guardarBorrador();
    dlg.close();
    vistaTema();
  };
}

// ── Vista del tema: lista de actividades por apartado ────────────
function vistaTema() {
  colorCurso(doc.curso);
  const ap = doc.apartados || {};
  const orden = k => k ? k.split('.').map(n => n.padStart(3, '0')).join('.') : 'zzz';
  const claves = [...new Set([...Object.keys(ap).filter(k => k.includes('.')), ...doc.preguntas.map(p => p.ancla || '')])].sort((a, b) => orden(a).localeCompare(orden(b)));
  const nombreAp = k => k ? `${k} · ${ap[k] || ap[k.split('.')[0]] || ''}`.replace(/ · $/, '') : 'Sin apartado';
  const fila = (p, i) => {
    const solo = SOLO_DIRECTO.includes(p.type) || p.soloDirecto;
    return `<li class="ae-fila" data-i="${i}">
      <span class="ae-icono" title="${esc(TIPOS[p.type])}">${ICONOS[p.type] || ''}</span>
      <div class="ae-texto"><span class="tipo">${esc(TIPOS[p.type])}${solo ? ' · solo en Clase en directo' : ''}</span><span class="ae-enun">${esc(sencillo(p.prompt))}</span></div>
      <div class="ae-acc">
        <button type="button" class="btn-ico" data-mover="-1" aria-label="Subir">↑</button>
        <button type="button" class="btn-ico" data-mover="1" aria-label="Bajar">↓</button>
        <button type="button" class="btn peq" data-editar>Editar</button>
        <button type="button" class="btn peq" data-duplicar>Duplicar</button>
        <button type="button" class="btn peq peligro" data-borrar>Borrar</button>
      </div></li>`;
  };
  app.innerHTML = `${barra()}
  <section class="mcr-trama-banda"><div class="mcr-contenedor mcr-hero">
    <p class="hero-sup">${esc(cursoDe(doc.curso)?.nombre || '')} · ${esc(doc.materia || '')} · archivo ${esc(doc.tema)}-actividades.json</p>
    <div class="mcr-hero__fila"><h1>${esc(nombreTema(doc))}</h1>
      <div class="hero-acc"><button type="button" class="mcr-btn mcr-btn--sec" id="datos">Datos del tema</button>
        <a class="mcr-btn mcr-btn--sec" href="./?borrador=1" target="_blank" rel="noopener">Ver como alumno</a>
        <button type="button" class="mcr-btn mcr-btn--prim" id="publicar">Descargar para publicar</button></div></div>
    <p class="hero-sub">${doc.preguntas.length} actividades · los cambios se guardan solos en este navegador hasta que descargues el archivo.</p>
  </div></section>
  <main class="mcr-contenedor visor-main">
    <p id="aviso" class="aviso" role="alert"></p>
    <div class="ae-arriba"><button type="button" class="btn primario" data-nueva="">+ Nueva actividad</button><button type="button" class="btn" id="cerrar">Cerrar el tema</button></div>
    ${claves.map(k => {
      const items = doc.preguntas.map((p, i) => [p, i]).filter(([p]) => (p.ancla || '') === k);
      return `<section class="ae-apartado"><h2 class="mcr-seccion">${esc(nombreAp(k))}</h2>
        ${items.length ? `<ol class="ae-lista">${items.map(([p, i]) => fila(p, i)).join('')}</ol>` : '<p class="meta ae-vacio">Sin actividades.</p>'}
        <button type="button" class="btn peq ae-anadir" data-nueva="${esc(k)}">+ Añadir en ${esc(k || 'sin apartado')}</button></section>`;
    }).join('') || '<p class="mcr-vacio">Este tema aún no tiene actividades. Pulsa «Nueva actividad».</p>'}
  </main>${pie}`;

  app.querySelector('#datos').onclick = () => datosTema(doc);
  app.querySelector('#publicar').onclick = publicar;
  app.querySelector('#cerrar').onclick = e => { if (confirmarEnLinea(e.currentTarget, 'Al cerrar se borra el borrador de este navegador. Descarga antes el archivo si quieres conservar los cambios.')) { try { localStorage.removeItem(CLAVE); } catch { /* nada */ } doc = null; inicio(); } };
  app.querySelectorAll('[data-nueva]').forEach(b => b.onclick = () => editar(null, b.dataset.nueva));
  app.querySelectorAll('.ae-fila').forEach(li => {
    const i = Number(li.dataset.i);
    li.querySelector('[data-editar]').onclick = () => editar(i);
    li.querySelector('[data-duplicar]').onclick = () => {
      const copia = JSON.parse(JSON.stringify(doc.preguntas[i])); copia.id = nuevoId();
      doc.preguntas.splice(i + 1, 0, copia); guardarBorrador(); vistaTema(); aviso('Actividad duplicada.', true);
    };
    li.querySelector('[data-borrar]').onclick = e => {
      if (!confirmarEnLinea(e.currentTarget, 'Pulsa otra vez «Borrar» para quitar la actividad.')) return;
      doc.preguntas.splice(i, 1); guardarBorrador(); vistaTema(); aviso('Actividad borrada.', true);
    };
    li.querySelectorAll('[data-mover]').forEach(b => b.onclick = () => {
      // Se mueve dentro de su apartado: intercambia con la vecina del mismo apartado
      const k = doc.preguntas[i].ancla || '';
      const mismos = doc.preguntas.map((p, j) => j).filter(j => (doc.preguntas[j].ancla || '') === k);
      const pos = mismos.indexOf(i), otra = mismos[pos + Number(b.dataset.mover)];
      if (otra == null) return;
      [doc.preguntas[i], doc.preguntas[otra]] = [doc.preguntas[otra], doc.preguntas[i]];
      guardarBorrador(); vistaTema();
      app.querySelector(`.ae-fila[data-i="${otra}"] [data-mover="${b.dataset.mover}"]`)?.focus();
    });
  });
}

// ── Crear o editar una actividad (editor de Clase en directo) ────
function editar(i, anclaNueva = '') {
  const item = i == null ? null : doc.preguntas[i];
  const elegirTipo = () => {
    dlg.innerHTML = `<div class="dlg-editor">
      <header class="ed-cab"><h2>Nueva actividad: elige el tipo</h2><div class="ed-cab-acc"><button type="button" class="btn" id="cancelar">Cancelar</button></div></header>
      <div class="ed-tipos"><p class="ayuda">El muro, las fotos y el dibujo solo funcionan en Clase en directo: no salen en el libro.</p>${tarjetasTipos([])}</div></div>`;
    dlg.querySelector('#cancelar').onclick = () => dlg.close();
    dlg.querySelectorAll('[data-t]').forEach(b => b.onclick = () => formulario({ type: b.dataset.t, ancla: anclaNueva }, true));
  };
  const formulario = (base, nuevo) => {
    const t = base.type;
    dlg.innerHTML = `<div class="dlg-editor">
      <header class="ed-cab">
        ${nuevo ? '<button type="button" class="btn" id="volver" aria-label="Volver a los tipos">‹ Tipos</button>' : ''}
        <h2><span class="ed-cab-icono">${ICONOS[t] || ''}</span>${item ? 'Editar' : 'Nueva'} actividad: ${esc(TIPOS[t])}</h2>
        <div class="ed-cab-acc"><button type="button" class="btn" id="cancelar">Cancelar</button><button type="button" class="btn primario" id="ok">Guardar</button></div>
      </header>
      <div class="ed-pestanas" role="tablist"><button type="button" role="tab" class="activa" data-ver="form">Editar</button><button type="button" role="tab" data-ver="prueba">Probar</button></div>
      <div id="ed-sitio"></div></div>`;
    const extra = SOLO_DIRECTO.includes(t) ? '' : `<div class="ed-bloque"><label class="check"><input type="checkbox" id="solo-directo" ${base.soloDirecto ? 'checked' : ''}> Solo para Clase en directo (no sale en el libro)</label></div>`;
    const ed = crearEditor(dlg.querySelector('#ed-sitio'), base, { extra, conAncla: true });
    const pest = dlg.querySelector('.ed-pestanas');
    pest.onclick = e => {
      const b = e.target.closest('[data-ver]'); if (!b) return;
      pest.querySelectorAll('[data-ver]').forEach(x => x.classList.toggle('activa', x === b));
      dlg.querySelector('.dlg-editor').classList.toggle('ver-prueba', b.dataset.ver === 'prueba');
      if (b.dataset.ver === 'prueba') ed.probar();
    };
    dlg.querySelector('#volver')?.addEventListener('click', elegirTipo);
    dlg.querySelector('#cancelar').onclick = () => dlg.close();
    dlg.querySelector('#ok').onclick = () => {
      const { out, error } = ed.leer();
      if (error) {
        dlg.querySelector('#ed-err').textContent = error;
        if (dlg.querySelector('.dlg-editor').classList.contains('ver-prueba')) pest.querySelector('[data-ver="form"]').click();
        return;
      }
      const solo = dlg.querySelector('#solo-directo');
      if (solo?.checked) out.soloDirecto = true; else delete out.soloDirecto;
      out.tema = doc.tema;
      if (!out.ancla) delete out.ancla;
      if (item) doc.preguntas[i] = { ...out, id: item.id };
      else {
        out.id = `${doc.tema}-${nuevoId()}`;
        // Detrás de la última del mismo apartado (o al final)
        const k = out.ancla || '';
        const ultima = doc.preguntas.map(p => p.ancla || '').lastIndexOf(k);
        doc.preguntas.splice(ultima < 0 ? doc.preguntas.length : ultima + 1, 0, out);
      }
      guardarBorrador();
      dlg.close();
      vistaTema();
      aviso(item ? 'Cambios guardados en el borrador.' : 'Actividad añadida al borrador.', true);
      document.querySelector(`.ae-fila[data-i="${item ? i : doc.preguntas.indexOf(out)}"]`)?.scrollIntoView({ block: 'center' });
    };
  };
  if (item) formulario(item, false); else elegirTipo();
  if (!dlg.open) dlg.showModal();
}

// ── Descargar para publicar ──────────────────────────────────────
function descargar(nombre, datos) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }));
  a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function publicar() {
  const archivo = `${doc.tema}-actividades.json`;
  const enLibro = doc.preguntas.filter(p => !SOLO_DIRECTO.includes(p.type) && !p.soloDirecto).length;
  const nuevoIndice = [...indice.filter(t => t.tema !== doc.tema), { tema: doc.tema, curso: doc.curso, materia: doc.materia, numero: doc.numero, titulo: doc.titulo, actividades: enLibro }]
    .sort((a, b) => a.curso.localeCompare(b.curso) || a.numero - b.numero);
  const cambiaIndice = JSON.stringify(indice.find(t => t.tema === doc.tema)) !== JSON.stringify(nuevoIndice.find(t => t.tema === doc.tema));
  dlg.innerHTML = `<div class="dlg dlg-tema">
    <h2>Publicar ${esc(nombreTema(doc))}</h2>
    <ol class="ae-pasos">
      <li><button type="button" class="btn primario" id="baj-tema">Descargar ${esc(archivo)}</button>
        <p class="ayuda">Es el archivo del tema: sirve para el libro y para importarlo en Clase en directo (Banco de preguntas → Importar).</p></li>
      ${cambiaIndice ? `<li><button type="button" class="btn" id="baj-indice">Descargar indice.json</button>
        <p class="ayuda">La lista de temas de la portada. Hace falta porque el tema es nuevo o ha cambiado su título o el número de actividades.</p></li>` : ''}
      <li><p>En GitHub, abre el repositorio <strong>mariancr-web/actividades</strong>, entra en la carpeta <code>temas</code> y pulsa <strong>Add file → Upload files</strong>. Arrastra ${cambiaIndice ? 'los dos archivos' : 'el archivo'} y pulsa <strong>Commit changes</strong>. En un minuto Vercel lo publica.</p></li>
      <li><p>Guarda también una copia en «Materiales de clases», en la carpeta MARIANCR del tema.</p></li>
    </ol>
    <div class="pie"><button type="button" class="btn" id="cerrar-pub">Cerrar</button></div></div>`;
  dlg.showModal();
  dlg.querySelector('#baj-tema').onclick = () => descargar(archivo, (({ editado, ...d }) => d)(doc));
  dlg.querySelector('#baj-indice')?.addEventListener('click', () => descargar('indice.json', nuevoIndice));
  dlg.querySelector('#cerrar-pub').onclick = () => dlg.close();
}

// ── Arranque ─────────────────────────────────────────────────────
(async () => {
  try { indice = await (await fetch('temas/indice.json', { cache: 'no-cache' })).json(); } catch { indice = []; }
  const b = leerBorrador();
  if (b?.preguntas && new URLSearchParams(location.search).has('seguir')) { doc = b; vistaTema(); }
  else inicio();
})();
