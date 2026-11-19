// Sunset Strip renderer: a 2 x 2 four-panel grid cover. Each panel holds its own
// photo (panned and zoomed), a gold-to-purple sunset grade washes over every
// panel, white gutters split the grid, film grain sits on top, and the caption
// is drawn as a tilted sticker with a white border and a drop shadow.
//
// The state the renderer reads:
//   panels: [{ img, zoom, ox, oy }] — img is an Image or null, zoom 1..3,
//     ox/oy the pan as a fraction of the panel (-0.5 .. 0.5).
//   caption: { text, sizePct, color, outline, shadow }.

const GOLD = 'rgba(255, 170, 60, 0.20)';
const MAGENTA = 'rgba(200, 40, 120, 0.38)';
const DEEP = '#1c0f2e';

/** Builds a small tile of random monochrome noise for the film-grain overlay. */
export function makeGrainTile(size = 160) {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  const data = ctx.createImageData(size, size);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return tile;
}

let grainTile = null;
function grainPattern(ctx) {
  if (!grainTile) grainTile = makeGrainTile();
  return ctx.createPattern(grainTile, 'repeat');
}

/** Draws one photo into a panel rect, cover-fit, with the panel's zoom and pan. */
function drawPanelPhoto(ctx, panel, x, y, w, h) {
  const img = panel.img;
  if (!img) return false;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const cx = x + w / 2 + (panel.ox || 0) * w;
  const cy = y + h / 2 + (panel.oy || 0) * h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  return true;
}

/** Sunset placeholder for a panel with no photo yet. */
function drawPanelEmpty(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#ff9a3d');
  g.addColorStop(0.55, '#c93a7e');
  g.addColorStop(1, '#5b2a86');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `bold ${Math.round(h * 0.09)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DROP A PHOTO', x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

/** The sunset grade: warm gold from the top, magenta-purple toward the bottom. */
function sunsetGrade(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, GOLD);
  g.addColorStop(1, MAGENTA);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** The sticker caption: bold capitals, tilted a touch, white border, drop shadow. */
function drawStickerCaption(ctx, caption, w, h) {
  const text = (caption.text || '').trim().toUpperCase();
  if (!text) return;
  const base = h * 0.085 * ((caption.sizePct || 100) / 100);
  let size = base;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > w * 0.92 && size > 14) {
    size -= 2;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
  }
  ctx.save();
  ctx.translate(w / 2, h - h * 0.075);
  ctx.rotate(-0.035);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (caption.shadow !== false) {
    ctx.shadowColor = 'rgba(20, 5, 30, 0.65)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.09;
  }
  if (caption.outline !== false) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = size * 0.22;
    ctx.strokeText(text, 0, 0);
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = caption.color || '#ff2e88';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A small pill in the top-left corner naming the cover series. */
function drawSeriesTag(ctx, w, h) {
  const label = 'SUNSET STRIP';
  const size = Math.round(h * 0.022);
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  const padX = size * 0.9;
  const tw = ctx.measureText(label).width;
  const x = w * 0.02;
  const y = h * 0.02;
  const bw = tw + padX * 2;
  const bh = size * 2.1;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.shadowColor = 'rgba(20, 5, 30, 0.5)';
  ctx.shadowBlur = size * 0.3;
  ctx.shadowOffsetY = size * 0.12;
  roundRect(ctx, x, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1c0f2e';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX, y + bh / 2 + size * 0.04);
  ctx.textBaseline = 'alphabetic';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the whole cover onto `canvas` at its own pixel size. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = DEEP;
  ctx.fillRect(0, 0, w, h);

  const gutter = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  const pw = (w - gutter * 3) / 2;
  const ph = (h - gutter * 3) / 2;
  const xs = [gutter, gutter * 2 + pw];
  const ys = [gutter, gutter * 2 + ph];

  for (let i = 0; i < 4; i++) {
    const x = xs[i % 2];
    const y = ys[Math.floor(i / 2)];
    const panel = state.panels[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, pw, ph);
    ctx.clip();
    if (!drawPanelPhoto(ctx, panel, x, y, pw, ph)) drawPanelEmpty(ctx, x, y, pw, ph);
    sunsetGrade(ctx, x, y, pw, ph);
    ctx.restore();
  }

  // White gutters read as the postcard frame around the four panels.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, gutter);
  ctx.fillRect(0, h - gutter, w, gutter);
  ctx.fillRect(0, 0, gutter, h);
  ctx.fillRect(w - gutter, 0, gutter, h);

  // Film grain over the whole cover.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  drawSeriesTag(ctx, w, h);
  drawStickerCaption(ctx, state.caption, w, h);
}
