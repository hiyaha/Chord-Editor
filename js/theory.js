// Music theory engine

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_TYPES = {
  'maj':   { intervals: [0, 4, 7],             display: 'M' },
  'add9':  { intervals: [0, 4, 7, 14],         display: 'add9' },
  '6':     { intervals: [0, 4, 7, 9],          display: '6' },
  'm':     { intervals: [0, 3, 7],             display: 'm' },
  'm6':    { intervals: [0, 3, 7, 9],          display: 'm6' },
  'm7':    { intervals: [0, 3, 7, 10],         display: 'm7' },
  'mMaj7': { intervals: [0, 3, 7, 11],         display: 'mMaj7' },
  '7':     { intervals: [0, 4, 7, 10],         display: '7' },
  '9':     { intervals: [0, 4, 7, 10, 14],     display: '7(9)' },
  'maj7':  { intervals: [0, 4, 7, 11],         display: 'Maj7' },
  'maj9':  { intervals: [0, 4, 7, 11, 14],     display: 'Maj7(9)' },
  'm9':    { intervals: [0, 3, 7, 10, 14],     display: 'm7(9)' },
  'dim':   { intervals: [0, 3, 6],             display: 'dim' },
  'dim7':  { intervals: [0, 3, 6, 9],          display: 'dim7' },
  'm7b5':  { intervals: [0, 3, 6, 10],         display: 'm7♭5' },
  'sus4':  { intervals: [0, 5, 7],             display: 'sus4' },
  'aug':   { intervals: [0, 4, 8],             display: 'aug' },
};

const CHORD_TYPE_KEYS = ['maj', 'm', 'm7', '7', 'maj7', 'mMaj7', 'sus4', 'dim', 'dim7', 'add9', '6', 'm6', '9', 'm9', 'maj9', 'm7b5', 'aug'];

// ── Diatonic chord sets ────────────────────────────────────────────────────
// [semitones from tonic, chord type]
const MAJOR_DIATONIC = [
  [0, 'maj'], [0, 'maj7'], [0, 'add9'], [0, '6'],
  [2, 'm'],   [2, 'm7'],   [2, 'm9'],
  [4, 'm'],   [4, 'm7'],   [4, 'm9'],
  [5, 'maj'], [5, 'maj7'], [5, 'maj9'], [5, '6'],
  [7, 'maj'], [7, '7'],    [7, '9'],
  [9, 'm'],   [9, 'm7'],   [9, 'm9'],
  [11, 'dim'],[11, 'm7b5'],
];
const MINOR_DIATONIC = [
  [0, 'm'],   [0, 'm7'],  [0, 'mMaj7'], [0, 'm6'], [0, 'm9'],
  [2, 'dim'], [2, 'm7b5'],
  [3, 'maj'], [3, 'maj7'], [3, 'maj9'],
  [5, 'm'],   [5, 'm7'],   [5, 'm6'],
  [7, 'm'],   [7, '7'],    [7, '9'],    // harmonic minor V7
  [8, 'maj'], [8, 'maj7'],
  [10, 'maj'],
  [11, 'dim7'],
];

// ── Tonal functions ────────────────────────────────────────────────────────
const MAJOR_FUNCTIONS = [
  [0,'maj','T'], [0,'maj7','T'], [0,'add9','T'], [0,'6','T'],
  [2,'m','SD'],  [2,'m7','SD'],  [2,'m9','SD'],
  [4,'m','T'],   [4,'m7','T'],   [4,'m9','T'],
  [5,'maj','SD'],[5,'maj7','SD'],[5,'maj9','SD'],[5,'6','SD'],
  [7,'maj','D'], [7,'7','D'],    [7,'9','D'],
  [9,'m','T'],   [9,'m7','T'],   [9,'m9','T'],
  [11,'dim','D'],[11,'m7b5','D'],
];
const MINOR_FUNCTIONS = [
  [0,'m','T'],   [0,'m7','T'],  [0,'mMaj7','T'], [0,'m6','T'],  [0,'m9','T'],
  [2,'dim','SD'],[2,'m7b5','SD'],
  [3,'maj','T'], [3,'maj7','T'], [3,'maj9','T'],
  [5,'m','SD'],  [5,'m7','SD'],  [5,'m6','SD'],
  [7,'m','D'],   [7,'7','D'],    [7,'9','D'],
  [8,'maj','T'], [8,'maj7','T'],
  [10,'maj','D'],
  [11,'dim7','D'],
];

// Returns map: `${root}_${type}` → 'T' | 'SD' | 'D'
function getDiatonicFunctions(keyRoot, mode) {
  if (!keyRoot) return {};
  const ti = NOTES.indexOf(keyRoot);
  const defs = mode === 'major' ? MAJOR_FUNCTIONS : MINOR_FUNCTIONS;
  const map = {};
  for (const [s, type, fn] of defs) {
    map[`${NOTES[(ti + s) % 12]}_${type}`] = fn;
  }
  return map;
}

// ── Borrowed chords (modal mixture) ───────────────────────────────────────
// [semitones from tonic, chord type]  – most common borrowed chords
const BORROWED_FROM_MINOR = [   // used in a major key
  [5,  'm'],    // iv
  [5,  'm7'],   // ivm7
  [5,  'm6'],   // ivm6 — jazz staple
  [5,  'm9'],   // ivm9
  [8,  'maj'],  // ♭VI
  [8,  'maj7'], // ♭VIM7
  [8,  'maj9'], // ♭VIMaj9
  [8,  'add9'], // ♭VIadd9
  [10, 'maj'],  // ♭VII
  [10, 'maj7'], // ♭VIIM7
  [10, '7'],    // ♭VII7 — common in rock/pop
  [3,  'maj'],  // ♭III
  [3,  'maj7'], // ♭IIIM7
  [0,  'm'],    // i (tonic minor for colour)
  [0,  'm7'],   // im7
  [2,  'dim'],  // iidim (from natural minor)
  [2,  'm7b5'], // iiø
];
const BORROWED_FROM_MAJOR = [   // used in a minor key
  [5,  'maj'],  // IV
  [5,  'maj7'], // IVM7
  [5,  'maj9'], // IVMaj9
  [5,  'add9'], // IVadd9
  [5,  '6'],    // IV6
  [0,  'maj'],  // I  — Picardy 3rd (detected separately as 'Pic')
  [0,  'maj7'], // IM7 — Picardy variant
  [0,  'add9'], // Iadd9
  [0,  '6'],    // I6
  [7,  'maj'],  // V  (major dominant, already in harmonic minor diatonic)
  [2,  'm'],    // IIm  — Dorian IV/major II
  [2,  'm7'],   // IIm7
];

