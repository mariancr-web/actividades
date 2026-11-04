// Visor de actividades interactivas (libro web). Lee el mismo JSON que se importa en Clase en directo
// (Banco → Importar) y corrige en el navegador con lib.js, sin cuentas ni servidor.
import {
  esc, rico, itemPublico, nombreTipo, comprobar, aciertosPorParte, pintarPartes, leerPartes, moverOrden,
  POR_PARTES, pintarSopa, lineaSopa, palabraSopa, generarSopa, lista, solucionTexto, conDatos, cursoDe, respuestaHTML
} from './lib.js';

const app = document.getElementById('app');
const URLP = new URLSearchParams(location.search);
const EMBED = URLP.has('embed');
if (EMBED) document.body.classList.add('embed');

// Tipos que necesitan a la clase en directo (muro, fotos, dibujo) no se muestran en el libro
const SOLO_DIRECTO = ['wall', 'photo', 'draw', 'slide', 'link'];
const visible = it => it && it.prompt && !SOLO_DIRECTO.includes(it.type) && !it.soloDirecto;

// Semilla propia del dispositivo para las variantes numéricas
const guardado = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
let UID = guardado('ai-uid', null);
if (!UID) { UID = 'v' + Math.random().toString(36).slice(2, 10); guardar('ai-uid', UID); }

const LOGO = 'https://marca.mariancr.es/logo/horizontal/mcr_horizontal_negativo.svg';
const barra = () => EMBED ? '' : `<header class="mcr-barra"><a class="mcr-barra__marca" href="./"><img src="${LOGO}" alt="mariancr"><span class="mcr-barra__nombre">Actividades</span></a></header>`;
const pie = () => EMBED ? '' : `<footer class="mcr-pie-app">mariancr · Actividades interactivas</footer>`;

function colorCurso(curso) {
  const b = document.body;
  [...b.classList].filter(c => c.startsWith('curso-')).forEach(c => b.classList.remove(c));
  b.classList.add('curso-' + (cursoDe(curso) ? curso : 'general'));
}

// ── Portada: lista de temas ──────────────────────────────────────
async function portada() {
  colorCurso('general');
  let temas = [];
  try { temas = await (await fetch('temas/indice.json', { cache: 'no-cache' })).json(); } catch { /* sin índice */ }
  const cursos = ['1eso', '2eso', '4eso', '1bach', '2bach'].filter(c => temas.some(t => t.curso === c));
  app.innerHTML = `${barra()}
  <section class="mcr-trama-banda"><div class="mcr-contenedor mcr-hero"><div class="mcr-hero__fila"><div><h1>Actividades interactivas</h1>
    <p class="hero-sub">Practica cada tema a tu ritmo. Se corrigen solas y tu progreso se guarda en este dispositivo.</p></div>
    <div class="visor-acciones"><a class="mcr-btn mcr-btn--prim" href="editor.html">Editor de actividades</a>
    <label class="mcr-btn mcr-btn--sec">Probar un archivo<input type="file" id="archivo" accept=".json,application/json" hidden></label></div></div></div></section>
  <main class="mcr-contenedor visor-main">
    ${cursos.map(c => `<h2 class="mcr-seccion curso-${c}">${esc(cursoDe(c).nombre)} · ${esc(cursoDe(c).materia)}</h2>
      <ul class="mcr-lista">${temas.filter(t => t.curso === c).sort((a, b) => a.numero - b.numero).map(t => {
        const hechas = Object.values(guardado('ai-' + t.tema, {})).filter(x => x.ok != null).length;
        return `<li class="mcr-tarjeta curso-${c}"><div><a class="mcr-tarjeta__titulo" href="?t=${encodeURIComponent(t.tema)}">Tema ${t.numero} · ${esc(t.titulo)}</a>
          <div class="mcr-tarjeta__meta">${t.actividades} actividades${hechas ? ` · has hecho ${hechas}` : ''}</div></div>
          <a class="mcr-btn mcr-btn--peq mcr-btn--prim" href="?t=${encodeURIComponent(t.tema)}">Abrir</a></li>`;
      }).join('')}</ul>`).join('') || '<p class="mcr-vacio">Todavía no hay temas publicados.</p>'}
  </main>${pie()}`;
  app.querySelectorAll('a[href^="?t="]').forEach(a => a.onclick = async e => {
    e.preventDefault();
    const t = new URLSearchParams(a.getAttribute('href')).get('t');
    URLP.set('t', t);
    try { history.pushState(null, '', a.getAttribute('href')); } catch { /* sin historial */ }
    try { verTema(await cargarTema(t)); scrollTo(0, 0); } catch { alertaSuave('No se ha podido abrir ese tema.'); }
  });
  app.querySelector('#archivo').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); verTema(d, { local: f.name }); }
    catch { alertaSuave('Ese archivo no es un JSON de actividades.'); }
  };
}

