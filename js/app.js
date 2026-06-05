// Main application

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  bars: [],
  sections: [], // [{ barIndex, name }] — section marker before bar at barIndex
  bpm: 120,
  timbre: 'sawtooth',
  playing: false,
  stopPlayback: null,
  playheadIdx: null,
  playbackStart: 0,
  selectedCell: null,
  selectedBass: null,
  selectedOctave: 0,
  keyRoot: 'C',
  keyMode: 'major',
  loop: false,
  loopStart: null,
  loopEnd: null,
  selectedBars: new Set(),
  dirty: false,
  currentProject: null,
  beatsPerBar: 4,
};

// ── History (Undo) ─────────────────────────────────────────────────────────
const history = [];

function markDirty() {
  if (!state.dirty) {
    state.dirty = true;
    updateProjectBar();
  }
}

function saveHistory() {
  history.push(JSON.stringify(state.bars));
  if (history.length > 50) history.shift();
  markDirty();
}

function undo() {
  if (history.length === 0) return;
  state.bars = JSON.parse(history.pop());
  state.selectedBars.clear();
  renderGrid();
  if (state.selectedCell) renderPanel();
}

// ── Section markers ────────────────────────────────────────────────────────
function sectionAt(barIndex) {
  return state.sections.find(s => s.barIndex === barIndex) ?? null;
}

function addSection(barIndex) {
  if (sectionAt(barIndex)) return;
  const num = state.sections.length + 1;
  state.sections.push({ barIndex, name: `#${num}` });
  state.sections.sort((a, b) => a.barIndex - b.barIndex);
  markDirty();
  renderGrid();
}

function removeSection(barIndex) {
  state.sections = state.sections.filter(s => s.barIndex !== barIndex);
  markDirty();
  renderGrid();
}

function renameSection(barIndex, name) {
  const s = sectionAt(barIndex);
  if (s) { s.name = name; markDirty(); }
}

// ── Clipboard / Copy-Paste ─────────────────────────────────────────────────
let clipboard = [];

function copySelectedBars() {
  if (state.selectedBars.size === 0) return;
  clipboard = [...state.selectedBars].sort((a, b) => a - b)
    .map(i => JSON.parse(JSON.stringify(state.bars[i])));
  state.selectedBars.clear();
  renderGrid();
  updateContextToolbar();
}

function pasteBars() {
  if (clipboard.length === 0) return;
  saveHistory();
  // Excel-style: overwrite from the first selected bar (or append if none selected)
  const anchor = state.selectedBars.size > 0
    ? Math.min(...state.selectedBars)
    : state.bars.length;

  const newBars = clipboard.map(b => JSON.parse(JSON.stringify(b)));

  // Extend array if paste target exceeds current length
  while (state.bars.length < anchor + newBars.length)
    state.bars.push(emptyBar());

  for (let i = 0; i < newBars.length; i++)
    state.bars[anchor + i] = newBars[i];

  state.selectedBars = new Set(newBars.map((_, i) => anchor + i));
  renderGrid();
  updateContextToolbar();
}

// ── Transpose ──────────────────────────────────────────────────────────────
function transposeBar(bar, semitones) {
  return {
    beats: bar.beats.map(beat => ({
      ...beat,
      chord: beat.chord && beat.chord !== 'rest' ? {
        ...beat.chord,
        root: NOTES[(NOTES.indexOf(beat.chord.root) + semitones + 120) % 12],
        bass: beat.chord.bass
          ? NOTES[(NOTES.indexOf(beat.chord.bass) + semitones + 120) % 12]
          : null,
      } : beat.chord,
    })),
  };
}

function transposeSelected(semitones) {
  saveHistory();
  const targets = state.selectedBars.size > 0
    ? [...state.selectedBars]
    : state.bars.map((_, i) => i);
  for (const i of targets) state.bars[i] = transposeBar(state.bars[i], semitones);
  renderGrid();
}

// ── Save / Load (localStorage) ─────────────────────────────────────────────
function confirmIfDirty() {
  if (!state.dirty) return true;
  const name = state.currentProject ? `「${state.currentProject}」` : '新規プロジェクト';
  return confirm(`${name}に未保存の変更があります。保存せずに続けますか？`);
}

function saveData(name) {
  localStorage.setItem(`cmp_${name}`, JSON.stringify({
    bars: state.bars, bpm: state.bpm,
    keyRoot: state.keyRoot, keyMode: state.keyMode,
    loopStart: state.loopStart, loopEnd: state.loopEnd,
    beatsPerBar: state.beatsPerBar,
    sections: state.sections,
  }));
  state.currentProject = name;
  state.dirty = false;
  updateProjectList();
  updateProjectBar();
}

function overwriteSave() {
  if (!state.currentProject) return;
  saveData(state.currentProject);
}

function saveAsProject() {
  const name = prompt('プロジェクト名を入力してください', state.currentProject || '');
  if (!name) return;
  if (name !== state.currentProject && localStorage.getItem(`cmp_${name}`)) {
    if (!confirm(`「${name}」はすでに存在します。上書きしますか？`)) return;
  }
  saveData(name);
}

function newProject() {
  if (!confirmIfDirty()) return;
  if (state.playing) stopPlayback();
  history.length = 0;
  state.currentProject = null;
  state.dirty = false;
  state.bpm = 120;
  state.keyRoot = 'C';
  state.keyMode = 'major';
  state.loop = false;
  state.loopStart = null;
  state.loopEnd = null;
  state.beatsPerBar = 4;
  state.sections = [];
  state.selectedBars.clear();
  state.selectedCell = null;
  state.playbackStart = 0;
  document.getElementById('bpm').value     = state.bpm;
  document.getElementById('keyRoot').value = state.keyRoot;
  document.getElementById('keyMode').value = state.keyMode;
  const loopBtn = document.getElementById('loopBtn');
  const loopLabel = loopBtn.querySelector('.loop-label');
  if (loopLabel) loopLabel.textContent = 'ループ: OFF';
  loopBtn.classList.remove('btn-primary');
  loopBtn.classList.add('btn-secondary');
  document.getElementById('chord-panel').classList.add('hidden');
  initBars(4);
  renderGrid();
  updateProjectBar();
  updateContextToolbar();
}