function getBorrowedSet(keyRoot, mode) {
  if (!keyRoot) return new Set();
  const ti = NOTES.indexOf(keyRoot);
  const list = mode === 'major' ? BORROWED_FROM_MINOR : BORROWED_FROM_MAJOR;
  const s = new Set();
  for (const [sem, type] of list) s.add(`${NOTES[(ti + sem) % 12]}_${type}`);
  return s;
}

// ── Secondary dominants ────────────────────────────────────────────────────
// Returns map: `${root}_7` → target chord key `${root}_${type}`
function getSecondaryDominantMap(keyRoot, mode) {
  if (!keyRoot) return {};
  const ti = NOTES.indexOf(keyRoot);
  // Targets: diatonic chords that can be tonicised (not the tonic itself in major, not dim)
  const targets = mode === 'major'
    ? [[2,'m'],[4,'m'],[5,'maj'],[7,'maj'],[9,'m']]          // ii iii IV V vi
    : [[3,'maj'],[5,'m'],[7,'m'],[8,'maj'],[10,'maj'],[0,'m']]; // III iv v VI VII i
  const map = {};
  for (const [s, targetType] of targets) {
    const targetRoot = NOTES[(ti + s) % 12];
    // Secondary dominant is a dom7/dom9 chord a P5 above the target
    const secDomRoot = NOTES[(ti + s + 7) % 12];
    map[`${secDomRoot}_7`] = `${targetRoot}_${targetType}`;
    map[`${secDomRoot}_9`] = `${targetRoot}_${targetType}`; // V9 resolves like V7
  }
  return map;
}

// ── Roman numerals (Im format) ────────────────────────────────────────────
const ROMAN_NUMS = ['I','♭II','II','♭III','III','IV','♭V','V','♭VI','VI','♭VII','VII'];

function getRomanNumeral(root, type, keyRoot, keyMode) {
  if (!keyRoot || !root) return '';
  const ki = NOTES.indexOf(keyRoot);
  const ri = NOTES.indexOf(root);
  const interval = (ri - ki + 12) % 12;
  const num = ROMAN_NUMS[interval];

  const suffix = {
    'maj':   'M',
    'add9':  'add9',
    '6':     '6',
    'm':     'm',
    'm6':    'm6',
    'm7':    'm7',
    'mMaj7': 'mMaj7',
    '7':     '7',
    '9':     '7(9)',
    'maj7':  'Maj7',
    'maj9':  'Maj7(9)',
    'm9':    'm7(9)',
    'dim':   'dim',
    'dim7':  'dim7',
    'm7b5':  'm7♭5',
    'sus4':  'sus4',
    'aug':   'aug',
  }[type] ?? type;

  return num + suffix;
}

// ── Chord analysis (for grid annotation) ──────────────────────────────────
// Returns { role: 'T'|'SD'|'D'|'secD'|'borrowed'|'Pic'|'N'|'nonDiatonic', secDomTarget? }
function getChordAnalysis(root, type, keyRoot, keyMode) {
  if (!keyRoot) return { role: 'unknown' };

  const ki = NOTES.indexOf(keyRoot);
  const ri = NOTES.indexOf(root);
  const interval = (ri - ki + 12) % 12;

  // Picardy third: I major (or extensions) in a minor key
  if (keyMode === 'minor' && interval === 0 && ['maj','maj7','maj9','add9','6'].includes(type))
    return { role: 'Pic' };

  // Neapolitan chord: ♭II major in any key (also ♭IIM7)
  if (interval === 1 && (type === 'maj' || type === 'maj7'))
    return { role: 'N' };

  const fnMap  = getDiatonicFunctions(keyRoot, keyMode);
  const fn = fnMap[`${root}_${type}`];
  if (fn) return { role: fn };

  const secMap = getSecondaryDominantMap(keyRoot, keyMode);
  const secTarget = secMap[`${root}_${type}`];
  if (secTarget) return { role: 'secD', target: secTarget };

  const borrowed = getBorrowedSet(keyRoot, keyMode);
  if (borrowed.has(`${root}_${type}`)) return { role: 'borrowed' };

  return { role: 'nonDiatonic' };
}

// ── Frequency helpers ──────────────────────────────────────────────────────
function noteIndex(note) { return NOTES.indexOf(note); }

function midiToHz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// 9th chords: rootless voicing (upper 4 notes only) unless bass is specified as root
const ROOTLESS_TYPES = new Set(['9', 'm9', 'maj9']);

function _resolveIntervals(type, bass, root) {
  const intervals = CHORD_TYPES[type]?.intervals ?? [0, 4, 7];
  // Rootless: omit root interval unless bass explicitly anchors the root
  if (ROOTLESS_TYPES.has(type) && !(bass && bass === root)) {
    return intervals.filter(iv => iv !== 0);
  }
  return intervals;
}

function getChordFreqs(root, type, bass, octaveOffset = 0) {
  const rootIdx = noteIndex(root);
  const rootMidi = 60 + rootIdx + octaveOffset * 12;
  const intervals = _resolveIntervals(type, bass, root);
  const freqs = intervals.map(iv => midiToHz(rootMidi + iv));

  if (bass && bass !== root) {
    freqs.unshift(midiToHz(60 + noteIndex(bass) - 12 + octaveOffset * 12));
  } else if (!ROOTLESS_TYPES.has(type) || (bass && bass === root)) {
    freqs.unshift(midiToHz(rootMidi - 12)); // bass octave
  }
  return freqs;
}

