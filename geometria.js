// Moléculas en 3D: se escribe la fórmula semidesarrollada o se dibuja con JSME; OpenChemLib calcula
// la geometría 3D y 3Dmol.js la muestra (girar, medir). Todo en el navegador, sin servidor.
import * as OCL from 'https://cdn.jsdelivr.net/npm/openchemlib@9.25.0/dist/openchemlib.js';
import { semidesarrollada } from './semidesarrollada.js';

const URLP = new URLSearchParams(location.search);
if (URLP.has('embed')) {
  document.body.classList.add('embed');
  document.querySelectorAll('[data-sin-embed]').forEach(e => e.remove());
}

// Colores de hibridación (los mismos en la leyenda, la tabla y el 3D)
const HIB = {
  0: { n: 'sp³', geo: 'tetraédrica', ang: '109,5°', color: '#475569' },
  1: { n: 'sp²', geo: 'triangular plana', ang: '120°', color: '#F59E0B' },
  2: { n: 'sp', geo: 'lineal', ang: '180°', color: '#8B5CF6' }
};
const CPK = { H: '#FFFFFF', C: '#475569', N: '#2563EB', O: '#E11D48', F: '#10B981', Cl: '#10B981', Br: '#9A3412', I: '#7C3AED', S: '#EAB308', P: '#F97316' };

// [nombre, fórmula que se escribe en la caja (o SMILES si empieza por «=»)]
const EJEMPLOS = [
  ['Metano', 'CH4'], ['Etano', 'CH3–CH3'], ['Eteno', 'CH2=CH2'], ['Etino', 'CH≡CH'],
  ['Propeno', 'CH2=CH–CH3'], ['Propino', 'CH≡C–CH3'], ['Propadieno', 'CH2=C=CH2'], ['Buta-1,3-dieno', 'CH2=CH–CH=CH2'],
  ['Ciclohexano', 'C6H12'], ['Benceno', 'C6H6'], ['Etanol', 'CH3–CH2–OH'], ['Etanal', 'CH3–CHO'],
  ['Propanona', 'CH3–CO–CH3'], ['Ácido etanoico', 'CH3–COOH'], ['Etanonitrilo', 'CH3–CN'], ['Ácido 2-aminopropanoico', 'CH3–CH(NH2)–COOH']
];
const smilesDe = f => f === 'CH4' ? { smiles: 'C' } : semidesarrollada(f);

const $ = s => document.querySelector(s);
const visorEl = $('#visor');
const v = $3Dmol.createViewer(visorEl, { backgroundColor: 'white', antialias: true });
const estado = { estilo: 'bolas', mol: null, sel: [], firma: '', atomos: [] };

// ── Entrada: fórmula escrita ─────────────────────────────────────
function aviso(texto, tipo = 'aviso') {
  const p = $('#aviso-formula');
  p.textContent = texto || '';
  p.className = texto ? tipo : '';
}
function verFormula(formula, nombre = '') {
  $('#formula').value = formula;
  const r = smilesDe(formula);
  const limpiar = () => { marcarEjemplo(''); estado.firma = ''; mostrar('', { alDibujo: false }); resumen(); };
  if (r.error) { aviso(r.error); limpiar(); return; }
  if (r.h != null) {
    let real = null;
    try { const f = OCL.Molecule.fromSmiles(r.smiles).getMolecularFormula().formula.match(/H(\d*)/); real = f ? (f[1] ? Number(f[1]) : 1) : 0; } catch { /* lo dirá mostrar() */ }
    if (real != null && real !== r.h) {
      aviso(`Los hidrógenos no cuadran: has escrito ${r.h} H, pero con esos enlaces la molécula tendría ${real}. Recuerda que cada carbono forma 4 enlaces.`);
      limpiar(); return;
    }
  }
  aviso('');
  marcarEjemplo(nombre);
  mostrar(r.smiles, { alDibujo: true });
}
$('#form-formula').onsubmit = e => {
  e.preventDefault();
  const f = $('#formula').value.trim();
  const ej = EJEMPLOS.find(x => x[1].replace(/–/g, '-') === f.replace(/[–—−]/g, '-'));
  verFormula(f, ej ? ej[0] : '');
};

function pintarEjemplos() {
  $('#ejemplos').innerHTML = EJEMPLOS.map(([n]) => `<button type="button" class="geo-chip" aria-pressed="false">${n}</button>`).join('');
  $('#ejemplos').onclick = e => {
    const b = e.target.closest('.geo-chip'); if (!b) return;
    const ej = EJEMPLOS.find(x => x[0] === b.textContent);
    verFormula(ej[1], ej[0]);
  };
}
function marcarEjemplo(nombre) {
  document.querySelectorAll('#ejemplos .geo-chip').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === nombre)));
}