function loadProject(name) {
  if (!confirmIfDirty()) return;
  const raw = localStorage.getItem(`cmp_${name}`);
  if (!raw) return;
  if (state.playing) stopPlayback();
  history.length = 0;
  const data = JSON.parse(raw);
  state.bars           = data.bars;
  state.bpm            = data.bpm       || 120;
  state.keyRoot        = data.keyRoot   || 'C';
  state.keyMode        = data.keyMode   || 'major';
  state.loopStart      = data.loopStart   ?? null;
  state.loopEnd        = data.loopEnd     ?? null;
  state.beatsPerBar    = data.beatsPerBar ?? 4;
  state.sections       = data.sections   ?? [];
  state.currentProject = name;
  state.dirty          = false;
  document.getElementById('bpm').value     = state.bpm;
  document.getElementById('keyRoot').value = state.keyRoot;
  document.getElementById('keyMode').value = state.keyMode;
  document.getElementById('timeSig').value = state.beatsPerBar;
  state.selectedBars.clear();
  state.selectedCell = null;
  document.getElementById('chord-panel').classList.add('hidden');
  renderGrid();
  updateProjectBar();
}

function deleteProject(name) {
  const input = prompt(`削除するには「${name}」と入力してください`);
  if (input !== name) return;
  localStorage.removeItem(`cmp_${name}`);
  if (state.currentProject === name) {
    state.currentProject = null;
    state.dirty = false;
    updateProjectBar();
  }
  updateProjectList();
}

function updateProjectBar() {
  const nameEl      = document.getElementById('current-project-name');
  const dirtyEl     = document.getElementById('dirty-indicator');
  const overwriteEl = document.getElementById('overwriteBtn');
  if (nameEl)      nameEl.textContent    = state.currentProject || '新規プロジェクト';
  if (dirtyEl)     dirtyEl.style.display = state.dirty ? 'inline' : 'none';
  if (overwriteEl) overwriteEl.disabled  = !state.currentProject;
}

function updateProjectList() {
  const list = document.getElementById('project-list');
  const names = Object.keys(localStorage)
    .filter(k => k.startsWith('cmp_'))
    .map(k => k.slice(4));
  list.innerHTML = '';
  if (names.length === 0) {
    list.innerHTML = '<span class="no-projects">保存済みなし</span>';
    return;
  }
  for (const name of names) {
    const item = document.createElement('div');
    item.className = 'project-item' + (name === state.currentProject ? ' project-item-active' : '');
    const load = document.createElement('button');
    load.className = 'project-load-btn';
    load.textContent = name;
    load.addEventListener('click', () => loadProject(name));
    const del = document.createElement('button');
    del.className = 'project-del-btn';
    del.textContent = '✕';
    del.addEventListener('click', () => deleteProject(name));
    item.append(load, del);
    list.appendChild(item);
  }
}

// ── URL Sharing ────────────────────────────────────────────────────────────
function shareUrl() {
  const data = {
    bars: state.bars, bpm: state.bpm,
    keyRoot: state.keyRoot, keyMode: state.keyMode,
    loopStart: state.loopStart, loopEnd: state.loopEnd,
    beatsPerBar: state.beatsPerBar,
    sections: state.sections,
  };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const url = `${location.origin}${location.pathname}#${encoded}`;
  navigator.clipboard.writeText(url)
    .then(() => alert('URLをクリップボードにコピーしました'))
    .catch(() => prompt('このURLをコピーしてください', url));
}

function loadFromUrl() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(hash))));
    state.bars      = data.bars;
    state.bpm       = data.bpm       || 120;
    state.keyRoot   = data.keyRoot   || 'C';
    state.keyMode   = data.keyMode   || 'major';
    state.loopStart   = data.loopStart   ?? null;
    state.loopEnd     = data.loopEnd     ?? null;
    state.beatsPerBar = data.beatsPerBar ?? 4;
    state.sections    = data.sections    ?? [];
  } catch (_) {}
}

// ── Context toolbar ────────────────────────────────────────────────────────
function updateContextToolbar() {
  const bar = document.getElementById('context-toolbar');
  const hasSel = state.selectedBars.size > 0;
  const hasClip = clipboard.length > 0;
  const singleSel = state.selectedBars.size === 1;
  bar.classList.toggle('hidden', !hasSel && !hasClip);
  document.getElementById('ctx-label').textContent = hasSel ? `${state.selectedBars.size}小節選択中` : '';
  document.getElementById('ctx-copy').disabled    = !hasSel;
  document.getElementById('ctx-paste').disabled   = !hasClip;
  document.getElementById('ctx-insert').disabled  = !singleSel;
  document.getElementById('ctx-t-up').disabled    = !hasSel;
  document.getElementById('ctx-t-down').disabled  = !hasSel;
}