// 実際に鳴るMIDI番号を返す（ハイライト用）
function getChordMidis(root, type, bass, octaveOffset = 0) {
  const rootIdx = noteIndex(root);
  const rootMidi = 60 + rootIdx + octaveOffset * 12;
  const intervals = _resolveIntervals(type, bass, root);
  const midis = intervals.map(iv => rootMidi + iv);

  if (bass && bass !== root) {
    midis.unshift(60 + noteIndex(bass) - 12 + octaveOffset * 12);
  } else if (!ROOTLESS_TYPES.has(type) || (bass && bass === root)) {
    midis.unshift(rootMidi - 12); // bass octave
  }
  return midis;
}

// ── Key detection ──────────────────────────────────────────────────────────
function detectKeys(chords) {
  const valid = chords.filter(c => c && c !== 'rest');
  if (valid.length === 0) return [];

  const scores = [];
  for (const tonic of NOTES) {
    for (const [mode, diatonic] of [['major', MAJOR_DIATONIC], ['minor', MINOR_DIATONIC]]) {
      const ti = noteIndex(tonic);
      const dSet = new Set(diatonic.map(([s, t]) => `${NOTES[(ti + s) % 12]}_${t}`));

      // Also include secondary dominants and borrowed chords in the "fits" count
      const secMap  = getSecondaryDominantMap(tonic, mode);
      const borrow  = getBorrowedSet(tonic, mode);

      let score = 0;
      for (const c of valid) {
        const k = `${c.root}_${c.type}`;
        if (dSet.has(k))         score += 1.0;
        else if (secMap[k])      score += 0.6;
        else if (borrow.has(k))  score += 0.5;
      }
      scores.push({ root: tonic, mode, score: score / valid.length });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0].score;
  return top > 0 ? scores.filter(k => k.score >= top * 0.75) : scores.slice(0, 2);
}

// ── Next-chord scoring ─────────────────────────────────────────────────────
function scoreNextChords(progression) {
  const result = {};
  for (const root of NOTES)
    for (const type of CHORD_TYPE_KEYS)
      result[`${root}_${type}`] = 0;

  const valid = progression.filter(c => c && c !== 'rest');

  // ── No context: give sensible defaults by chord type ──
  if (valid.length === 0) {
    for (const root of NOTES) {
      result[`${root}_maj`]  = 0.60;
      result[`${root}_m`]    = 0.55;
      result[`${root}_maj7`] = 0.50;
      result[`${root}_m7`]   = 0.45;
      result[`${root}_add9`] = 0.45;
      result[`${root}_6`]    = 0.38;
      result[`${root}_sus4`] = 0.35;
      result[`${root}_maj9`] = 0.32;
      result[`${root}_m9`]   = 0.28;
      result[`${root}_m6`]   = 0.22;
      result[`${root}_7`]    = 0.22;
      result[`${root}_9`]    = 0.18;
      result[`${root}_dim`]  = 0.08;
      result[`${root}_aug`]  = 0.08;
    }
    return result;
  }

  // ── Key-based scoring ──
  const keys = detectKeys(valid);
  for (const key of keys) {
    const ti      = noteIndex(key.root);
    const diatonic = key.mode === 'major' ? MAJOR_DIATONIC : MINOR_DIATONIC;
    const secMap  = getSecondaryDominantMap(key.root, key.mode);
    const borrow  = getBorrowedSet(key.root, key.mode);

    const TENSION_TYPES = new Set(['add9', '6', 'm6', '9', 'm9', 'maj9']);
    for (const [s, type] of diatonic) {
      const k = `${NOTES[(ti + s) % 12]}_${type}`;
      const w = TENSION_TYPES.has(type) ? 0.58 : 0.70;
      result[k] = Math.max(result[k], key.score * w);
    }
    for (const secDom of Object.keys(secMap))
      result[secDom] = Math.max(result[secDom], key.score * 0.45);
    for (const b of borrow)
      result[b] = Math.max(result[b], key.score * 0.30);

    // Neapolitan (♭IIM)
    const napRoot = NOTES[(ti + 1) % 12];
    result[`${napRoot}_maj`]  = Math.max(result[`${napRoot}_maj`],  key.score * 0.28);
    result[`${napRoot}_maj7`] = Math.max(result[`${napRoot}_maj7`], key.score * 0.22);

    // Picardy third
    if (key.mode === 'minor') {
      const picRoot = NOTES[ti];
      result[`${picRoot}_maj`]  = Math.max(result[`${picRoot}_maj`],  key.score * 0.35);
      result[`${picRoot}_maj7`] = Math.max(result[`${picRoot}_maj7`], key.score * 0.28);
    }
  }

  // ── Voice leading: last chord ──────────────────────────────────────────────
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];   // 2つ前
  const prev2 = valid[valid.length - 3];  // 3つ前
  const keys2 = detectKeys(valid);

  if (last) {
    const li = noteIndex(last.root);

    // ── Dominant 7th / dom9 resolution (V7→I) ──
    if (last.type === '7' || last.type === '9') {
      const r = NOTES[(li + 5) % 12];
      result[`${r}_maj`]  = Math.max(result[`${r}_maj`],  1.00);
      result[`${r}_m`]    = Math.max(result[`${r}_m`],    0.90);
      result[`${r}_maj7`] = Math.max(result[`${r}_maj7`], 0.85);
      result[`${r}_maj9`] = Math.max(result[`${r}_maj9`], 0.82);
      result[`${r}_m7`]   = Math.max(result[`${r}_m7`],   0.80);
      result[`${r}_add9`] = Math.max(result[`${r}_add9`], 0.78);
      result[`${r}_6`]    = Math.max(result[`${r}_6`],    0.72);

      // 偽終止 (Deceptive cadence): V7 → VIm
      const rDec = NOTES[(li + 9) % 12];
      result[`${rDec}_m`]  = Math.max(result[`${rDec}_m`],  0.75);
      result[`${rDec}_m7`] = Math.max(result[`${rDec}_m7`], 0.68);

      // トライトーン代理 (Tritone substitution): ♭II7 → I（半音下への解決）
      const rTri = NOTES[(li + 11) % 12];
      result[`${rTri}_maj`]  = Math.max(result[`${rTri}_maj`],  0.80);
      result[`${rTri}_m`]    = Math.max(result[`${rTri}_m`],    0.73);
      result[`${rTri}_maj7`] = Math.max(result[`${rTri}_maj7`], 0.76);
      result[`${rTri}_m7`]   = Math.max(result[`${rTri}_m7`],   0.70);

      // バックドアドミナント (♭VII7→I): 全音上への解決
      const rBD = NOTES[(li + 2) % 12];
      result[`${rBD}_maj`]  = Math.max(result[`${rBD}_maj`],  0.72);
      result[`${rBD}_m`]    = Math.max(result[`${rBD}_m`],    0.66);
      result[`${rBD}_maj7`] = Math.max(result[`${rBD}_maj7`], 0.68);
    }

    // ── dim / dim7: 代理ドミナント（V7♭9のルートなし）＋4way symmetry ──
    if (last.type === 'dim' || last.type === 'dim7') {
      // dim7 = 短3度ごとに4つのルートが対称 → 各+1半音が解決先
      const steps = last.type === 'dim7' ? [1, 4, 7, 10] : [1];
      for (const step of steps) {
        const rRes = NOTES[(li + step) % 12];
        const str  = step === 1 ? 0.92 : 0.65;
        result[`${rRes}_maj`]  = Math.max(result[`${rRes}_maj`],  str);
        result[`${rRes}_m`]    = Math.max(result[`${rRes}_m`],    str * 0.94);
        result[`${rRes}_maj7`] = Math.max(result[`${rRes}_maj7`], str * 0.88);
        result[`${rRes}_m7`]   = Math.max(result[`${rRes}_m7`],   str * 0.84);
      }
    }

    // ── m7b5 (ハーフディミニッシュ): m7♭5 → dom7 a 4th above (IIø→V7) ──
    if (last.type === 'm7b5') {
      const rV = NOTES[(li + 5) % 12];
      result[`${rV}_7`] = Math.max(result[`${rV}_7`], 0.88);
      result[`${rV}_9`] = Math.max(result[`${rV}_9`], 0.82);
    }

    // ── m7 / m9 → IV方向 ──
    if (last.type === 'm7' || last.type === 'm9') {
      const r4 = NOTES[(li + 5) % 12];
      result[`${r4}_maj7`] = Math.max(result[`${r4}_maj7`], 0.65);
      result[`${r4}_maj9`] = Math.max(result[`${r4}_maj9`], 0.60);
    }

    // ── sus4 → 同ルート解決 ──
    if (last.type === 'sus4') {
      result[`${last.root}_maj`]  = Math.max(result[`${last.root}_maj`],  0.96);
      result[`${last.root}_m`]    = Math.max(result[`${last.root}_m`],    0.82);
      result[`${last.root}_7`]    = Math.max(result[`${last.root}_7`],    0.78);
      result[`${last.root}_maj7`] = Math.max(result[`${last.root}_maj7`], 0.68);
      result[`${last.root}_add9`] = Math.max(result[`${last.root}_add9`], 0.62);
    }

    // ── aug 解決 ──
    if (last.type === 'aug') {
      result[`${last.root}_maj`]  = Math.max(result[`${last.root}_maj`],  0.80);
      result[`${last.root}_7`]    = Math.max(result[`${last.root}_7`],    0.70);
      const rAug5 = NOTES[(li + 8) % 12];
      result[`${rAug5}_maj`]  = Math.max(result[`${rAug5}_maj`],  0.88);
      result[`${rAug5}_maj7`] = Math.max(result[`${rAug5}_maj7`], 0.78);
      result[`${rAug5}_m`]    = Math.max(result[`${rAug5}_m`],    0.72);
      const rUp4 = NOTES[(li + 5) % 12];
      result[`${rUp4}_maj`]  = Math.max(result[`${rUp4}_maj`],  0.85);
      result[`${rUp4}_m`]    = Math.max(result[`${rUp4}_m`],    0.75);
      result[`${rUp4}_maj7`] = Math.max(result[`${rUp4}_maj7`], 0.68);
    }

    // ── mMaj7 降下声部進行 (mMaj7→m7→m) ──
    if (last.type === 'mMaj7') {
      result[`${last.root}_m7`] = Math.max(result[`${last.root}_m7`], 0.94);
      result[`${last.root}_m9`] = Math.max(result[`${last.root}_m9`], 0.84);
      result[`${last.root}_m6`] = Math.max(result[`${last.root}_m6`], 0.75);
      result[`${last.root}_m`]  = Math.max(result[`${last.root}_m`],  0.68);
    }

    // ── クロマティックメディアント (major同士・短/長3度) ──
    if (['maj','maj7','add9','6'].includes(last.type)) {
      for (const step of [3, 4, 8, 9]) {
        const rCM = NOTES[(li + step) % 12];
        const str = (step === 3 || step === 4) ? 0.58 : 0.52;
        result[`${rCM}_maj`]  = Math.max(result[`${rCM}_maj`],  str);
        result[`${rCM}_maj7`] = Math.max(result[`${rCM}_maj7`], str * 0.92);
      }
    }

    // ── ♭VIMaj7 → V (ロマンティック進行) ──
    for (const key of keys2) {
      const ki  = noteIndex(key.root);
      const li2 = noteIndex(last.root);
      const ivl = (li2 - ki + 12) % 12;
      if (ivl === 8 && ['maj','maj7'].includes(last.type)) {
        const vRoot = NOTES[(ki + 7) % 12];
        result[`${vRoot}_7`]   = Math.max(result[`${vRoot}_7`],   key.score * 0.86);
        result[`${vRoot}_maj`] = Math.max(result[`${vRoot}_maj`], key.score * 0.78);
        result[`${vRoot}_9`]   = Math.max(result[`${vRoot}_9`],   key.score * 0.82);
      }
      // Neapolitan → V
      if (ivl === 1 && ['maj','maj7'].includes(last.type)) {
        const vRoot = NOTES[(ki + 7) % 12];
        result[`${vRoot}_maj`] = Math.max(result[`${vRoot}_maj`], key.score * 0.90);
        result[`${vRoot}_7`]   = Math.max(result[`${vRoot}_7`],   key.score * 0.88);
        result[`${vRoot}_9`]   = Math.max(result[`${vRoot}_9`],   key.score * 0.82);
      }
    }

    // ── Secondary dominant resolution ──
    for (const key of keys2) {
      const secMap = getSecondaryDominantMap(key.root, key.mode);
      const target = secMap[`${last.root}_${last.type}`];
      if (target) result[target] = Math.max(result[target], key.score * 0.95);
    }

    // ── 5度圏連鎖 (Cycle of Fifths chain) ──
    if (prev) {
      const pi = noteIndex(prev.root);
      const stepPL = (li - pi + 12) % 12;
      if (stepPL === 5) {
        // 4度ずつ上がるサイクル継続
        const rNext = NOTES[(li + 5) % 12];
        for (const t of ['maj','m','7','m7','maj7'])
          result[`${rNext}_${t}`] = Math.max(result[`${rNext}_${t}`], 0.68);
      }
      if (stepPL === 7) {
        // 5度ずつ上がるサイクル継続
        const rNext = NOTES[(li + 7) % 12];
        for (const t of ['maj','m','7','m7'])
          result[`${rNext}_${t}`] = Math.max(result[`${rNext}_${t}`], 0.60);
      }
    }

    // ── 汎用インターバル進行 ──
    for (const [sem, bonus] of [[5,0.55],[7,0.45],[9,0.40],[3,0.35],[10,0.30]]) {
      const r = NOTES[(li + sem) % 12];
      for (const t of ['maj','m','7','m7','maj7'])
        result[`${r}_${t}`] = Math.max(result[`${r}_${t}`], bonus * 0.55);
    }
  }

  // ── 2コード参照: II-V-I, パッシングdim, 偽終止後, mMaj7降下 ─────────────
  if (prev && last) {
    const pi = noteIndex(prev.root);
    const li = noteIndex(last.root);

    // II-V-I: IIm7 → V7 → I（ジャズの根幹）
    if ((prev.type === 'm7' || prev.type === 'm9') &&
        (last.type === '7'  || last.type === '9') &&
        (li - pi + 12) % 12 === 7) {
      const rI = NOTES[(li + 5) % 12];
      result[`${rI}_maj`]  = Math.max(result[`${rI}_maj`],  1.00);
      result[`${rI}_maj7`] = Math.max(result[`${rI}_maj7`], 0.96);
      result[`${rI}_maj9`] = Math.max(result[`${rI}_maj9`], 0.92);
      result[`${rI}_m`]    = Math.max(result[`${rI}_m`],    0.86);
      result[`${rI}_m7`]   = Math.max(result[`${rI}_m7`],   0.82);
      result[`${rI}_add9`] = Math.max(result[`${rI}_add9`], 0.88);
      result[`${rI}_6`]    = Math.max(result[`${rI}_6`],    0.80);
    }

    // パッシングdim: X → Xdim（+1半音）→ 次もう1半音上（IIm等）
    if ((last.type === 'dim' || last.type === 'dim7') && (li - pi + 12) % 12 === 1) {
      const rNext = NOTES[(li + 1) % 12];
      result[`${rNext}_m`]   = Math.max(result[`${rNext}_m`],   0.93);
      result[`${rNext}_m7`]  = Math.max(result[`${rNext}_m7`],  0.88);
      result[`${rNext}_maj`] = Math.max(result[`${rNext}_maj`], 0.72);
    }

    // 偽終止後 (V7→VIm → IV が来やすい)
    if ((prev.type === '7' || prev.type === '9') &&
        (last.type === 'm' || last.type === 'm7') &&
        (li - pi + 12) % 12 === 9) {
      const rOrigTonic = NOTES[(pi + 5) % 12];
      const rIV = NOTES[(noteIndex(rOrigTonic) + 5) % 12];
      result[`${rIV}_maj`]  = Math.max(result[`${rIV}_maj`],  0.85);
      result[`${rIV}_maj7`] = Math.max(result[`${rIV}_maj7`], 0.78);
      result[`${rIV}_add9`] = Math.max(result[`${rIV}_add9`], 0.80);
    }

    // mMaj7 → m7 → m / m6（ハーモニックマイナー降下継続）
    if (prev.type === 'mMaj7' && last.type === 'm7' && prev.root === last.root) {
      result[`${last.root}_m`]  = Math.max(result[`${last.root}_m`],  0.92);
      result[`${last.root}_m6`] = Math.max(result[`${last.root}_m6`], 0.86);
      const rV = NOTES[(li + 7) % 12];
      result[`${rV}_7`] = Math.max(result[`${rV}_7`], 0.74);
    }

    // ♭VII → ♭VI（アンダルシア/フリジアン降下途中）
    if ((pi - li + 12) % 12 === 2 &&
        ['maj','maj7'].includes(prev.type) && ['maj','maj7'].includes(last.type)) {
      // 続けてさらに半音/全音下 → V方向
      const rV = NOTES[(li + 11) % 12];
      result[`${rV}_maj`] = Math.max(result[`${rV}_maj`], 0.82);
      result[`${rV}_7`]   = Math.max(result[`${rV}_7`],   0.78);
    }
  }

  // ── 3コード参照: 頻出パターン認識 ────────────────────────────────────────
  if (prev2 && prev && last && keys2.length > 0) {
    const key = keys2[0];
    const ki = noteIndex(key.root);
    const d2 = (noteIndex(prev2.root) - ki + 12) % 12;
    const d1 = (noteIndex(prev.root)  - ki + 12) % 12;
    const d0 = (noteIndex(last.root)  - ki + 12) % 12;

    // I-V-vi → IV（最多頻出ポップ進行）
    if (d2 === 0 && d1 === 7 && d0 === 9 && ['m','m7'].includes(last.type)) {
      const rIV = NOTES[(ki + 5) % 12];
      result[`${rIV}_maj`]  = Math.max(result[`${rIV}_maj`],  key.score * 0.94);
      result[`${rIV}_maj7`] = Math.max(result[`${rIV}_maj7`], key.score * 0.88);
      result[`${rIV}_add9`] = Math.max(result[`${rIV}_add9`], key.score * 0.86);
    }

    // vi-IV-I → V
    if (d2 === 9 && d1 === 5 && d0 === 0) {
      const rV = NOTES[(ki + 7) % 12];
      result[`${rV}_7`]   = Math.max(result[`${rV}_7`],   key.score * 0.94);
      result[`${rV}_maj`] = Math.max(result[`${rV}_maj`], key.score * 0.82);
      result[`${rV}_9`]   = Math.max(result[`${rV}_9`],   key.score * 0.90);
      result[`${rV}_sus4`]= Math.max(result[`${rV}_sus4`], key.score * 0.72);
    }

    // I-IV-V → I（ブルース/ロック定番）
    if (d2 === 0 && d1 === 5 && d0 === 7) {
      const rI = NOTES[ki];
      result[`${rI}_maj`]  = Math.max(result[`${rI}_maj`],  key.score * 0.92);
      result[`${rI}_7`]    = Math.max(result[`${rI}_7`],    key.score * 0.74);
      result[`${rI}_add9`] = Math.max(result[`${rI}_add9`], key.score * 0.84);
    }

    // ♭VII-♭VI-V → i（アンダルシア終止 / フリジアン降下）
    if (d2 === 10 && d1 === 8 && d0 === 7) {
      const rI = NOTES[ki];
      result[`${rI}_m`]    = Math.max(result[`${rI}_m`],    key.score * 0.94);
      result[`${rI}_m7`]   = Math.max(result[`${rI}_m7`],   key.score * 0.86);
      result[`${rI}_maj`]  = Math.max(result[`${rI}_maj`],  key.score * 0.72); // Picardy
    }

    // ii-V-I → ii（繰り返し）or 次のii（転調）
    const li_last = noteIndex(last.root);
    if (d1 === 2 && d0 === 7 &&
        ['m7','m9'].includes(prev.type) && ['7','9'].includes(last.type)) {
      const rNextI = NOTES[(li_last + 5) % 12];
      // 解決後に再びiiが来る（ジャズ的反復）
      const rNextII = NOTES[(noteIndex(rNextI) + 2) % 12];
      result[`${rNextII}_m7`] = Math.max(result[`${rNextII}_m7`], key.score * 0.72);
      result[`${rNextII}_m9`] = Math.max(result[`${rNextII}_m9`], key.score * 0.65);
    }

    // I-vi-IV → V（50年代コード）
    if (d2 === 0 && d1 === 9 && d0 === 5) {
      const rV = NOTES[(ki + 7) % 12];
      result[`${rV}_7`]    = Math.max(result[`${rV}_7`],    key.score * 0.92);
      result[`${rV}_maj`]  = Math.max(result[`${rV}_maj`],  key.score * 0.80);
      result[`${rV}_sus4`] = Math.max(result[`${rV}_sus4`], key.score * 0.70);
    }
  }

  // Normalize
  const max = Math.max(...Object.values(result));
  if (max > 0) for (const k of Object.keys(result)) result[k] /= max;

  return result;
}

