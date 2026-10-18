/**
 * 地图几何：东亚陆块近似、点面判定、Voronoi 半平面裁剪、邻接距离。
 * 只被 scripts/gen-map.ts 使用，不进入运行时。
 */

import { PLAYABLE_LAND } from './atlas-land';

export type Point = [number, number];
export type Poly = Point[];

export const BOUNDS: Poly = [
  [69, 14],
  [151, 14],
  [151, 56],
  [69, 56],
];

/**
 * 东亚大陆近似轮廓（顺时针）。刻意保留渤海、黄海、朝鲜半岛的凹口，
 * 让海锚点能在 Voronoi 中切出海岸线。
 */
export const MAINLAND: Poly = [
  [70, 55], [73, 54.6], [76, 54.4], [79, 54.7], [82, 54.2], [85, 53.5],
  [88, 53.0], [91, 52.4], [94, 51.8], [97, 51.2], [100, 50.6], [103, 50.2],
  [106, 50.4], [109, 51.0], [112, 51.8], [115, 52.4], [118, 53.0], [121, 53.7],
  [124, 54.4], [127, 54.8], [130, 55], [133, 55], [136, 55], [139, 54.2],
  [141, 53], [144, 51], [146, 49], [150, 46], [146, 44], [142, 43], [138, 43],
  [135, 43], [132, 43], [131, 42], [130, 42], [129, 40], [129, 38], [129, 35],
  [128.5, 34], [127.5, 34], [126.5, 35], [126, 37], [126, 38], [125, 39],
  [124, 40], [122, 40], [121, 39], [120, 38], [119, 37], [120.5, 36.5],
  [122, 37.2], [122.8, 36.4], [121.2, 35.3], [120.5, 34.2], [121.5, 33.5],
  [121, 32.5], [122, 31.5], [121.3, 30.5], [122, 29.5], [121, 28.5],
  [120, 27], [119, 26], [118, 25], [117, 24], [116, 23], [115, 22], [114, 22],
  [113, 22], [112, 21], [111, 21], [110, 21], [109, 21], [108, 21], [107, 21],
  [106, 22], [105, 22], [104, 22], [103, 22], [102, 22], [101, 23], [100, 24],
  [99, 25], [98, 25], [97, 27], [96, 28], [95, 28], [94, 29], [92, 29],
  [90, 30], [88, 30], [86, 31], [84, 31], [82, 32], [80, 32], [78, 34],
  [76, 36], [74, 38], [72, 40], [70, 42], [69.6, 44], [70.3, 46], [69.7, 48],
  [70.4, 50], [69.8, 52], [70.3, 54],
];

export const JAPAN: Poly = [
  [129.4, 31], [130.6, 31.2], [131.6, 33], [133, 34], [134.5, 34.3],
  [136, 35.2], [137.5, 36.2], [139, 37.2], [140.2, 39], [141, 41],
  [141.5, 43], [144.8, 44.2], [145.2, 43.2], [143, 42], [142, 40],
  [141, 38], [139, 37], [137, 36], [135, 35], [133, 34], [132, 33],
  [131, 32], [130, 31],
];

export const TAIWAN: Poly = [
  [120, 22], [121, 22], [122, 24], [121, 25], [120, 25], [119.5, 24],
];

export const HAINAN: Poly = [
  [108.5, 18.5], [110, 18.2], [111, 19.5], [110, 20.2], [108.8, 20],
];

export interface OtherRegion {
  name: string;
  polygon: Poly;
}

/** 玩家不可进入的周边陆块，只作为地图册式背景。 */
export const OTHER_REGIONS: OtherRegion[] = [
  {
    name: '印度',
    polygon: [
      [69, 28], [70, 26], [71, 24], [72, 22], [73, 20], [74, 18], [76, 16],
      [78, 15], [80, 15], [82, 16], [84, 18], [86, 20], [88, 21], [90, 22],
      [92, 22], [92, 14], [69, 14],
    ],
  },
  {
    name: '中南半岛',
    polygon: [
      [92, 22], [94, 23], [96, 24], [98, 23], [100, 22], [102, 20], [104, 18],
      [106, 16], [108, 15], [110, 14], [110, 20], [108, 21], [105, 22], [103, 22],
      [100, 24], [98, 25], [95, 25], [93, 24],
    ],
  },
  {
    name: '西伯利亚',
    polygon: [[69, 55], [151, 55], [151, 56], [69, 56]],
  },
];

export interface SeaLabel {
  name: string;
  lon: number;
  lat: number;
}