function insertBarBelow() {
  if (state.selectedBars.size !== 1) return;
  const bi = [...state.selectedBars][0];
  saveHistory();
  state.bars.splice(bi + 1, 0, emptyBar());
  // Shift section markers after insertion point
  state.sections = state.sections.map(s => ({ ...s, barIndex: s.barIndex > bi ? s.barIndex + 1 : s.barIndex }));
  state.selectedBars.clear();
  renderGrid();
  updateContextToolbar();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function emptyBar() {
  return { beats: Array.from({ length: state.beatsPerBar }, () => ({ chord: null, lyric: '' })) };
}

function initBars(n = 4) {
  state.bars = Array.from({ length: n }, emptyBar);
}

function addBar() {
  saveHistory();
  state.bars.push(emptyBar());
  renderGrid();
}

function setTimeSig(bpb) {
  if (bpb === state.beatsPerBar) return;
  saveHistory();
  state.beatsPerBar = bpb;
  // 既存の小節を新しい拍数に合わせる
  state.bars = state.bars.map(bar => {
    const beats = [...bar.beats];
    while (beats.length < bpb) beats.push({ chord: null, lyric: '' });
    return { beats: beats.slice(0, bpb) };
  });
  // playbackStart を小節先頭に丸める
  state.playbackStart = Math.floor(state.playbackStart / bpb) * bpb;
  renderGrid();
  markDirty();
}

function allBeats() { return state.bars.flatMap(b => b.beats); }

function progressionBefore(gi) {
  return allBeats().slice(0, gi).map(b => b.chord && b.chord !== 'rest' ? b.chord : null);
}

function lastChordBefore(barIdx, beatIdx) {
  const gi = barIdx * state.beatsPerBar + beatIdx;
  const beats = allBeats();
  for (let i = gi - 1; i >= 0; i--) {
    const c = beats[i].chord;
    if (c && c !== 'rest') return c;
  }
  return null;
}

// Returns up to N distinct chords before position (barIdx, beatIdx), newest-last
function progressionBefore(barIdx, beatIdx, n = 4) {
  const gi = barIdx * state.beatsPerBar + beatIdx;
  const beats = allBeats();
  const result = [];
  let lastKey = null;
  for (let i = gi - 1; i >= 0 && result.length < n; i--) {
    const c = beats[i].chord;
    if (c && c !== 'rest') {
      const k = `${c.root}_${c.type}`;
      if (k !== lastKey) { result.unshift(c); lastKey = k; }
    }
  }
  return result;
}

// ── Piano keyboard ─────────────────────────────────────────────────────────
const KEY_LAYOUT = [
  { note: 'C',  type: 'white' }, { note: 'C#', type: 'black' },
  { note: 'D',  type: 'white' }, { note: 'D#', type: 'black' },
  { note: 'E',  type: 'white' }, { note: 'F',  type: 'white' },
  { note: 'F#', type: 'black' }, { note: 'G',  type: 'white' },
  { note: 'G#', type: 'black' }, { note: 'A',  type: 'white' },
  { note: 'A#', type: 'black' }, { note: 'B',  type: 'white' },
];

// octMin〜octMax のMIDI番号: C2=36, C3=48, C4=60, C5=72
function makePianoKeys(octMin, octMax) {
  const keys = [];
  for (let oct = octMin; oct <= octMax; oct++)
    for (const k of KEY_LAYOUT)
      keys.push({ ...k, octave: oct, midi: 36 + (oct - 2) * 12 + NOTES.indexOf(k.note) });
  return keys;
}

// パネル幅に応じて表示オクターブ範囲を返す
// 基本: oct3-4, +上(oct5): 3oct, +下(oct2): 4oct
const WW = 22; // 白鍵幅
const PANEL_PAD = 28; // chord-panel の左右 padding 合計
const WRAP_PAD  = 20; // piano-wrap の左右 padding 合計
function octavesForWidth(panelWidth) {
  const avail = panelWidth - PANEL_PAD - WRAP_PAD;
  if (avail >= 28 * WW) return [2, 5]; // 4oct: C2-B5
  if (avail >= 21 * WW) return [3, 5]; // 3oct: C3-B5
  return [4, 5];                        // 2oct: C4-B5（デフォルト）
}

let _pianoMinWidth = 356; // buildPiano 後に更新

function buildPiano(octMin = 3, octMax = 4, kw = WW, whRatio = 70) {
  const keys = makePianoKeys(octMin, octMax);
  const wrap = document.getElementById('piano');
  wrap.innerHTML = '';
  const WH = Math.round(kw * whRatio / WW);
  const BW = Math.max(8, Math.round(kw * 14 / WW));
  const BH = Math.round(kw * whRatio * 0.63 / WW);
  const whiteKeys = keys.filter(k => k.type === 'white');
  const whitePos  = {};
  whiteKeys.forEach((k, i) => { whitePos[k.midi] = i * kw; });
  wrap.style.cssText = `width:${whiteKeys.length * kw}px;height:${WH}px;position:relative`;

  for (const key of keys) {
    const el = document.createElement('div');
    el.className = `piano-key piano-${key.type}`;
    el.dataset.note = key.note;
    el.dataset.midi = key.midi;
    el.title = `${key.note}${key.octave}`;
    if (key.type === 'white') {
      el.style.cssText = `left:${whitePos[key.midi]}px;width:${kw}px;height:${WH}px`;
    } else {
      const prev = keys.filter(k => k.type === 'white' && k.midi < key.midi).slice(-1)[0];
      el.style.cssText = `left:${whitePos[prev.midi] + kw - BW / 2}px;width:${BW}px;height:${BH}px;z-index:2`;
    }
    const startNote = () => {
      AudioEngine.startSingleNote(key.midi);
      highlightPianoKeys([key.midi]);
      const label = `${key.note}${key.octave}`;
      document.getElementById('piano-note-label').textContent = label;
      showActiveChord(label);
    };
    const stopNote = () => { AudioEngine.stopPreview(); };
    el.addEventListener('mousedown', e => { e.preventDefault(); startNote(); });
    el.addEventListener('mouseup',    stopNote);
    el.addEventListener('mouseleave', stopNote);
    el.addEventListener('touchstart',  e => { e.preventDefault(); startNote(); }, { passive: false });
    el.addEventListener('touchend',    e => { e.preventDefault(); stopNote(); }, { passive: false });
    el.addEventListener('touchcancel', stopNote);
    wrap.appendChild(el);
  }
}

function updatePianoForPanelWidth(panelWidth) {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    // Fill full panel width with 2 octaves (C4–B5) using larger keys
    const avail = panelWidth - PANEL_PAD - WRAP_PAD;
    const kw = Math.max(20, Math.floor(avail / 14));
    buildPiano(4, 5, kw, 46);
  } else {
    const [octMin, octMax] = octavesForWidth(panelWidth);
    buildPiano(octMin, octMax);
  }
}

