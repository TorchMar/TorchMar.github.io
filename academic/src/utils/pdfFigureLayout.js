const union = boxes => [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))];
const distance = (a, b) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));

// Geometry is expressed in PDF points and scaled relative to page/font size.
// This is a layout heuristic, not semantic image recognition.
export function findFigureRegions(items, boxes, pageWidth, pageHeight) {
  const lines = [];
  for (const item of items.filter(i => i.str?.trim() && i.transform).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const x = item.transform[4], y = item.transform[5], height = Math.max(6, Math.abs(item.height || item.transform[3]));
    const line = lines.find(l => Math.abs(l.y - y) < height * .25 && x >= l.x && x <= l.right + height * 1.5);
    if (line) { line.text += ` ${item.str}`; line.right = Math.max(line.right, x + item.width); }
    else lines.push({ text: item.str, x, y, right: x + item.width, height });
  }
  const results = [];
  for (const caption of lines.filter(l => /^\s*(?:Figure|Fig\.?)[\s\u00a0]*\d+[a-z]?[\s.:]/i.test(l.text))) {
    const continuation = lines.filter(l => l.y < caption.y && l.y >= caption.y - caption.height * 3 && Math.abs(l.x - caption.x) < caption.height * 2);
    const text = [caption.text, ...continuation.map(l => l.text)].join(' ');
    if (/\b(ablation|accuracy (?:versus|vs|curve)|loss curve|performance comparison|histogram)\b/i.test(text)) continue;
    const gap = Math.max(caption.height * 6, pageHeight * .065);
    const candidates = boxes.filter(b => b.every(Number.isFinite) && b[0] >= 0 && b[1] >= 0 && b[2] <= pageWidth + 1 && b[3] <= pageHeight + 1 && b[2] - b[0] > pageWidth * .035 && b[3] - b[1] > pageHeight * .025
      // Shaded abstract/body panels are vector rectangles too, but not figures.
      && lines.filter(l => l.y > b[1] && l.y < b[3] && l.x >= b[0] && l.right <= b[2] + 2 && l.text.length > 70).length < 3);
    const seed = candidates.filter(b => b[1] > caption.y && b[1] - caption.y < gap && b[2] >= caption.x && b[0] <= caption.right).sort((a, b) => a[1] - b[1])[0];
    if (!seed) continue;
    const group = [seed];
    for (let changed = true; changed;) {
      changed = false;
      for (const box of candidates) {
        if (group.includes(box) || box[1] <= caption.y) continue;
        if (group.some(other => distance(box, other) < caption.height * 2.5)) { group.push(box); changed = true; }
      }
    }
    const box = union(group);
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    if (area < pageWidth * pageHeight * .015 || area > pageWidth * pageHeight * .6) continue;
    // Do not merge panels across intervening body paragraphs.
    if (lines.some(l => l.y > box[1] && l.y < box[3] && l.x >= box[0] && l.right <= box[2] && l.text.length > 160)) continue;
    const score = /architecture|framework|overview|pipeline|workflow|schematic|method|design|illustrat/i.test(text) ? 2 : 1;
    results.push({ box, caption: text, score });
  }
  return results.sort((a, b) => b.score - a.score);
}