function alertaSuave(msg) {
  let p = app.querySelector('.visor-aviso');
  if (!p) { p = document.createElement('p'); p.className = 'aviso visor-aviso'; app.querySelector('main')?.prepend(p); }
  p.textContent = msg;
}

// ── Vista de un tema (o de un apartado / una actividad, para el libro) ──
async function cargarTema(tema) {
  const r = await fetch(`temas/${encodeURIComponent(tema)}-actividades.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('No encontrado');
  return r.json();
}

function verTema(datos, { local = '' } = {}) {
  const preguntas = (Array.isArray(datos) ? datos : datos.preguntas || []).filter(visible);
  const meta = Array.isArray(datos) ? {} : datos;
  const tema = meta.tema || preguntas[0]?.tema || 'local';
  const ap = meta.apartados || {};
  colorCurso(meta.curso);
  const clave = 'ai-' + (local ? 'local-' + tema : tema);
  const prog = guardado(clave, {});

  const filtroAp = URLP.get('a') || '';
  const filtroId = URLP.get('id') || '';
  const dentro = it => (!filtroId || it.id === filtroId) && (!filtroAp || it.ancla === filtroAp || String(it.ancla || '').startsWith(filtroAp + '.'));
  const mostradas = preguntas.filter(dentro);

  // Agrupar por apartado, en el orden del archivo
  const grupos = [];
  for (const it of mostradas) {
    const k = it.ancla || '';
    let g = grupos.find(x => x.k === k);
    if (!g) grupos.push(g = { k, items: [] });
    g.items.push(it);
  }
  const nombreAp = k => k ? `${k} · ${ap[k] || ap[k.split('.')[0]] || ''}`.replace(/ · $/, '') : 'Otras actividades';
  const capitulos = [...new Set(preguntas.map(it => String(it.ancla || '').split('.')[0]).filter(Boolean))];

  const titulo = meta.numero ? `Tema ${meta.numero} · ${meta.titulo || ''}` : (meta.titulo || local || 'Actividades');
  const curso = cursoDe(meta.curso);
  app.innerHTML = `${barra()}
  ${EMBED ? '' : `<section class="mcr-trama-banda"><div class="mcr-contenedor mcr-hero">
    <p class="hero-sup">${curso ? `${esc(curso.nombre)} · ${esc(meta.materia || curso.materia)}` : ''}${local ? ` · vista previa de ${esc(local)}` : ''}</p>
    <h1>${esc(titulo)}</h1>
    <div class="progreso" aria-live="polite"><span class="progreso-barra"><span id="prog-barra"></span></span><span id="prog-txt"></span>
      <button type="button" class="mcr-btn mcr-btn--peq mcr-btn--sec" id="borrar">Empezar de cero</button></div>
    ${filtroId ? '' : `<nav class="mcr-filtros" aria-label="Apartados"><a class="mcr-filtro curso-${esc(meta.curso || 'general')}" aria-pressed="${!filtroAp}" href="${enlace({ a: '' })}" data-nav='{"a":""}' >Todo el tema</a>${capitulos.map(c =>
      `<a class="mcr-filtro curso-${esc(meta.curso || 'general')}" aria-pressed="${filtroAp === c}" href="${enlace({ a: c })}" data-nav='{"a":"${esc(c)}"}' >${esc(c)} · ${esc(ap[c] || 'Apartado ' + c)}</a>`).join('')}</nav>`}
  </div></section>`}
  <main class="mcr-contenedor visor-main">
    ${grupos.map(g => `<section class="apartado">${EMBED && grupos.length < 2 ? '' : `<h2 class="mcr-seccion" id="ap-${esc(g.k)}">${esc(nombreAp(g.k))}</h2>`}
      ${g.items.map(it => `<article class="actividad tarjeta-act" id="act-${esc(it.id)}" data-id="${esc(it.id)}"></article>`).join('')}</section>`).join('')
      || '<p class="mcr-vacio">No hay actividades para mostrar aquí.</p>'}
    ${filtroId || filtroAp ? `<p class="ver-todo"><a href="${enlace({ a: '', id: '' })}" data-nav='{"a":"","id":""}' ${EMBED ? 'target="_blank"' : ''}>Ver todas las actividades del tema</a></p>` : ''}
  </main>${pie()}`;

  const porId = Object.fromEntries(mostradas.map(it => [it.id, it]));
  const progreso = () => {
    if (EMBED) return;
    const hechas = preguntas.filter(it => prog[it.id]?.ok != null).length;
    const bien = preguntas.filter(it => prog[it.id]?.ok === true).length;
    app.querySelector('#prog-barra').style.width = `${Math.round(hechas * 100 / (preguntas.length || 1))}%`;
    app.querySelector('#prog-txt').textContent = `${hechas} de ${preguntas.length} hechas · ${bien} perfectas`;
  };
  const anotar = (it, v, ok) => { prog[it.id] = { v, ok, at: Date.now() }; guardar(clave, prog); progreso(); };
  for (const el of app.querySelectorAll('.tarjeta-act')) pintarActividad(el, porId[el.dataset.id], prog[el.dataset.id], anotar);
  progreso();
  const b = app.querySelector('#borrar');
  if (b) b.onclick = () => {
    if (!b.dataset.seguro) { b.dataset.seguro = '1'; b.textContent = 'Pulsa otra vez para borrar tus respuestas'; setTimeout(() => { delete b.dataset.seguro; b.textContent = 'Empezar de cero'; }, 4000); return; }
    for (const k of Object.keys(prog)) delete prog[k];
    guardar(clave, prog); verTema(datos, { local });
  };
  app.querySelectorAll('[data-nav]').forEach(a => a.onclick = e => {
    if (EMBED && a.target) return;
    e.preventDefault();
    const c = JSON.parse(a.dataset.nav);
    for (const [k, v] of Object.entries(c)) v ? URLP.set(k, v) : URLP.delete(k);
    try { history.pushState(null, '', enlace(c)); } catch { /* sin historial */ }
    verTema(datos, { local });
    scrollTo(0, 0);
  });
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  avisarAltura();
}

function enlace(cambios) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(cambios)) v ? p.set(k, v) : p.delete(k);
  return '?' + p.toString();
}

// ── Una actividad ────────────────────────────────────────────────
// estado guardado: { v: respuesta, ok: true/false/null }. Si hay respuesta, se enseña corregida.
function pintarActividad(el, it, guardada, anotar) {
  const n = [...el.parentElement.querySelectorAll('.tarjeta-act')].indexOf(el) + 1;
  const cab = `<div class="act-cab"><p class="tipo">${esc(nombreTipo(it))}</p>
    <button type="button" class="btn-ico act-enlace" title="Copiar enlace a esta actividad" aria-label="Copiar enlace a esta actividad">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>
    <h3 class="enunciado">${rico(conDatos(it.prompt, it, UID))}</h3>`;
  const st = { pub: itemPublico(prepararSopa(it)), v: guardada?.v ?? null };
  const jugar = () => { st.pub = itemPublico(prepararSopa(it)); st.v = null; el.innerHTML = cab + '<div class="act-cuerpo">' + formulario(it, st.pub) + '</div>'; activar(); };
  const resolver = (v, ok) => { st.v = v; anotar(it, v, ok); mostrar(); };
  const mostrar = () => { el.innerHTML = cab + '<div class="act-cuerpo">' + resultado(it, st.v) + `<div class="act-acciones"><button type="button" class="btn" data-otra>Intentarlo otra vez</button></div></div>`; activarComun(); el.querySelector('[data-otra]').onclick = () => { jugar(); avisarAltura(); }; avisarAltura(); };
  const activarComun = () => {
    el.querySelector('.act-enlace').onclick = async () => {
      const u = new URL(location.href); u.search = ''; u.hash = '';
      u.searchParams.set('t', it.tema || URLP.get('t') || ''); u.searchParams.set('id', it.id);
      try { await navigator.clipboard.writeText(u.toString()); el.querySelector('.act-enlace').classList.add('copiado'); setTimeout(() => el.querySelector('.act-enlace')?.classList.remove('copiado'), 1500); }
      catch { const b = el.querySelector('.act-enlace'); b.title = u.toString(); b.classList.add('copiado'); }
    };
  };
  const activar = () => { activarComun(); activarFormulario(el, it, st.pub, resolver); };
  if (st.v != null) mostrar(); else jugar();
}

// Si la sopa no trae la cuadrícula (actividad escrita a mano), se genera aquí
function prepararSopa(it) {
  if (it.type !== 'search' || it.grid) return it;
  const g = generarSopa(it.words || [], { inversas: !!it.reverse });
  return Object.assign(it, g || {});
}

function formulario(it, pub) {
  if (it.type === 'quiz') {
    return `<div class="opciones-alumno" role="group">${(pub.options || []).map((o, i) => `<button type="button" class="op-alumno" data-op="${i}">${rico(o)}</button>`).join('')}</div>`;
  }
  if (it.type === 'short') return `<form class="form-resp"><textarea class="txt" rows="2" maxlength="500" required placeholder="Escribe tu respuesta"></textarea><button class="btn primario">Comprobar</button></form>`;
  if (it.type === 'number') {
    const pedir = pub.unitMode === 'ask';
    return `<form class="form-resp"><div class="fila-num">
      <input class="num" inputmode="decimal" required placeholder="Valor" aria-label="Valor numérico">
      ${pedir ? `<input class="uni" required placeholder="Unidad" aria-label="Unidad">` : (pub.unit ? `<span class="uni-fija">${esc(pub.unit)}</span>` : '')}</div>
      <p class="ayuda meta">Decimales con coma; potencias así: 3,2·10^4 o 3,2e4.</p>
      <button class="btn primario">Comprobar</button></form>`;
  }
  if (it.type === 'memory') {
    return `<p class="marcador-memory">Parejas: 0 de ${(pub.cards || []).length / 2} · Intentos: 0</p>
      <div class="memory">${(pub.cards || []).map((c, j) => `<button type="button" class="carta" data-j="${j}" aria-label="Carta ${j + 1}"><span class="carta-dorso" aria-hidden="true"></span><span class="carta-cara">${rico(c.t)}</span></button>`).join('')}</div>`;
  }
  if (it.type === 'search') {
    const n = (pub.words || pub.h || []).length;
    return `${pintarSopa(pub, [], { editable: true })}
      <p class="estado-act estado-sopa" aria-live="polite">Has encontrado 0 de ${n}. Pulsa la primera letra y después la última (o arrastra).</p>
      <div class="act-acciones"><button type="button" class="btn" data-rendirse>Ver la solución</button></div>`;
  }
  if (POR_PARTES.includes(it.type)) {
    return `<form class="form-resp form-partes">${pintarPartes(pub, null, { editable: true })}
      <p class="aviso" role="alert"></p><button class="btn primario">Comprobar</button></form>`;
  }
  return '<p class="estado-act">Esta actividad solo se puede hacer en clase.</p>';
}

function activarFormulario(el, it, pub, resolver) {
  const cuerpo = el.querySelector('.act-cuerpo');
  if (it.type === 'quiz') {
    cuerpo.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
      const v = Number(b.dataset.op);
      resolver(v, it.poll ? null : comprobar(it, v, UID));
    });
    return;
  }
  if (it.type === 'short') {
    cuerpo.querySelector('form').onsubmit = e => { e.preventDefault(); const v = cuerpo.querySelector('.txt').value.trim(); if (v) resolver(v, comprobar(it, v, UID)); };
    return;
  }
  if (it.type === 'number') {
    cuerpo.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const v = { n: cuerpo.querySelector('.num').value.trim() };
      const u = cuerpo.querySelector('.uni'); if (u) v.u = u.value.trim();
      if (v.n) resolver(v, comprobar(it, v, UID));
    };
    return;
  }
  if (it.type === 'memory') { jugarMemory(cuerpo, pub, v => resolver(v, true)); return; }
  if (it.type === 'search') {
    jugarSopa(cuerpo, pub, (halladas, fin) => { if (fin) resolver(halladas, true); });
    cuerpo.querySelector('[data-rendirse]').onclick = () => {
      const h = cuerpo._halladas || [];
      resolver(h, h.length === (it.words || []).length);
    };
    return;
  }
  if (POR_PARTES.includes(it.type)) {
    const f = cuerpo.querySelector('form');
    f.onclick = e => { const b = e.target.closest('[data-mover]'); if (b) moverOrden(b); };
    f.onsubmit = e => {
      e.preventDefault();
      const v = leerPartes(cuerpo, pub);
      if (it.type !== 'order' && v.some(x => !x)) { f.querySelector('.aviso').textContent = it.type === 'match' ? 'Elige una pareja para cada elemento.' : it.type === 'label' ? 'Pon un nombre a cada número.' : 'Rellena todos los huecos.'; return; }
      resolver(v, comprobar(it, v, UID));
    };
  }
}

function resultado(it, v) {
  if (it.type === 'quiz') {
    return `<ul class="opciones-alumno opciones-res">${(it.options || []).map((o, i) => {
      const buena = !it.poll && i === Number(it.correct), mia = i === Number(v);
      return `<li class="op-alumno ${buena ? 'ok' : mia ? 'mal' : ''} ${mia ? 'elegida' : ''}">${rico(o)}${buena ? ' <span class="marca-ok">correcta</span>' : ''}${mia ? ' <span class="marca-yo">tu respuesta</span>' : ''}</li>`;
    }).join('')}</ul>${it.poll ? '' : veredicto(comprobar(it, v, UID))}`;
  }
  if (it.type === 'short' || it.type === 'number') {
    const ok = comprobar(it, v, UID);
    const sol = it.type === 'number' ? esc(solucionTexto(it, UID)) : esc(String(it.accepted || '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 3).join(' · '));
    return `<p class="tu-resp ${ok ? 'ok' : 'mal'}">Tu respuesta: <strong>${respuestaHTML(it, v)}</strong>. ${ok ? '¡Correcta!' : 'No es correcta.'}</p>
      ${ok ? '' : `<details class="ver-sol"><summary>Ver la solución</summary><p class="solucion">${it.type === 'number' ? 'Solución' : 'Respuestas válidas'}: <strong>${sol}</strong></p></details>`}`;
  }
  if (it.type === 'memory') {
    return `<p class="tu-resp ok">¡Completado en <strong>${v?.intentos} intentos</strong>${v?.seg ? ` (${v.seg} s)` : ''}!</p>
      <ul class="parejas">${(it.pairs || []).map(p => `<li><span class="pareja-izq">${rico(p[0])}</span><span class="pareja-flecha" aria-hidden="true">→</span><span>${rico(p[1])}</span></li>`).join('')}</ul>`;
  }
  if (it.type === 'search') {
    const n = (it.words || []).length, h = lista(v).length;
    return pintarSopa(it, v, { conSolucion: true }) + `<p class="tu-resp ${h === n ? 'ok' : 'mal'}"><strong>${h} de ${n}</strong> palabras encontradas.${h < n ? ' Las que faltaban están marcadas con borde.' : ' ¡Muy bien!'}</p>`;
  }
  if (POR_PARTES.includes(it.type)) {
    const ok = aciertosPorParte(it, v), n = ok.filter(Boolean).length;
    return pintarPartes(it, v) + `<p class="tu-resp ${n === ok.length ? 'ok' : 'mal'}"><strong>${n} de ${ok.length}</strong> ${n === ok.length ? 'correctas. ¡Muy bien!' : 'correctas. Junto a cada fallo tienes la respuesta buena.'}</p>`;
  }
  return '';
}

const veredicto = ok => ok == null ? '' : `<p class="tu-resp ${ok ? 'ok' : 'mal'}">${ok ? '¡Correcta!' : 'No es correcta: fíjate en la opción marcada como correcta.'}</p>`;

// ── Memory ───────────────────────────────────────────────────────
function jugarMemory(el, pub, fin) {
  const cartas = pub.cards || [], total = cartas.length / 2, inicio = Date.now();
  let abiertas = [], hechas = 0, intentos = 0, bloqueo = false;
  const marcador = () => { el.querySelector('.marcador-memory').textContent = `Parejas: ${hechas} de ${total} · Intentos: ${intentos}`; };
  el.querySelector('.memory').onclick = e => {
    const b = e.target.closest('.carta');
    if (!b || bloqueo || b.classList.contains('vuelta') || b.classList.contains('hecha')) return;
    b.classList.add('vuelta'); abiertas.push(b);
    if (abiertas.length < 2) return;
    intentos++;
    const [a, c] = abiertas; abiertas = [];
    if (cartas[a.dataset.j].k === cartas[c.dataset.j].k) {
      a.classList.add('hecha'); c.classList.add('hecha'); hechas++; marcador();
      if (hechas === total) setTimeout(() => fin({ hecho: true, intentos, seg: Math.round((Date.now() - inicio) / 1000) }), 700);
    } else {
      marcador(); bloqueo = true;
      setTimeout(() => { a.classList.remove('vuelta'); c.classList.remove('vuelta'); bloqueo = false; }, 1100);
    }
  };
}

// ── Sopa de letras: pulsar primera y última letra, o arrastrar ───
function jugarSopa(el, pub, cambio) {
  const estado = el.querySelector('.estado-sopa');
  const halladas = el._halladas = [];
  const total = (pub.words || pub.h || []).length;
  let inicio = null, arrastrando = false;
  const sopa = () => el.querySelector('.sopa');
  const celda = (r, c) => sopa().querySelector(`[data-r="${r}"][data-c="${c}"]`);
  const limpiar = () => sopa().querySelectorAll('.marcando, .inicio').forEach(x => x.classList.remove('marcando', 'inicio'));
  const marcar = fin => { limpiar(); if (!inicio) return; celda(...inicio)?.classList.add('inicio'); if (fin) (lineaSopa(...inicio, ...fin) || []).forEach(([r, c]) => celda(r, c)?.classList.add('marcando')); };
  const terminar = fin => {
    const celdas = lineaSopa(...inicio, ...fin);
    inicio = null; limpiar();
    if (!celdas) { estado.textContent = 'Las letras tienen que estar en línea recta.'; return; }
    const i = palabraSopa(pub, celdas);
    if (i < 0) { estado.textContent = 'Esa no es una de las palabras. Prueba otra vez.'; sopa().classList.add('fallo'); setTimeout(() => sopa()?.classList.remove('fallo'), 400); return; }
    if (halladas.some(h => h.i === i)) { estado.textContent = 'Esa palabra ya la tenías.'; return; }
    const [[r1, c1], [r2, c2]] = [celdas[0], celdas[celdas.length - 1]];
    halladas.push({ i, r1, c1, r2, c2 });
    el.querySelector('.sopa-caja').outerHTML = pintarSopa(pub, halladas, { editable: true });
    activarSopa();
    estado.textContent = halladas.length === total ? '¡Has encontrado todas las palabras!' : `Has encontrado ${halladas.length} de ${total}.`;
    cambio(halladas, halladas.length === total);
  };
  const activarSopa = () => {
    const s = sopa();
    const deEvento = e => { const b = document.elementFromPoint(e.clientX, e.clientY)?.closest('.celda'); return b && s.contains(b) ? [Number(b.dataset.r), Number(b.dataset.c)] : null; };
    s.onpointerdown = e => {
      const p = deEvento(e); if (!p) return;
      e.preventDefault();
      if (inicio && (inicio[0] !== p[0] || inicio[1] !== p[1])) return terminar(p);
      inicio = p; arrastrando = true; marcar();
      estado.textContent = `Has encontrado ${halladas.length} de ${total}. Ahora pulsa la última letra.`;
    };
    s.onpointermove = e => { if (arrastrando && inicio) { const p = deEvento(e); if (p) marcar(p); } };
    s.onpointerup = e => { if (!arrastrando) return; arrastrando = false; const p = deEvento(e); if (inicio && p && (p[0] !== inicio[0] || p[1] !== inicio[1])) terminar(p); };
    s.onpointercancel = () => { arrastrando = false; };
  };
  activarSopa();
}

// ── Altura para el libro (iframe) ────────────────────────────────
function avisarAltura() {
  if (!EMBED || parent === window) return;
  requestAnimationFrame(() => parent.postMessage({ tipo: 'mcr-actividades-altura', id: URLP.get('a') || URLP.get('id') || '', h: document.documentElement.scrollHeight }, '*'));
}
if (EMBED) new ResizeObserver(avisarAltura).observe(document.body);

// ── Arranque ─────────────────────────────────────────────────────
addEventListener('popstate', () => location.reload());
const t = URLP.get('t');
if (URLP.has('borrador')) {
  // Vista previa desde el editor: el borrador está guardado en este navegador
  const d = guardado('ae-borrador', null);
  if (d) verTema(d, { local: 'borrador del editor' });
  else app.innerHTML = `${barra()}<main class="mcr-contenedor visor-main"><p class="mcr-vacio">No hay ningún borrador abierto en el editor de este navegador.</p></main>${pie()}`;
} else if (t) {
  cargarTema(t).then(d => verTema(d)).catch(() => {
    app.innerHTML = `${barra()}<main class="mcr-contenedor visor-main"><p class="mcr-vacio">No se ha encontrado el tema «${esc(t)}».</p><p><a href="./">Volver a los temas</a></p></main>${pie()}`;
  });
} else portada();