function showActiveChord(text) {
  const el = document.getElementById('active-chord-display');
  if (el) el.textContent = text;
}
function clearActiveChord() {
  const el = document.getElementById('active-chord-display');
  if (el) el.textContent = '';
}

function highlightPianoKeys(midis) {
  document.querySelectorAll('.piano-key').forEach(el =>
    el.classList.toggle('piano-lit', midis.includes(+el.dataset.midi)));
  if (midis.length) {
    const names = [...new Set(midis.map(m => NOTES[m % 12]))];
    document.getElementById('piano-note-label').textContent = names.join('  ');
  }
}

function clearPianoHighlight() {
  document.querySelectorAll('.piano-key').forEach(el => el.classList.remove('piano-lit'));
  document.getElementById('piano-note-label').textContent = '—';
}

function chordNoteNames(root, type, bass) {
  const ri = NOTES.indexOf(root);
  const names = (CHORD_TYPES[type]?.intervals ?? [0, 4, 7]).map(iv => NOTES[(ri + iv) % 12]);
  if (bass) names.unshift(bass);
  return [...new Set(names)];
}

// ── Grid rendering ─────────────────────────────────────────────────────────
function renderGrid() {
  const grid   = document.getElementById('grid');
  const header = document.getElementById('beat-header');

  const bpb = state.beatsPerBar;
  header.innerHTML =
    '<div class="bar-outer-spacer"></div>' +
    '<div class="bar-sel-spacer"></div>' +
    '<div class="bar-loop-spacer"></div>' +
    '<div class="bar-num-spacer"></div>' +
    Array.from({ length: bpb }, (_, i) => `<div class="beat-header-cell">${i + 1}</div>`).join('') +
    '<div class="bar-ctrl-spacer"></div>';

  grid.innerHTML = '';

  state.bars.forEach((bar, bi) => {
    const sec = sectionAt(bi);

    // Outer wrapper: provides left margin for section controls
    const outer = document.createElement('div');
    outer.className = 'bar-outer';

    if (sec) {
      // Active section: block divider above bar-row
      const tag = document.createElement('div');
      tag.className = 'section-tag';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'section-name-input';
      nameInput.value = sec.name;
      nameInput.addEventListener('input', e => renameSection(bi, e.target.value));
      nameInput.addEventListener('click', e => e.stopPropagation());
      const delBtn = document.createElement('button');
      delBtn.className = 'section-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'セクションを削除';
      delBtn.addEventListener('click', e => { e.stopPropagation(); removeSection(bi); });
      tag.append(nameInput, delBtn);
      outer.appendChild(tag);
    } else {
      // Add button: sits in the gap between bars (shown on hover)
      const addBtn = document.createElement('button');
      addBtn.className = 'section-add-btn';
      addBtn.title = 'ここにセクションを追加';
      addBtn.textContent = '▶';
      addBtn.addEventListener('click', e => { e.stopPropagation(); addSection(bi); });
      outer.appendChild(addBtn);
    }

    const row = document.createElement('div');
    row.className = 'bar-row' + (state.selectedBars.has(bi) ? ' bar-selected' : '');

    // Selection toggle
    const selBtn = document.createElement('div');
    selBtn.className = 'bar-sel-btn' + (state.selectedBars.has(bi) ? ' active' : '');
    selBtn.title = '選択（コピー・転調用）';
    selBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (state.selectedBars.has(bi)) state.selectedBars.delete(bi);
      else state.selectedBars.add(bi);
      renderGrid();
      updateContextToolbar();
    });
    row.appendChild(selBtn);

    // Loop flags
    const loopFlags = document.createElement('div');
    loopFlags.className = 'bar-loop-flags';
    const flagS = document.createElement('button');
    flagS.className = 'loop-flag-btn loop-flag-s' + (state.loopStart === bi ? ' active' : '');
    flagS.textContent = 'S';
    flagS.title = 'ループ開始';
    flagS.addEventListener('click', e => {
      e.stopPropagation();
      state.loopStart = state.loopStart === bi ? null : bi;
      if (state.loopStart !== null && state.loopEnd !== null && state.loopEnd < state.loopStart)
        state.loopEnd = null;
      renderGrid();
    });
    const flagE = document.createElement('button');
    flagE.className = 'loop-flag-btn loop-flag-e' + (state.loopEnd === bi ? ' active' : '');
    flagE.textContent = 'E';
    flagE.title = 'ループ終了';
    flagE.addEventListener('click', e => {
      e.stopPropagation();
      state.loopEnd = state.loopEnd === bi ? null : bi;
      if (state.loopStart !== null && state.loopEnd !== null && state.loopEnd < state.loopStart)
        state.loopStart = null;
      renderGrid();
    });
    loopFlags.append(flagS, flagE);
    row.appendChild(loopFlags);

    // Bar label → immediate playback
    const label = document.createElement('div');
    const isStart = state.playbackStart === bi * state.beatsPerBar;
    label.className = 'bar-label' + (isStart ? ' bar-label-start' : '');
    label.title = 'クリックでここから再生';
    label.innerHTML = isStart
      ? `<span class="bar-label-play">▶</span><span>${bi + 1}</span>`
      : `${bi + 1}`;
    label.addEventListener('click', e => {
      e.stopPropagation();
      if (state.playing) stopPlayback();
      state.playbackStart = bi * state.beatsPerBar;
      state.selectedCell = null;
      renderGrid();
      startPlayback();
    });
    row.appendChild(label);

    // Beat cells
    bar.beats.forEach((beat, bti) => {
      const cell = document.createElement('div');
      cell.className = 'beat-cell';
      const gi = bi * state.beatsPerBar + bti;
      if (state.playheadIdx === gi) cell.classList.add('playhead');
      if (state.selectedCell?.barIdx === bi && state.selectedCell?.beatIdx === bti)
        cell.classList.add('selected');

      const chordDiv = document.createElement('div');
      chordDiv.className = 'chord-display';
      if (beat.chord === 'rest') {
        chordDiv.textContent = '∅';
        chordDiv.classList.add('rest');
      } else if (beat.chord) {
        chordDiv.textContent = formatChord(beat.chord.root, beat.chord.type, beat.chord.bass);
        chordDiv.classList.add('has-chord');
        if (beat.chord.octaveOffset === 1)  { const ind = document.createElement('span'); ind.className = 'oct-indicator'; ind.textContent = '↑'; chordDiv.appendChild(ind); }
        if (beat.chord.octaveOffset === -1) { const ind = document.createElement('span'); ind.className = 'oct-indicator'; ind.textContent = '↓'; chordDiv.appendChild(ind); }
      } else {
        chordDiv.textContent = '—';
        chordDiv.classList.add('empty');
      }
      // Roman numeral inline inside chord-display (so cell expands to fit both)
      if (beat.chord && beat.chord !== 'rest') {
        const roman = getRomanNumeral(beat.chord.root, beat.chord.type, state.keyRoot, state.keyMode);
        if (roman) {
          const rd = document.createElement('span');
          rd.className = 'roman-numeral';
          rd.textContent = roman;
          chordDiv.appendChild(rd);
        }
      }

      cell.appendChild(chordDiv);

      const lyricInput = document.createElement('input');
      lyricInput.type = 'text';
      lyricInput.className = 'lyric-input';
      lyricInput.value = beat.lyric;
      lyricInput.placeholder = bti === 0 ? '歌詞' : '';
      if (beat.lyric.length > 10) cell.style.minWidth = `${110 + (beat.lyric.length - 10) * 7}px`;
      lyricInput.addEventListener('input', e => {
        state.bars[bi].beats[bti].lyric = e.target.value;
        // Expand cell width to fit lyric text (fallback for browsers without field-sizing)
        const ch = Math.max(0, e.target.value.length);
        cell.style.minWidth = ch > 10 ? `${110 + (ch - 10) * 7}px` : '';
      });
      lyricInput.addEventListener('click', e => e.stopPropagation());
      cell.appendChild(lyricInput);

      cell.addEventListener('click', () => openPanel(bi, bti));
      row.appendChild(cell);
    });

    // Delete button
    if (state.bars.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'bar-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'この小節を削除';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        saveHistory();
        state.bars.splice(bi, 1);
        const newSel = new Set();
        for (const idx of state.selectedBars) if (idx !== bi) newSel.add(idx > bi ? idx - 1 : idx);
        state.selectedBars = newSel;
        state.sections = state.sections
          .filter(s => s.barIndex !== bi)
          .map(s => ({ ...s, barIndex: s.barIndex > bi ? s.barIndex - 1 : s.barIndex }));
        if (state.playbackStart >= state.bars.length * state.beatsPerBar)
          state.playbackStart = Math.max(0, (state.bars.length - 1) * state.beatsPerBar);
        if (state.selectedCell?.barIdx >= state.bars.length) state.selectedCell = null;
        renderGrid();
        updateContextToolbar();
      });
      row.appendChild(delBtn);
    }

    outer.appendChild(row);
    grid.appendChild(outer);
  });
}

