// Fórmula semidesarrollada (CH3–CH=CH2, CH3-CH(OH)-COOH, CH3COCH3…) → SMILES.
// Devuelve { smiles } o { error } con un mensaje para el alumnado.
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

// Grupos que se reconocen, en el orden en que se prueban (los largos primero)
const GRUPOS = [
  [/^HOOC/, 'OC(=O)', false],      // al principio: HOOC–CH2–…
  [/^OHC/, 'O=C', false],
  [/^NC(?![l])/, 'N#C', false],
  [/^HO/, 'O', false],
  [/^COOH/, 'C(=O)O', true],
  [/^CONH2/, 'C(=O)N', true],
  [/^COO/, 'C(=O)O', false],       // éster: sigue la cadena por el O
  [/^CHO/, 'C=O', true],
  [/^CN/, 'C#N', true],
  [/^C6H5/, 'c1ccccc1', true],
  [/^CO(?![OH])/, 'C(=O)', false], // cetona en medio de la cadena
  [/^Cl/, 'Cl', true], [/^Br/, 'Br', true],
  [/^H?C(H\d?)?/, 'C', false],
  [/^OH/, 'O', true],
  [/^O/, 'O', false],
  [/^NH2/, 'N', true],
  [/^NH/, 'N', false],
  [/^N/, 'N', false],
  [/^F/, 'F', true], [/^I/, 'I', true]
];
const ENLACE = { '-': '', '=': '=', '#': '#' };

export function semidesarrollada(texto) {
  let s = String(texto || '').trim()
    .replace(/[₀-₉]/g, c => SUB[c])
    .replace(/[–—−‐]/g, '-').replace(/≡/g, '#').replace(/\s+/g, '');
  if (!s) return { error: 'Escribe una fórmula.' };
  if (/^CH4$/i.test(s)) return { smiles: 'C', h: 4 };
  if (/^C6H6$/i.test(s)) return { smiles: 'c1ccccc1' };
  if (/^C6H12$/i.test(s)) return { smiles: 'C1CCCCC1' };
  let i = 0, h = 0;
  const cuentaH = txt => [...txt.matchAll(/H(\d*)/g)].reduce((s, m) => s + (m[1] ? Number(m[1]) : 1), 0);

  function unidad() {
    // H– inicial: HCHO, HCOOH, HCOO–CH3, HCONH2
    if (s[i] === 'H' && /^C(OOH|HO|OO|ONH2|N)/.test(s.slice(i + 1))) { i++; h++; return { sm: '', fin: false, h: true }; }
    for (const [re, sm, fin] of GRUPOS) {
      const m = s.slice(i).match(re);
      if (m && m[0]) { i += m[0].length; h += cuentaH(m[0]); return { sm, fin }; }
    }
    throw new Error(`No entiendo «${s.slice(i, i + 4)}».`);
  }

  function cadena(rama = false) {
    let out = '', bond = '', prev = null, n = 0, previas = '';
    while (i < s.length && s[i] !== ')') {
      if (ENLACE[s[i]] != null) {
        if (prev == null && !out && !rama) throw new Error('La fórmula no puede empezar con un enlace.');
        bond = ENLACE[s[i]]; i++;
        if (i >= s.length || s[i] === ')') throw new Error('Falta un átomo después del último enlace.');
        continue;
      }
      if (s[i] === '(' && !n) {          // ramas antes del primer átomo: (CH3)3C–OH
        i++;
        const hAntes = h;
        const r = cadena(true);
        if (s[i] !== ')') throw new Error('Falta cerrar un paréntesis.');
        i++;
        const m = s.slice(i).match(/^\d+/);
        let k = 1; if (m) { k = Number(m[0]); i += m[0].length; }
        h += (k - 1) * (h - hAntes);
        previas += `(${r})`.repeat(k);
        continue;
      }
      const u = unidad();
      if (u.h) { prev = u; continue; }
      if (prev && prev.fin && !prev.h && n > 1) throw new Error('Hay un grupo terminal (OH, COOH, CHO, halógeno…) en medio de la cadena.');
      out += (out || rama ? bond : '') + u.sm + previas;
      bond = ''; previas = ''; n++;
      // ramas: CH(CH3)2, C(=O), CH(OH)
      while (s[i] === '(') {
        i++;
        const hAntes = h;
        const rama = cadena(true);
        if (s[i] !== ')') throw new Error('Falta cerrar un paréntesis.');
        i++;
        let n = 1;
        const m = s.slice(i).match(/^\d+/);
        if (m) { n = Number(m[0]); i += m[0].length; }
        h += (n - 1) * (h - hAntes);
        out += `(${rama})`.repeat(n);
      }
      prev = u;
    }
    return out;
  }

  try {
    const r = cadena();
    if (i < s.length) throw new Error('Sobra un paréntesis de cierre.');
    if (!r) throw new Error('Escribe una fórmula.');
    return { smiles: r, h };
  } catch (e) {
    return { error: e.message };
  }
}
