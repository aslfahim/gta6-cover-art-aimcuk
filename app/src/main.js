// Sunset Strip wiring: photo upload (file input and drag-drop), per-panel crop and
// position (drag to pan, zoom slider), caption editing, live preview on canvas,
// and PNG export in 1080 x 1080, 1080 x 1350 and 1920 x 1080. A `?shot=` query
// sets up a fixed scene for a screenshot instead (./shots.js).

import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const status = document.getElementById('status');
const dropzone = document.getElementById('dropzone');

function blankPanel() {
  return { img: null, zoom: 1, ox: 0, oy: 0 };
}

const state = {
  panels: [blankPanel(), blankPanel(), blankPanel(), blankPanel()],
  caption: { text: 'Sunset Strip', sizePct: 100, color: '#ff2e88', outline: true, shadow: true },
};

let selected = 0;

function redraw() {
  state.caption.text = captionInput.value;
  drawCover(canvas, state);
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Puts `img` into the selected panel, keeping its current zoom and pan. */
function placePhoto(img) {
  state.panels[selected].img = img;
  redraw();
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  placePhoto(await loadImage(URL.createObjectURL(file)));
  status.textContent = `Photo loaded into panel ${selected + 1}.`;
}

/* --- panel selection --- */
const panelButtons = [...document.querySelectorAll('.panel-btn')];
function selectPanel(i) {
  selected = i;
  panelButtons.forEach((b, j) => b.classList.toggle('active', j === i));
  document.getElementById('zoom').value = Math.round(state.panels[i].zoom * 100);
  document.getElementById('zoomValue').textContent = `${Math.round(state.panels[i].zoom * 100)}%`;
}
panelButtons.forEach((b) => b.addEventListener('click', () => selectPanel(Number(b.dataset.panel))));
selectPanel(0);

/* --- photo input, drag-drop, and panning on the preview --- */
document.getElementById('photo').addEventListener('change', (e) => loadFile(e.target.files[0]));

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragging');
  loadFile(e.dataTransfer.files[0]);
});

let dragging = null;
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
}
canvas.addEventListener('pointerdown', (e) => {
  dragging = { ...canvasPoint(e), ox: state.panels[selected].ox, oy: state.panels[selected].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const p = canvasPoint(e);
  const panel = state.panels[selected];
  panel.ox = Math.max(-0.5, Math.min(0.5, dragging.ox + (p.x - dragging.x) * 2));
  panel.oy = Math.max(-0.5, Math.min(0.5, dragging.oy + (p.y - dragging.y) * 2));
  redraw();
});
canvas.addEventListener('pointerup', () => { dragging = null; });

/* --- zoom, fill-all, clear --- */
document.getElementById('zoom').addEventListener('input', (e) => {
  const zoom = Number(e.target.value) / 100;
  state.panels[selected].zoom = zoom;
  document.getElementById('zoomValue').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('fillAll').addEventListener('click', () => {
  const img = state.panels[selected].img;
  if (!img) {
    status.textContent = 'Load a photo into the selected panel first.';
    return;
  }
  state.panels.forEach((p) => { p.img = img; });
  status.textContent = 'One photo now fills all four panels.';
  redraw();
});
document.getElementById('clearPanel').addEventListener('click', () => {
  state.panels[selected] = blankPanel();
  selectPanel(selected);
  status.textContent = `Panel ${selected + 1} cleared.`;
  redraw();
});

/* --- caption editing --- */
captionInput.addEventListener('input', redraw);
document.getElementById('capSize').addEventListener('input', (e) => {
  state.caption.sizePct = Number(e.target.value);
  document.getElementById('sizeValue').textContent = `${e.target.value}%`;
  redraw();
});
document.getElementById('capColor').addEventListener('input', (e) => {
  state.caption.color = e.target.value;
  redraw();
});
document.getElementById('capOutline').addEventListener('change', (e) => {
  state.caption.outline = e.target.checked;
  redraw();
});
document.getElementById('capShadow').addEventListener('change', (e) => {
  state.caption.shadow = e.target.checked;
  redraw();
});

/* --- export: render the same cover at the post size and download it as PNG --- */
function exportPng(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, state);
  off.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunset-strip-${w}x${h}.png`;
    a.click();
    status.textContent = `Saved sunset-strip-${w}x${h}.png`;
  }, 'image/png');
}
document.getElementById('exportSquare').addEventListener('click', () => exportPng(1080, 1080));
document.getElementById('exportPortrait').addEventListener('click', () => exportPng(1080, 1350));
document.getElementById('exportWide').addEventListener('click', () => exportPng(1920, 1080));

/* --- screenshot scenes: ?shot=cover shows the cover alone, ?shot=editor the
       editor with a sample photo loaded. `size` picks the cover canvas, e.g.
       1920x1080, 1080x1350 or 1080x1080. --- */
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, async (sample, text) => {
    const img = await loadImage(sample);
    state.panels.forEach((p) => { p.img = img; });
    if (shot === 'editor') {
      // Show off per-panel crop: each panel frames the same photo differently.
      state.panels[1].zoom = 1.5;
      state.panels[1].ox = 0.12;
      state.panels[2].zoom = 1.35;
      state.panels[2].oy = -0.1;
      state.panels[3].zoom = 1.8;
      state.panels[3].ox = -0.12;
      state.panels[3].oy = 0.08;
    }
    captionInput.value = text;
    state.caption.text = text;
    redraw();
  });
} else {
  redraw();
}