// ── Chord panel ────────────────────────────────────────────────────────────
function openPanel(barIdx, beatIdx) {
  state.selectedCell = { barIdx, beatIdx };
  state.selectedBass = null;
  // オクターブ: 既存コードの値を引き継ぐ、空セルは 0
  const beat = state.bars[barIdx].beats[beatIdx];
  state.selectedOctave = (beat.chord && beat.chord !== 'rest') ? (beat.chord.octaveOffset ?? 0) : 0;
  clearActiveChord();
  renderGrid();
  document.getElementById('chord-panel').classList.remove('hidden');
  document.getElementById('resize-handle').classList.add('visible');
  renderPanel();
}

function updateOctaveButtons() {
  const up   = document.getElementById('oct-up');
  const down = document.getElementById('oct-down');
  if (!up || !down) return;
  up.classList.toggle('active', state.selectedOctave === 1);
  down.classList.toggle('active', state.selectedOctave === -1);
}

function closePanel() {
  document.getElementById('chord-panel').classList.add('hidden');
  document.getElementById('resize-handle').classList.remove('visible');
  state.selectedCell = null;
  clearPianoHighlight();
  clearActiveChord();
  renderGrid();
}

function renderPanel() {
  const { barIdx, beatIdx } = state.selectedCell;
  const progression = progressionBefore(barIdx, beatIdx);

  document.getElementById('panel-title').textContent = `小節 ${barIdx + 1} — 拍 ${beatIdx + 1}`;
  clearPianoHighlight();

  // 既存コードの解説を即時表示
  const beat = state.bars[barIdx].beats[beatIdx];
  const theorySection = document.getElementById('theory-section');
  const theoryText    = document.getElementById('theory-text');
  if (beat.chord && beat.chord !== 'rest') {
    const prevChord = lastChordBefore(barIdx, beatIdx);
    theoryText.textContent = getExplanation(prevChord, beat.chord, progressionBefore(barIdx, beatIdx));
    theorySection.style.display = 'block';
  } else {
    theorySection.style.display = 'none';
  }

  renderMatrix(progression);
  renderBassSelector();
  updateOctaveButtons();
}

const FN_CONFIG = {
  T:  { border: '#06b6d4' },
  SD: { border: '#10b981' },
  D:  { border: '#f59e0b' },
};

