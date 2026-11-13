// Subtract existing coverage rather than stacking translucent rectangles.
export function uncoveredRegions(points, coverage) {
  let regions = [points];
  for (const [[cx1, cy1], [cx2, cy2]] of coverage) {
    regions = regions.flatMap(([[x1, y1], [x2, y2]]) => {
      const left = Math.max(x1, cx1), top = Math.max(y1, cy1);
      const right = Math.min(x2, cx2), bottom = Math.min(y2, cy2);
      if (left >= right || top >= bottom) return [[[x1, y1], [x2, y2]]];
      return [
        [[x1, y1], [x2, top]], [[x1, bottom], [x2, y2]],
        [[x1, top], [left, bottom]], [[right, top], [x2, bottom]],
      ].filter(([[a, b], [c, d]]) => c - a > .01 && d - b > .01);
    });
  }
  return regions;
}
