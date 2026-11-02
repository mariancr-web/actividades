// Moléculas en 3D: editor de OpenChemLib (dibujar) + generador de conformaciones de OpenChemLib (3D)
// + 3Dmol.js (ver, girar, medir). Todo en el navegador, sin servidor.
import * as OCL from 'https://cdn.jsdelivr.net/npm/openchemlib@9.25.0/dist/openchemlib.js';

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

const EJEMPLOS = [
  ['Metano', 'C'], ['Etano', 'CC'], ['Eteno', 'C=C'], ['Etino', 'C#C'],
  ['Propeno', 'C=CC'], ['Propino', 'C#CC'], ['Propadieno', 'C=C=C'], ['Buta-1,3-dieno', 'C=CC=C'],
  ['Ciclohexano', 'C1CCCCC1'], ['Benceno', 'c1ccccc1'], ['Etanol', 'CCO'], ['Etanal', 'CC=O'],
  ['Propanona', 'CC(C)=O'], ['Ácido etanoico', 'CC(=O)O'], ['Etanonitrilo', 'CC#N'], ['Ácido 2-aminopropanoico', 'CC(N)C(=O)O']
];

const $ = s => document.querySelector(s);
const visorEl = $('#visor');
const v = $3Dmol.createViewer(visorEl, { backgroundColor: 'white', antialias: true });
const estado = { estilo: 'bolas', mol: null, sel: [], firma: '' };

// ── Editor ───────────────────────────────────────────────────────
let editor = null;
async function arrancar() {
  try { await OCL.Resources.registerFromUrl('https://cdn.jsdelivr.net/npm/openchemlib@9.25.0/dist/resources.json'); }
  catch { /* el generador funciona peor, pero funciona */ }
  const caja = $('#editor');
  caja.innerHTML = '';
  editor = new OCL.CanvasEditor(caja, { initialMode: 'molecule' });
  let espera = null;
  editor.setOnChangeListener(() => { clearTimeout(espera); espera = setTimeout(actualizar3D, 350); });
  const inicial = EJEMPLOS.find(e => e[0].toLowerCase() === (URLP.get('m') || '').toLowerCase()) || EJEMPLOS[2];
  cargarEjemplo(inicial[1], inicial[0]);
}

function pintarEjemplos() {
  $('#ejemplos').innerHTML = EJEMPLOS.map(([n, s]) => `<button type="button" class="geo-chip" data-s="${s}" aria-pressed="false">${n}</button>`).join('');
  $('#ejemplos').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    cargarEjemplo(b.dataset.s, b.textContent);
  };
}
function marcarEjemplo(nombre) {
  document.querySelectorAll('#ejemplos [data-s]').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === nombre)));
}
function cargarEjemplo(smiles, nombre) {
  const m = OCL.Molecule.fromSmiles(smiles);
  // Tamaño cómodo en el lienzo: enlaces de unos 45 px, centrado
  const caja = $('#editor').getBoundingClientRect();
  const media = m.getAverageBondLength(true) || 1;
  m.scaleCoords(90 / media);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < m.getAllAtoms(); i++) { x0 = Math.min(x0, m.getAtomX(i)); x1 = Math.max(x1, m.getAtomX(i)); y0 = Math.min(y0, m.getAtomY(i)); y1 = Math.max(y1, m.getAtomY(i)); }
  m.translateCoords(caja.width / 2 + 20 - (x0 + x1) / 2, caja.height / 2 - (y0 + y1) / 2);
  editor.setMolecule(m);
  marcarEjemplo(nombre);
  actualizar3D();
}

// ── 3D ───────────────────────────────────────────────────────────
function actualizar3D() {
  const dibujo = editor.getMolecule();
  const firma = dibujo.getIDCode();
  if (firma === estado.firma) return;
  estado.firma = firma;
  // Si se ha dibujado a mano, se quita la marca del ejemplo
  const ej = document.querySelector('#ejemplos [aria-pressed="true"]');
  if (ej && OCL.Molecule.fromSmiles(ej.dataset.s).getIDCode() !== firma) marcarEjemplo('');
  estado.sel = [];
  v.removeAllModels(); v.removeAllLabels(); v.removeAllShapes();
  if (!dibujo.getAllAtoms()) { estado.mol = null; resumen(); medida(); v.render(); return; }
  const copia = dibujo.getCompactCopy();
  let mol = null;
  try { mol = new OCL.ConformerGenerator(7).getOneConformerAsMolecule(copia); } catch { mol = null; }
  if (!mol) { estado.mol = null; resumen('No se ha podido construir esta molécula en 3D. Revisa que cada átomo tenga los enlaces que le corresponden.'); medida(); v.render(); return; }
  mol.ensureHelperArrays(OCL.Molecule.cHelperNeighbours);
  orientar(mol);
  estado.mol = mol;
  const modelo = v.addModel(mol.toMolfile(), 'sdf');
  estado.atomos = modelo.selectedAtoms({});
  v.setClickable({}, true, atomo => elegir(atomo.index));
  pintarModelo();
  v.zoomTo(); v.zoom(1.1);
  v.render();
  resumen(); medida();
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
  v.removeAllLabels();
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
arrancar().catch(() => { $('#editor').innerHTML = '<p class="aviso">No se ha podido cargar el editor. Comprueba la conexión a internet y recarga la página.</p>'; });
window.mcrGeo = { elegir, cargarEjemplo };