function renderMatrix(progression) {
  const scores = scoreNextChords(progression);
  const fnMap  = state.keyRoot ? getDiatonicFunctions(state.keyRoot, state.keyMode) : {};

  const header = document.getElementById('matrix-header');
  const body   = document.getElementById('matrix-body');

  header.innerHTML = '<div class="matrix-corner"></div>' +
    CHORD_TYPE_KEYS.map(t => `<div class="matrix-col-head">${CHORD_TYPES[t].display}</div>`).join('');
  body.innerHTML = '';

  for (const root of NOTES) {
    const rowEl = document.createElement('div');
    rowEl.className = 'matrix-row';

    const rl = document.createElement('div');
    rl.className = 'matrix-row-head';
    rl.textContent = root;
    rowEl.appendChild(rl);

    for (const type of CHORD_TYPE_KEYS) {
      const score = scores[`${root}_${type}`] ?? 0;
      const fn    = fnMap[`${root}_${type}`];
      const cfg   = fn ? FN_CONFIG[fn] : null;

      const cell = document.createElement('button');
      cell.className = 'matrix-cell' + (fn ? ' matrix-diatonic' : '');
      cell.title = `${formatChord(root, type)}${fn ? ` (${fn})` : ''}`;

      const l = 15 + score * 45, s = score * 75;
      cell.style.background = `hsl(185,${s}%,${l}%)`;

      if (cfg) {
        cell.style.outline      = `2px solid ${cfg.border}`;
        cell.style.outlineOffset = '-2px';
        cell.style.color        = cfg.border;
        cell.textContent        = fn;
      } else {
        cell.style.color = score > 0.5 ? '#ccc' : '#444';
        cell.textContent = '';
      }

      const startChordPreview = () => {
        AudioEngine.startPreview(root, type, state.selectedBass, state.selectedOctave);
        highlightPianoKeys(getChordMidis(root, type, state.selectedBass, state.selectedOctave));
      };
      const confirmChord = () => { AudioEngine.stopPreview(); showActiveChord(formatChord(root, type, state.selectedBass)); selectChord(root, type); };
      const cancelChord  = () => { AudioEngine.stopPreview(); clearPianoHighlight(); };
      cell.addEventListener('mousedown', e => { e.preventDefault(); showActiveChord(formatChord(root, type, state.selectedBass)); startChordPreview(); });
      cell.addEventListener('mouseup',    confirmChord);
      cell.addEventListener('mouseleave', cancelChord);
      cell.addEventListener('touchstart',  e => { e.preventDefault(); showActiveChord(formatChord(root, type, state.selectedBass)); startChordPreview(); }, { passive: false });
      { let _lastTap = 0;
        cell.addEventListener('touchend', e => {
          e.preventDefault();
          confirmChord();
          const now = Date.now();
          if (now - _lastTap < 350) closePanel();
          _lastTap = now;
        }, { passive: false });
      }
      cell.addEventListener('touchcancel', cancelChord);
      rowEl.appendChild(cell);
    }
    body.appendChild(rowEl);
  }

  renderFunctionLegend(!!state.keyRoot);
  if (window.innerWidth <= 768) requestAnimationFrame(setupMatrixScrollbar);
}

function setupMatrixScrollbar() {
  const wrap  = document.getElementById('matrix-wrap');
  if (!wrap) return;

  let track = document.getElementById('matrix-scrollbar-track');
  if (!track) {
    track = document.createElement('div');
    track.id = 'matrix-scrollbar-track';
    const thumb = document.createElement('div');
    thumb.id = 'matrix-scrollbar-thumb';
    track.appendChild(thumb);
    wrap.after(track);
  }
  const thumb = document.getElementById('matrix-scrollbar-thumb');

  const update = () => {
    const ratio = wrap.clientWidth / wrap.scrollWidth;
    if (ratio >= 1) { track.style.display = 'none'; return; }
    track.style.display = '';
    const trackW = track.clientWidth;
    const tW = Math.max(40, Math.round(ratio * trackW));
    const tX = Math.round((wrap.scrollLeft / (wrap.scrollWidth - wrap.clientWidth)) * (trackW - tW));
    thumb.style.width = tW + 'px';
    thumb.style.transform = `translateX(${tX}px)`;
  };

  wrap.removeEventListener('scroll', update);
  wrap.addEventListener('scroll', update);
  update();

  // Drag logic (touch + mouse)
  let dragging = false, startX = 0, startScroll = 0;
  const onStart = x => {
    dragging = true;
    startX = x;
    startScroll = wrap.scrollLeft;
  };
  const onMove = x => {
    if (!dragging) return;
    const trackW = track.clientWidth;
    const ratio  = wrap.clientWidth / wrap.scrollWidth;
    const tW     = Math.max(40, Math.round(ratio * trackW));
    const scale  = (wrap.scrollWidth - wrap.clientWidth) / (trackW - tW);
    wrap.scrollLeft = startScroll + (x - startX) * scale;
  };
  const onEnd = () => { dragging = false; };

  thumb.onmousedown  = e => { e.preventDefault(); onStart(e.clientX); };
  document.addEventListener('mousemove', e => onMove(e.clientX));
  document.addEventListener('mouseup',   onEnd);
  thumb.ontouchstart = e => { e.preventDefault(); onStart(e.touches[0].clientX); };
  thumb.ontouchmove  = e => { e.preventDefault(); onMove(e.touches[0].clientX); };
  thumb.ontouchend   = onEnd;
}