// ── Entrada: dibujo (JSME) ───────────────────────────────────────
let jsme = null, cargandoDibujo = false;
function arrancarDibujo() {
  window.jsmeOnLoad = () => {
    const caja = $('#editor');
    caja.innerHTML = '<div id="jsme" style="width:100%;height:100%"></div>';
    jsme = new JSApplet.JSME('jsme', '100%', '100%', { options: 'newlook,noreaction,noquery,nosearchinchiKey,nopaste,nostar,zoom,atommovebutton' });
    jsme.setCallBack('AfterStructureModified', () => {
      if (cargandoDibujo) return;
      clearTimeout(arrancarDibujo.t);
      arrancarDibujo.t = setTimeout(() => {
        const sm = jsme.smiles();
        marcarEjemplo(''); $('#formula').value = ''; aviso('');
        mostrar(sm, { alDibujo: false });
      }, 300);
    });
    if (estado.smiles) pasarAlDibujo(estado.smiles);
  };
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/jsme-editor@2024.4.29/jsme.nocache.js';
  s.onerror = () => { $('#editor').innerHTML = '<p class="aviso">No se ha podido cargar el editor de dibujo. Puedes seguir escribiendo la fórmula.</p>'; };
  document.head.append(s);
}
function pasarAlDibujo(smiles) {
  if (!jsme) return;
  cargandoDibujo = true;
  try { jsme.readGenericMolecularInput(smiles); } catch { /* nada */ }
  setTimeout(() => { cargandoDibujo = false; }, 400);
}

// ── 3D ───────────────────────────────────────────────────────────
function mostrar(smiles, { alDibujo }) {
  estado.smiles = smiles;
  if (alDibujo) pasarAlDibujo(smiles);
  estado.sel = [];
  v.removeAllModels(); v.removeAllLabels(); v.removeAllShapes();
  estado.mol = null;
  if (!smiles) { resumen(); medida(); pintarLeyenda(); v.render(); return; }
  let base;
  try { base = OCL.Molecule.fromSmiles(smiles); } catch { base = null; }
  if (!base || !base.getAllAtoms()) { resumen('No se ha podido leer esta molécula.'); medida(); v.render(); return; }
  // Trozos sueltos: se avisa y se enseña el mayor
  const trozos = base.getFragments();
  let nota = '';
  if (trozos.length > 1) {
    base = trozos.sort((a, b) => b.getAllAtoms() - a.getAllAtoms())[0];
    nota = `Tu dibujo tiene ${trozos.length} trozos sin unir. Se muestra solo el más grande: une todos los átomos en una sola molécula.`;
  }
  try { base.validate(); } catch {
    resumen('Algún átomo tiene más enlaces de los que puede formar (el carbono, como máximo 4). Revisa la fórmula o el dibujo.');
    medida(); v.render(); return;
  }
  let mol = null;
  try { mol = new OCL.ConformerGenerator(7).getOneConformerAsMolecule(base); } catch { mol = null; }
  if (!mol) { resumen('No se ha podido construir esta molécula en 3D. Revisa que cada átomo tenga los enlaces que le corresponden.'); medida(); v.render(); return; }
  mol.ensureHelperArrays(OCL.Molecule.cHelperNeighbours);
  orientar(mol);
  estado.mol = mol;
  const modelo = v.addModel(mol.toMolfile(), 'sdf');
  estado.atomos = modelo.selectedAtoms({});
  v.setClickable({}, true, atomo => elegir(atomo.index));
  v.setHoverable({}, true, atomo => {
    if (estado.hover) v.removeLabel(estado.hover);
    estado.hover = v.addLabel(nombreAtomo(atomo.index), { position: atomo, backgroundColor: '#1E293B', fontColor: '#FFFFFF', fontSize: 12, borderRadius: 4, padding: 3, inFront: true, alignment: 'bottomLeft' });
    v.render();
  }, () => { if (estado.hover) { v.removeLabel(estado.hover); estado.hover = null; v.render(); } });
  pintarModelo();
  v.zoomTo(); v.zoom(1.1);
  v.render();
  resumen(); medida();
  if (nota) aviso(nota);
}