// ── Top N recommended chords ───────────────────────────────────────────────
function getRecommended(progression, n = 7) {
  const scores = scoreNextChords(progression);
  return Object.entries(scores)
    .map(([key, score]) => {
      const us = key.lastIndexOf('_');
      return { root: key.slice(0, us), type: key.slice(us + 1), score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// ── Theory explanation ─────────────────────────────────────────────────────
function getExplanation(fromChord, toChord, progression) {
  if (!fromChord || fromChord === 'rest')
    return `${formatChord(toChord.root, toChord.type)} からスタート。冒頭のコード選びが曲全体の色を決めます。`;

  const fc = formatChord(fromChord.root, fromChord.type);
  const tc = formatChord(toChord.root, toChord.type);
  const fi = noteIndex(fromChord.root);
  const ti = noteIndex(toChord.root);
  const interval = (ti - fi + 12) % 12;
  const INAMES = ['同音','半音','長2度','短3度','長3度','完全4度','tritone','完全5度','短6度','長6度','短7度','長7度'];

  // ── 複数コード文脈（lookback）──
  const valid = progression ? progression.filter(c => c && c !== 'rest') : [];
  const prev = valid.length >= 2 ? valid[valid.length - 2] : null;   // fromChord の一つ前
  const prev2 = valid.length >= 3 ? valid[valid.length - 3] : null;  // さらに一つ前

  if (prev) {
    const pi = noteIndex(prev.root);
    const stepPL = (fi - pi + 12) % 12;  // prev→fromChord
    const stepLT = interval;              // fromChord→toChord

    // II-V-I（IIm7 → V7 → I）
    if ((prev.type === 'm7' || prev.type === 'm9') &&
        (fromChord.type === '7' || fromChord.type === '9') &&
        stepPL === 7 && (stepLT === 5 || stepLT === 0)) {
      return `${formatChord(prev.root, prev.type)}→${fc}→${tc}：II-V-I 進行！ジャズの王道。IIm7でテンションを溜め、V7で頂点を作り、Iに解決します。`;
    }

    // サイクル・オブ・フィフスの連鎖
    if (stepPL === 5 && stepLT === 5) {
      return `${formatChord(prev.root, prev.type)}→${fc}→${tc}：5度下行（サイクル・オブ・フィフス）の連鎖。ジャズでおなじみの流れるような進行です。`;
    }

    // パッシングディミニッシュ（IとIIの間に挟まるdim）
    if ((fromChord.type === 'dim' || fromChord.type === 'dim7') &&
        (stepPL === 1 || stepPL === 11) && (stepLT === 1 || stepLT === 11)) {
      return `${formatChord(prev.root, prev.type)}→${fc}→${tc}：パッシングディミニッシュ。半音クロマティックの動きにdimを挟み、滑らかな声部進行を生みます。`;
    }

    // ディセプティブ・カデンス後のIV→I（欺き解決の後処理）
    if ((prev.type === '7' || prev.type === '9') &&
        (fromChord.type === 'm' || fromChord.type === 'm7') &&
        (pi + 5) % 12 === fi % 12) {
      const rI = NOTES[(fi + 3) % 12];
      if (toChord.root === rI) {
        return `${formatChord(prev.root, prev.type)}→${fc}→${tc}：偽終止（ディセプティブ・カデンス）後の収束。V7がVImに「裏切り」解決した後、短調的なルートへ向かいます。`;
      }
    }

    // mMaj7→m7→m（下降ライン）
    if (prev.type === 'mMaj7' && fromChord.type === 'm7' && prev.root === fromChord.root &&
        toChord.root === fromChord.root) {
      return `${formatChord(prev.root, prev.type)}→${fc}→${tc}：マイナーメジャー7→m7への降下ライン。長7度→短7度と内声が半音下がる映画的ボイスリーディング。`;
    }

    // アンダルシアン（♭VII-♭VI-V-i）
    if (prev2) {
      const p2i = noteIndex(prev2.root);
      const d2 = (pi - p2i + 12) % 12;
      const d1 = (fi - pi + 12) % 12;
      const d0 = (ti - fi + 12) % 12;
      if (d2 === 10 && d1 === 10 && d0 === 7 &&
          (toChord.type === 'm' || toChord.type === 'm7')) {
        return `${formatChord(prev2.root, prev2.type)}→${formatChord(prev.root, prev.type)}→${fc}→${tc}：アンダルシアン終止！♭VII-♭VI-V-i の下行。フラメンコ・ロックの情熱的なカデンスです。`;
      }
      // I-V-vi-IV（4コード進行の IV 部分）
      if (d2 === 0 && d1 === 7 && d0 === 9 &&
          (fromChord.type === 'm' || fromChord.type === 'm7') &&
          (toChord.type === 'maj' || toChord.type === 'maj7')) {
        return `${formatChord(prev2.root, prev2.type)}→${formatChord(prev.root, prev.type)}→${fc}→${tc}：I-V-vi-IV の黄金コード進行！ポップ史上最も使われた4コードの締めくくりです。`;
      }
      // vi-IV-I-V（同じ4コード）
      if (d2 === 9 && d1 === 3 && d0 === 7) {
        return `${formatChord(prev2.root, prev2.type)}→${formatChord(prev.root, prev.type)}→${fc}→${tc}：vi-IV-I-V のポップ進行の一部。この4コードループはカノン進行とも呼ばれ、無数のヒット曲に使われています。`;
      }
      // I-vi-IV-V（50sコード → V）
      if (d2 === 0 && d1 === 9 && d0 === 5 && interval === 7) {
        return `${formatChord(prev2.root, prev2.type)}→${formatChord(prev.root, prev.type)}→${fc}→${tc}：I-vi-IV-V（50年代進行）。オールディーズ・ドゥーワップの定番。懐かしさと安定感を持つ4コードです。`;
      }
    }
  }

  // ── sus4 解決 ──
  if (fromChord.type === 'sus4' && fromChord.root === toChord.root)
    return `${fc}→${tc}：sus4からの解決。浮遊感のある4度が3度に落ち着く、ポップ・ロックで定番の安心感のある動きです。`;
  if (fromChord.type === 'sus4' && interval === 0)
    return `${fc}→${tc}：sus4の変形解決。同ルートで質が変わります。`;

  // ── aug 解決 ──
  if (fromChord.type === 'aug' && interval === 0)
    return `${fc}→${tc}：augから同ルートへの解決。増5度が5度に下がり、緊張が解放されます。`;
  if (fromChord.type === 'aug' && interval === 8)
    return `${fc}→${tc}：I→Iaug→IV 型のクロマティック上行。増5度の音がルートになって滑らかにつながります。`;
  if (fromChord.type === 'aug' && interval === 5)
    return `${fc}→${tc}：Vaug→I 型の解決。オーギュメントドミナントからトニックへの強い着地感です。`;

  // ── mMaj7 下降ボイスリーディング ──
  if (fromChord.type === 'mMaj7') {
    if (interval === 0 && (toChord.type === 'm7' || toChord.type === 'm'))
      return `${fc}→${tc}：mMaj7→m7 の半音下降。内声の長7度が短7度に落ちる映画的ボイスリーディング。ジェームズ・ボンドのテーマでも有名な動きです。`;
    if (interval === 0 && toChord.type === 'm9')
      return `${fc}→${tc}：mMaj7→m7(9) の下降ライン。テンションを加えながら内声が半音で動く洗練された進行です。`;
  }

  // ── dim7 プロキシドミナント ──
  if (fromChord.type === 'dim7') {
    if (interval === 1)
      return `${fc}→${tc}：dim7プロキシドミナント解決（主解決）。dim7はその半音上のコードに自然に解決します。`;
    if (interval === 4 || interval === 7 || interval === 10)
      return `${fc}→${tc}：dim7の対称解決。dim7は短3度ごとに4つの等価な解決先を持ちます。`;
  }
  if (fromChord.type === 'dim' && interval === 1)
    return `${fc}→${tc}：dimから半音上への解決。強いリーディングトーンが引力を生みます。`;

  // ── m7♭5 → V7 ──
  if (fromChord.type === 'm7b5' && (toChord.type === '7' || toChord.type === '9') && interval === 5)
    return `${fc}→${tc}：m7♭5→V7 の進行。マイナーキーのII→V。ジャズのマイナーII-V-Iの核心です。`;

  // ── ドミナントモーション ──
  if ((fromChord.type === '7' || fromChord.type === '9') && interval === 5)
    return `${fc}→${tc}：V(9)→I のドミナントモーション。強い解決感と着地感。クラシック・ジャズ共通の基本進行です。`;

  // ── 偽終止（ディセプティブ・カデンス）──
  if ((fromChord.type === '7' || fromChord.type === '9') && interval === 2 &&
      (toChord.type === 'm' || toChord.type === 'm7'))
    return `${fc}→${tc}：偽終止（ディセプティブ・カデンス）！V7が期待されるIの代わりにVImへ解決。リスナーを驚かせる感情的な動きです。`;

  // ── トライトーン代理（♭II7→I）──
  if ((fromChord.type === '7' || fromChord.type === '9') && interval === 11)
    return `${fc}→${tc}：トライトーン代理（♭II7→I）。本来のV7の代わりに三全音上のドミナント7が半音下行で解決。ジャズのスムーズな代理進行です。`;

  // ── バックドアドミナント（♭VII7→I）──
  if ((fromChord.type === '7' || fromChord.type === '9') && interval === 2 &&
      (toChord.type === 'maj' || toChord.type === 'maj7'))
    return `${fc}→${tc}：バックドアドミナント（♭VII7→I）。メジャーキーのIに2半音下から解決するジャズ的な裏口進行です。`;

  // ── セカンダリドミナント ──
  if ((fromChord.type === '7' || fromChord.type === '9') && interval !== 5)
    return `${fc}→${tc}：セカンダリドミナント的な動き。${tc} を一時的なトニックと見なして解決します。`;

  // ── ナポリの和音 ──
  if (interval === 1 && (fromChord.type === 'maj' || fromChord.type === 'maj7'))
    return `${fc}→${tc}：ナポリの和音からの進行。♭II から V へ向かう古典的な強進行です。`;

  // ── クロマティック・メディアント ──
  if (interval === 3 && (fromChord.type === 'maj' || fromChord.type === 'maj7') &&
      (toChord.type === 'maj' || toChord.type === 'maj7'))
    return `${fc}→${tc}：クロマティック・メディアント（短3度上のメジャー）。共通音を持つ幻想的な色彩転換。映画音楽・ゲーム音楽で多用されます。`;
  if (interval === 9 && (fromChord.type === 'maj' || fromChord.type === 'maj7') &&
      (toChord.type === 'maj' || toChord.type === 'maj7'))
    return `${fc}→${tc}：クロマティック・メディアント（長3度下のメジャー）。短3度上と同じ対称関係。壮大な転換感を生みます。`;
  if (interval === 4 && (fromChord.type === 'maj' || fromChord.type === 'maj7') &&
      (toChord.type === 'maj' || toChord.type === 'maj7'))
    return `${fc}→${tc}：クロマティック・メディアント（長3度上のメジャー）。鮮やかな色彩変化。マーベル映画などの音楽でも頻出です。`;
  if (interval === 8 && (fromChord.type === 'maj' || fromChord.type === 'maj7') &&
      (toChord.type === 'maj' || toChord.type === 'maj7'))
    return `${fc}→${tc}：クロマティック・メディアント（短3度下のメジャー）。モーダルな借用感がある幻想的な動きです。`;

  // ── ♭VIMaj7 → V ──
  if (interval === 8 && (fromChord.type === 'maj' || fromChord.type === 'maj7') &&
      (toChord.type === '7' || toChord.type === '9'))
    return `${fc}→${tc}：♭VIMaj7→V7。借用コードからドミナントへ向かう感傷的・劇的な進行です。`;

  // ── IV への進行 ──
  if (interval === 5 && (fromChord.type === 'maj' || fromChord.type === 'add9' || fromChord.type === '6'))
    return `${fc}→${tc}：I→IV（完全4度上）。サブドミナントへの開放的な動き。明るく広がる響きです。`;

  // ── V への進行 ──
  if (interval === 7)
    return `${fc}→${tc}：完全5度上（ドミナント方向）への進行。緊張感と推進力が生まれます。`;

  // ── I→VIm（平行短調）・ディミニッシュ前 ──
  if (interval === 9 && (toChord.type === 'm' || toChord.type === 'm7'))
    return `${fc}→${tc}：平行短調（VI）へ。明るさを保ちながら感情的な深みが増します。`;

  // ── 短3度上への借用的動き ──
  if (interval === 3 && toChord.type === 'maj')
    return `${fc}→${tc}：短3度上のメジャーへ。モーダルな色彩変化。映画音楽でよく使われます。`;

  // ── ♭VI ──
  if (interval === 8 && toChord.type === 'maj')
    return `${fc}→${tc}：♭VI へ。長調の中の借用コード。感傷的・映画的な雰囲気を生みます。`;

  // ── ♭VII ──
  if (interval === 10)
    return `${fc}→${tc}：♭VII への進行。ロック・ポップで頻出の開放感ある動き。解決感は薄く漂う印象です。`;

  // ── 同音ルートの質変換 ──
  if (interval === 0)
    return `${fc}→${tc}：同ルートで質が変わる進行。明暗や緊張感の転換を一瞬で演出できます。`;

  // ── 長2度 ──
  if (interval === 2)
    return `${fc}→${tc}：長2度上への進行。ジャズのII→V感覚や転調前の準備としてよく現れます。`;

  // ── tritone ──
  if (interval === 6)
    return `${fc}→${tc}：三全音（tritone）離れた進行。強烈な色彩変化で驚きや緊張感を演出します。`;

  // ── 一般フォールバック ──
  return `${fc}→${tc}：${INAMES[interval]}（${interval}半音）上への進行。`;
}

// ── Chord name formatting ──────────────────────────────────────────────────
function formatChord(root, type, bass) {
  if (!root || !type) return '';
  const d = CHORD_TYPES[type]?.display ?? type;
  const base = `${root}${d}`;
  return bass ? `${base}/${bass}` : base;
}