function renderFunctionLegend(show) {
  let legend = document.getElementById('fn-legend');
  if (!legend) {
    legend = document.createElement('div');
    legend.id = 'fn-legend';
    document.getElementById('matrix-wrap').after(legend);
  }
  if (!show) { legend.innerHTML = ''; return; }
  const labels = { T: 'トニック', SD: 'サブドミナント', D: 'ドミナント' };
  legend.innerHTML =
    ``+
    Object.entries(FN_CONFIG).map(([fn, cfg]) =>
      `<span class="fn-badge" style="border-color:${cfg.border};color:${cfg.border}">${fn}</span>` +
      `<span class="fn-name">${labels[fn]}</span>`
    ).join('');
}

function renderBassSelector() {
  const list = document.getElementById('bass-list');
  list.innerHTML = '';
  for (const note of NOTES) {
    const btn = document.createElement('button');
    btn.className = 'bass-btn' + (state.selectedBass === note ? ' active' : '');
    btn.textContent = note;
    btn.addEventListener('click', () => {
      state.selectedBass = state.selectedBass === note ? null : note;
      renderBassSelector();
      const beat = state.bars[state.selectedCell.barIdx].beats[state.selectedCell.beatIdx];
      if (beat.chord && beat.chord !== 'rest') { beat.chord.bass = state.selectedBass; renderGrid(); }
    });
    list.appendChild(btn);
  }
}

function selectChord(root, type) {
  if (!state.selectedCell) return;
  const { barIdx, beatIdx } = state.selectedCell;
  const beat      = state.bars[barIdx].beats[beatIdx];
  const prevChord = lastChordBefore(barIdx, beatIdx);

  saveHistory();
  beat.chord = { root, type, bass: state.selectedBass, octaveOffset: state.selectedOctave };

  document.getElementById('theory-text').textContent = getExplanation(prevChord, { root, type }, progressionBefore(barIdx, beatIdx));
  document.getElementById('theory-section').style.display = 'block';
  highlightPianoKeys(getChordMidis(root, type, state.selectedBass, state.selectedOctave));
  renderGrid();
  renderBassSelector();
}

// ── Playback ───────────────────────────────────────────────────────────────
function startPlayback(acStartTime) {
  if (state.playing) return;
  AudioEngine.getCtx();

  // Determine play range (loop flags take priority when loop is ON)
  let startBeat, endBeat;
  if (state.loop && state.loopStart !== null) {
    startBeat = state.loopStart * state.beatsPerBar;
    endBeat   = state.loopEnd !== null ? (state.loopEnd + 1) * state.beatsPerBar : state.bars.length * state.beatsPerBar;
  } else {
    startBeat = state.selectedCell
      ? state.selectedCell.barIdx * state.beatsPerBar + state.selectedCell.beatIdx
      : state.playbackStart;
    endBeat = state.bars.length * state.beatsPerBar;
  }
  const raw = allBeats().slice(startBeat, endBeat);
  const scheduled = [];

  for (const beat of raw) {
    if (beat.chord === null) {
      if (scheduled.length > 0 && scheduled[scheduled.length - 1].chord !== 'rest')
        scheduled[scheduled.length - 1].duration += 1;
      else
        scheduled.push({ chord: null, duration: 1 });
    } else {
      scheduled.push({ chord: beat.chord, duration: 1 });
    }
  }

  state.playing = true;
  document.getElementById('playBtn').disabled = true;

  state.stopPlayback = AudioEngine.schedulePlayback(
    scheduled, state.bpm,
    gi => { state.playheadIdx = startBeat + gi; renderGrid(); },
    (acEndTime) => {
      state.playing = false;
      state.stopPlayback = null;
      document.getElementById('playBtn').disabled = false;
      if (state.loop) {
        startPlayback(acEndTime);
      } else {
        state.playheadIdx = null;
        renderGrid();
      }
    },
    acStartTime,
    startBeat,
    state.beatsPerBar
  );
}

function stopPlayback() {
  if (state.stopPlayback) state.stopPlayback();
  AudioEngine.stopScheduled();
  state.playing = false;
  state.playheadIdx = null;
  document.getElementById('playBtn').disabled = false;
  renderGrid();
}