// Gira la molécula para que se vea «de frente»: el eje en el que menos se extiende queda hacia quien mira
function orientar(mol) {
  const n = mol.getAllAtoms(), P = [];
  for (let i = 0; i < n; i++) P.push([mol.getAtomX(i), mol.getAtomY(i), mol.getAtomZ(i)]);
  const c = [0, 1, 2].map(k => P.reduce((s, p) => s + p[k], 0) / n);
  const Q = P.map(p => p.map((x, k) => x - c[k]));
  const A = [0, 1, 2].map(a => [0, 1, 2].map(b => Q.reduce((s, q) => s + q[a] * q[b], 0)));
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {          // Jacobi para la matriz de covarianza (3 × 3)
    let p = 0, q = 1;
    if (Math.abs(A[0][2]) > Math.abs(A[p][q])) { p = 0; q = 2; }
    if (Math.abs(A[1][2]) > Math.abs(A[p][q])) { p = 1; q = 2; }
    if (Math.abs(A[p][q]) < 1e-10) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = cs * a - sn * b; A[k][q] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = cs * a - sn * b; A[q][k] = sn * a + cs * b; }
    for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = cs * a - sn * b; V[k][q] = sn * a + cs * b; }
  }
  const orden = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);   // mayor → x, menor → z
  Q.forEach((q, i) => {
    const r = orden.map(k => q[0] * V[0][k] + q[1] * V[1][k] + q[2] * V[2][k]);
    mol.setAtomX(i, r[0]); mol.setAtomY(i, r[1]); mol.setAtomZ(i, r[2]);
  });
}

const esCarbono = i => estado.mol.getAtomicNo(i) === 6;
const simbolo = i => estado.mol.getAtomLabel(i);
function colorAtomo(i) {
  if (esCarbono(i) && $('#c-hib').checked) return HIB[Math.min(estado.mol.getAtomPi(i), 2)].color;
  return CPK[simbolo(i)] || '#94A3B8';
}

function pintarModelo() {
  if (!estado.mol) return;
  const n = estado.mol.getAllAtoms();
  v.setStyle({}, {});
  for (let i = 0; i < n; i++) {
    const color = colorAtomo(i), H = simbolo(i) === 'H';
    const s = estado.estilo === 'relleno' ? { sphere: { scale: 1, color } }
      : estado.estilo === 'varillas' ? { stick: { radius: 0.14, color } }
      : { stick: { radius: 0.12, color }, sphere: { scale: H ? 0.2 : 0.28, color } };
    v.setStyle({ index: i }, s);
  }
  // Átomos elegidos para medir
  for (const i of estado.sel) v.setStyle({ index: i }, estado.estilo === 'relleno' ? { sphere: { scale: 1.05, color: '#E11D48' } }
    : { stick: { radius: estado.estilo === 'varillas' ? 0.14 : 0.12, color: colorAtomo(i) }, sphere: { scale: 0.36, color: '#E11D48' } });
  v.removeAllLabels(); estado.hover = null;
  if ($('#c-etq').checked) {
    for (let i = 0; i < n; i++) if (esCarbono(i)) {
      const h = HIB[Math.min(estado.mol.getAtomPi(i), 2)];
      v.addLabel(h.n, { position: pos(i), backgroundColor: h.color, fontColor: h.color === '#F59E0B' ? '#1E293B' : '#FFFFFF', fontSize: 13, borderRadius: 4, padding: 2, inFront: true, alignment: 'bottomCenter' });
    }
  }
  pintarLeyenda();
  v.render();
}

function pintarLeyenda() {
  const elems = estado.mol ? [...new Set(Array.from({ length: estado.mol.getAllAtoms() }, (_, i) => simbolo(i)))] : [];
  const hib = $('#c-hib').checked;
  const usados = estado.mol && hib ? [...new Set(Array.from({ length: estado.mol.getAllAtoms() }, (_, i) => i).filter(esCarbono).map(i => Math.min(estado.mol.getAtomPi(i), 2)))].sort() : [];
  $('#leyenda').innerHTML = [
    ...usados.map(k => `<span><i style="background:${HIB[k].color}"></i>C ${HIB[k].n}</span>`),
    ...elems.filter(e => !(e === 'C' && hib)).map(e => `<span><i style="background:${CPK[e] || '#94A3B8'}"></i>${e}</span>`)
  ].join('');
}

const pos = i => { const a = estado.atomos[i]; return { x: a.x, y: a.y, z: a.z }; };
const resta = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const largo = u => Math.hypot(...u);
const coma = (x, d) => x.toFixed(d).replace('.', ',');
const vecinos = (i, j) => { for (let k = 0; k < estado.mol.getAllConnAtoms(i); k++) if (estado.mol.getConnAtom(i, k) === j) return true; return false; };

function elegir(i) {
  const s = estado.sel;
  if (s.length && s[s.length - 1] === i) s.pop();
  else { if (s.length >= 3) s.length = 0; s.push(i); }
  v.removeAllShapes();
  for (let k = 1; k < s.length; k++) v.addCylinder({ start: pos(s[k - 1]), end: pos(s[k]), radius: 0.035, color: '#E11D48', dashed: true, fromCap: 1, toCap: 1 });
  pintarModelo(); medida();
}

