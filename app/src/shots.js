// Fixed scenes for screenshots: ?shot=editor shows the page with a sample photo
// loaded in every panel; ?shot=cover shows the cover alone, at the canvas size
// the `size` query names (1920x1080, 1080x1350 or 1080x1080). `photo` picks the
// sample (samples/<photo>.jpg) and `caption` the words. window.__shotReady is
// set once the cover has been painted.
export async function runShot(shot, query, load) {
  const canvas = document.getElementById('cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const size = (query.get('size') || '1080x1080').split('x');
    const w = Number(size[0]);
    const h = Number(size[1]);
    if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  await load(`samples/${query.get('photo') ?? 'pier'}.jpg`, query.get('caption') ?? 'Sunset Strip');
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