// ── Boot ───────────────────────────────────────────────────────────────────
function init() {
  loadFromUrl();
  if (state.bars.length === 0) initBars(4);

  document.getElementById('bpm').value     = state.bpm;
  document.getElementById('keyRoot').value = state.keyRoot;
  document.getElementById('keyMode').value = state.keyMode;
  AudioEngine.setVolume(parseInt(document.getElementById('volume').value, 10) / 80);

  renderGrid();
  updatePianoForPanelWidth(document.getElementById('chord-panel').offsetWidth || window.innerWidth);
  // 2オクターブ = 白鍵14本 × 22px + wrap内padding + panel内padding
  _pianoMinWidth = 14 * WW + WRAP_PAD + PANEL_PAD; // 308 + 20 + 28 = 356px
  updateProjectList();
  updateProjectBar();
  updateContextToolbar();

  window.addEventListener('beforeunload', e => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ── Resizable chord panel ──
  const resizeHandle = document.getElementById('resize-handle');
  const chordPanel   = document.getElementById('chord-panel');
  let resizing = false, resizeStartX = 0, resizeStartW = 0;

  resizeHandle.addEventListener('mousedown', e => {
    resizing = true;
    resizeStartX = e.clientX;
    resizeStartW = chordPanel.offsetWidth;
    resizeHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const delta = resizeStartX - e.clientX;
    const newW = Math.max(_pianoMinWidth, Math.min(900, resizeStartW + delta));
    chordPanel.style.width = newW + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    resizeHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // パネル幅変化に応じてオクターブを更新
  new ResizeObserver(entries => {
    for (const entry of entries) {
      updatePianoForPanelWidth(entry.contentRect.width);
    }
  }).observe(chordPanel);

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'z') { e.preventDefault(); undo(); }
    if (mod && e.key === 'c' && state.selectedBars.size > 0) { e.preventDefault(); copySelectedBars(); }
    if (mod && e.key === 'v' && clipboard.length > 0)        { e.preventDefault(); pasteBars(); }
    if (mod && e.key === 's') {
      e.preventDefault();
      state.currentProject ? overwriteSave() : saveAsProject();
    }
  });

  document.getElementById('playBtn').addEventListener('click', () => startPlayback());
  document.getElementById('stopBtn').addEventListener('click', stopPlayback);
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('rewindBtn').addEventListener('click', () => {
    state.playbackStart = 0;
    state.selectedCell  = null;
    if (state.playing) { stopPlayback(); startPlayback(); }
    else { state.playheadIdx = null; renderGrid(); }
  });

  document.getElementById('addBarBtn').addEventListener('click', addBar);
  document.getElementById('manualBtn').addEventListener('click', () => {
    document.getElementById('manual-overlay').classList.remove('hidden');
  });
  document.getElementById('manual-close').addEventListener('click', () => {
    document.getElementById('manual-overlay').classList.add('hidden');
  });
  document.getElementById('manual-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('manual-overlay'))
      document.getElementById('manual-overlay').classList.add('hidden');
  });

  document.getElementById('newProjectBtn').addEventListener('click', newProject);
  document.getElementById('overwriteBtn').addEventListener('click', overwriteSave);
  document.getElementById('saveAsBtn').addEventListener('click', saveAsProject);
  document.getElementById('shareBtn').addEventListener('click', shareUrl);
  document.getElementById('close-panel').addEventListener('click', closePanel);

  // Octave buttons
  document.getElementById('oct-up').addEventListener('click', () => {
    state.selectedOctave = state.selectedOctave === 1 ? 0 : 1;
    updateOctaveButtons();
  });
  document.getElementById('oct-down').addEventListener('click', () => {
    state.selectedOctave = state.selectedOctave === -1 ? 0 : -1;
    updateOctaveButtons();
  });

  // Loop
  document.getElementById('loopBtn').addEventListener('click', () => {
    state.loop = !state.loop;
    const btn = document.getElementById('loopBtn');
    btn.querySelectorAll('.loop-label').forEach(l => { l.textContent = `ループ: ${state.loop ? 'ON' : 'OFF'}`; });
    btn.classList.toggle('btn-primary',   state.loop);
    btn.classList.toggle('btn-secondary', !state.loop);
  });

  // クリックは常時ON
  AudioEngine.setClick(true);

  // Context toolbar
  document.getElementById('ctx-copy').addEventListener('click', copySelectedBars);
  document.getElementById('ctx-paste').addEventListener('click', pasteBars);
  document.getElementById('ctx-insert').addEventListener('click', insertBarBelow);
  document.getElementById('ctx-t-up').addEventListener('click',   () => transposeSelected(1));
  document.getElementById('ctx-t-down').addEventListener('click', () => transposeSelected(-1));
  document.getElementById('ctx-t-all-up').addEventListener('click', () => {
    const prev = new Set(state.selectedBars);
    state.selectedBars.clear();
    transposeSelected(1);
    state.selectedBars = prev;
    updateContextToolbar();
  });
  document.getElementById('ctx-t-all-down').addEventListener('click', () => {
    const prev = new Set(state.selectedBars);
    state.selectedBars.clear();
    transposeSelected(-1);
    state.selectedBars = prev;
    updateContextToolbar();
  });
  document.getElementById('ctx-deselect').addEventListener('click', () => {
    state.selectedBars.clear();
    renderGrid();
    updateContextToolbar();
  });

  // Cell actions
  const restBtn  = document.getElementById('rest-btn');
  const clearBtn = document.getElementById('clear-btn');
  restBtn.addEventListener('click', () => {
    if (!state.selectedCell) return;
    const { barIdx, beatIdx } = state.selectedCell;
    saveHistory();
    state.bars[barIdx].beats[beatIdx].chord = 'rest';
    clearPianoHighlight();
    clearActiveChord();
    renderGrid();
    document.getElementById('theory-section').style.display = 'none';
  });
  clearBtn.addEventListener('click', () => {
    if (!state.selectedCell) return;
    const { barIdx, beatIdx } = state.selectedCell;
    saveHistory();
    state.bars[barIdx].beats[beatIdx].chord = null;
    clearPianoHighlight();
    clearActiveChord();
    renderGrid();
    document.getElementById('theory-section').style.display = 'none';
  });
  [restBtn, clearBtn].forEach(btn => {
    let _lastTap = 0;
    btn.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - _lastTap < 350) closePanel();
      _lastTap = now;
    });
  });
  document.getElementById('clear-bass').addEventListener('click', () => {
    state.selectedBass = null;
    renderBassSelector();
    const beat = state.selectedCell &&
      state.bars[state.selectedCell.barIdx].beats[state.selectedCell.beatIdx];
    if (beat?.chord && beat.chord !== 'rest') { beat.chord.bass = null; renderGrid(); }
  });

  // Key / BPM / Timbre / Volume
  const refreshKey = () => {
    state.keyRoot = document.getElementById('keyRoot').value;
    state.keyMode = document.getElementById('keyMode').value;
    renderGrid();
    if (state.selectedCell) renderPanel();
  };
  document.getElementById('keyRoot').addEventListener('change', refreshKey);
  document.getElementById('keyMode').addEventListener('change', refreshKey);
  document.getElementById('timeSig').addEventListener('change', e => {
    setTimeSig(parseInt(e.target.value, 10));
  });
  document.getElementById('bpm').addEventListener('input', e => {
    state.bpm = parseInt(e.target.value, 10) || 120;
    markDirty();
  });
  document.getElementById('timbre').addEventListener('change', e => {
    state.timbre = e.target.value;
    AudioEngine.setTimbre(e.target.value);
  });
  document.getElementById('volume').addEventListener('input', e => {
    AudioEngine.setVolume(parseInt(e.target.value, 10) / 80);
  });
}

document.addEventListener('DOMContentLoaded', init);