export const SEA_LABELS: SeaLabel[] = [
  { name: '渤海', lon: 119.5, lat: 38.8 },
  { name: '黄海', lon: 123.5, lat: 35.5 },
  { name: '东海', lon: 125.5, lat: 29.5 },
  { name: '南海', lon: 114.5, lat: 17.5 },
  { name: '日本海', lon: 135.5, lat: 40.5 },
  { name: '鄂霍次克海', lon: 145.5, lat: 52.0 },
  { name: '孟加拉湾', lon: 88.0, lat: 18.0 },
];


export const LANDMASSES: Poly[] = PLAYABLE_LAND;

export const RIVERS: Point[][] = [
  [[96, 35], [102, 36], [106, 37], [110, 37], [112, 35], [114, 35], [116, 36], [118, 37], [119.5, 37.5]],
  [[98, 29], [102, 29], [105, 29], [108, 30], [111, 30], [114, 30], [117, 30], [119, 31], [121.5, 31.5]],
  [[104, 24], [107, 23], [110, 23], [113, 23], [113.5, 22.5]],
  [[116.5, 39], [117, 37], [117.5, 35], [118, 33], [119, 32], [120.5, 31]],
  [[121, 53], [125, 51], [128, 49], [132, 48], [135, 48]],
  [[126, 45], [127, 47], [129, 47.5]],
];

export function pointInPolygon(point: Point, polygon: Poly): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isLand(point: Point): boolean {
  return LANDMASSES.some(polygon => pointInPolygon(point, polygon));
}

export function clipHalfPlane(poly: Poly, nx: number, ny: number, c: number): Poly {
  const result: Poly = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    const da = a[0] * nx + a[1] * ny - c;
    const db = b[0] * nx + b[1] * ny - c;
    const insideA = da <= 1e-12;
    const insideB = db <= 1e-12;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const denominator = da - db;
      if (Math.abs(denominator) > 1e-15) {
        const t = da / denominator;
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
  }
  return result;
}

export function voronoiCell(anchor: Point, anchors: Point[]): Poly {
  let poly = BOUNDS;
  for (const other of anchors) {
    if (other === anchor) continue;
    const nx = other[0] - anchor[0];
    const ny = other[1] - anchor[1];
    if (Math.abs(nx) < 1e-12 && Math.abs(ny) < 1e-12) continue;
    const mx = (anchor[0] + other[0]) / 2;
    const my = (anchor[1] + other[1]) / 2;
    poly = clipHalfPlane(poly, nx, ny, nx * mx + ny * my);
    if (poly.length < 3) break;
  }
  return poly;
}

export function polygonArea(poly: Poly): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-18) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t));
}

export function polygonDistance(a: Poly, b: Poly): number {
  let min = Number.POSITIVE_INFINITY;
  for (const point of a) {
    for (let i = 0; i < b.length; i += 1) {
      const p = b[i];
      const q = b[(i + 1) % b.length];
      if (!p || !q) continue;
      min = Math.min(min, pointSegmentDistance(point, p, q));
    }
  }
  for (const point of b) {
    for (let i = 0; i < a.length; i += 1) {
      const p = a[i];
      const q = a[(i + 1) % a.length];
      if (!p || !q) continue;
      min = Math.min(min, pointSegmentDistance(point, p, q));
    }
  }
  return min;
}

export function distanceToPolyline(point: Point, line: Point[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    if (!a || !b) continue;
    min = Math.min(min, pointSegmentDistance(point, a, b));
  }
  return min;
}

export function isCoastal(point: Point): boolean {
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const sample: Point = [point[0] + Math.cos(angle) * 0.45, point[1] + Math.sin(angle) * 0.45];
    if (!isLand(sample)) return true;
  }
  return false;
}

export function isRiver(point: Point): boolean {
  return RIVERS.some(line => distanceToPolyline(point, line) < 0.32);
}

/** 0.45° 三角网格上的陆地点，作为省锚点候选。 */
export function landCandidates(spacing = 0.45): Point[] {
  const points: Point[] = [];
  const latStep = spacing * 0.8660254037844386;
  let row = 0;
  for (let lat = 14 + spacing * 0.5; lat <= 56; lat += latStep, row += 1) {
    const offset = row % 2 === 0 ? 0 : spacing / 2;
    for (let lon = 69 + offset; lon <= 151; lon += spacing) {
      const point: Point = [Number(lon.toFixed(3)), Number(lat.toFixed(3))];
      if (isLand(point)) points.push(point);
    }
  }
  return points;
}