function nombreAtomo(i) {
  if (!esCarbono(i)) return simbolo(i);
  return `C (${HIB[Math.min(estado.mol.getAtomPi(i), 2)].n})`;
}
function medida() {
  const s = estado.sel, p = $('#medida');
  if (!estado.mol || !s.length) { p.innerHTML = 'Pulsa dos átomos para medir la distancia de enlace, o tres para medir el ángulo (el segundo es el vértice).'; return; }
  if (s.length === 1) { p.innerHTML = `Has elegido <strong>${nombreAtomo(s[0])}</strong>. Pulsa otro átomo.`; return; }
  const d = largo(resta(pos(s[0]), pos(s[1])));
  let txt = `Distancia ${simbolo(s[0])}–${simbolo(s[1])}: <strong>${coma(d, 2)} Å</strong> (${coma(d * 100, 0)} pm)${vecinos(s[0], s[1]) ? '' : ' · <span class="meta">estos dos átomos no están enlazados</span>'}`;
  if (s.length === 3) {
    const u = resta(pos(s[0]), pos(s[1])), w = resta(pos(s[2]), pos(s[1]));
    const ang = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / largo(u) / largo(w)))) * 180 / Math.PI;
    const c = s[1], teo = esCarbono(c) ? HIB[Math.min(estado.mol.getAtomPi(c), 2)] : null;
    txt = `Ángulo ${simbolo(s[0])}–${simbolo(s[1])}–${simbolo(s[2])}: <strong>${coma(ang, 1)}°</strong>`
      + (teo ? ` · el vértice es un carbono ${teo.n}: geometría ${teo.geo}, ángulo ideal ${teo.ang}` : '')
      + (vecinos(s[0], s[1]) && vecinos(s[1], s[2]) ? '' : ' · <span class="meta">el segundo átomo tiene que estar enlazado a los otros dos</span>');
  }
  p.innerHTML = txt;
}

function resumen(error) {
  const caja = $('#resumen');
  if (error) { caja.innerHTML = `<p class="aviso">${error}</p>`; return; }
  if (!estado.mol) { caja.innerHTML = '<p class="meta">Dibuja una molécula para ver sus carbonos.</p>'; return; }
  const n = estado.mol.getAllAtoms(), cuenta = { 0: 0, 1: 0, 2: 0 };
  let carbonos = 0;
  for (let i = 0; i < n; i++) if (esCarbono(i)) { cuenta[Math.min(estado.mol.getAtomPi(i), 2)]++; carbonos++; }
  const formula = estado.mol.getMolecularFormula().formula.replace(/(\d+)/g, '<sub>$1</sub>');
  caja.innerHTML = `<p>Fórmula molecular: <strong class="geo-formula">${formula}</strong> · ${carbonos} carbono${carbonos === 1 ? '' : 's'}</p>
    <table class="geo-tabla"><thead><tr><th>Hibridación</th><th>Carbonos</th><th>Geometría</th><th>Ángulo ideal</th><th>Enlaces del carbono</th></tr></thead><tbody>
    ${[0, 1, 2].map(k => `<tr class="${cuenta[k] ? '' : 'geo-cero'}"><td><i class="geo-punto" style="background:${HIB[k].color}"></i>${HIB[k].n}</td><td>${cuenta[k]}</td><td>${HIB[k].geo}</td><td>${HIB[k].ang}</td><td>${['4 simples (4 σ)', '1 doble y 2 simples (3 σ + 1 π)', '1 triple y 1 simple, o 2 dobles (2 σ + 2 π)'][k]}</td></tr>`).join('')}
    </tbody></table>`;
}

// ── Controles ────────────────────────────────────────────────────
document.querySelectorAll('[data-estilo]').forEach(b => b.onclick = () => {
  estado.estilo = b.dataset.estilo;
  document.querySelectorAll('[data-estilo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  pintarModelo();
});
$('#c-hib').onchange = pintarModelo;
$('#c-etq').onchange = pintarModelo;
$('#c-girar').onchange = e => v.spin(e.target.checked ? 'y' : false);
$('#borrar-medida').onclick = () => { estado.sel = []; v.removeAllShapes(); pintarModelo(); medida(); };
addEventListener('resize', () => { v.resize(); v.render(); });

pintarEjemplos();
OCL.Resources.registerFromUrl('https://cdn.jsdelivr.net/npm/openchemlib@9.25.0/dist/resources.json').catch(() => {}).finally(() => {
  const ej = EJEMPLOS.find(e => e[0].toLowerCase() === (URLP.get('m') || '').toLowerCase()) || EJEMPLOS[2];
  verFormula(ej[1], ej[0]);
  arrancarDibujo();
});
window.mcrGeo = { elegir, verFormula };
