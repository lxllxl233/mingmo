import { Application, Container, Graphics, Point, Text, TextStyle } from 'pixi.js';
import type { ContentIndex, MapGeo } from '../../content/types';
import type { ArmyState, GameState } from '../../engine/state/types';
import { relationKey } from '../../engine/state/types';
import { areAtWar } from '../../engine/rules/war';

type SelectProvinceHandler = (provinceId: string) => void;
type SelectArmyHandler = (armyId: string) => void;
type SelectArmyStackHandler = (armyIds: string[]) => void;
type ContextProvinceHandler = (provinceId: string, ctrlKey: boolean) => void;
type SelectBattleHandler = (battleId: string) => void;
export type MapMode = 'normal' | 'estates' | 'finance' | 'military' | 'diplomacy' | 'core';

const ESTATE_COLORS: Record<string, number> = {
  nobles: 0xb8892e,
  officials: 0x3f6f9a,
  gentry: 0x5f7d4a,
  merchants: 0xc46a2b,
  peasants: 0x9a7b4f,
  soldiers: 0xa33a32,
  clergy: 0x6b4a86,
  scholars: 0x3f7f7a,
  natives: 0x6f7a6a,
};

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

interface EdgeRecord {
  a: string;
  b: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ArmyMarker {
  container: Container;
  body: Graphics;
  bars: Graphics;
  selection: Graphics;
  label: Text;
  labelBg: Graphics;
  stackScale: number;
  armyId: string;
  armyIds: string[];
  targetX: number;
  targetY: number;
  positioned: boolean;
}

const TERRAIN_TINT: Record<string, { color: number; alpha: number }> = {
  plains: { color: 0x8a9a5a, alpha: 0.05 },
  hills: { color: 0x8a7444, alpha: 0.12 },
  mountains: { color: 0x665748, alpha: 0.2 },
  wetland: { color: 0x3f6f6a, alpha: 0.16 },
  desert: { color: 0xc8a45a, alpha: 0.2 },
  steppe: { color: 0xa3a05a, alpha: 0.14 },
  jungle: { color: 0x2f6b3a, alpha: 0.18 },
  urban: { color: 0x7a6a58, alpha: 0.06 },
};

const MAJOR_CITIES = new Set([
  'beijing', 'nanjing', 'xian', 'shenyang', 'suzhou', 'hangzhou', 'wuchang',
  'chengdu', 'chongqing', 'guangzhou', 'fuzhou', 'quanzhou', 'kaifeng',
  'taiyuan', 'datong', 'shanhaiguan', 'ningyuan', 'jinzhou', 'liaoyang',
  'hanseong', 'edo', 'lhasa', 'albazin', 'anping', 'penghu',
]);

const FACTION_MARKS: Record<string, string> = {
  MING: '明',
  QING: '清',
  SHUN: '顺',
  XI: '西',
  SMING: '南',
  ZHENG: '郑',
  MONGOL: '蒙',
  JOSEON: '朝',
  JAPAN: '日',
  TIBET: '藏',
  VOC: '荷',
  RUSSIA: '俄',
  NEU: '藩',
};

const PAPER = 0xf2ead8;
const INK = 0x1f1c18;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function colorLuma(color: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function pointInPolygon(x: number, y: number, points: number[]): boolean {
  let inside = false;
  const count = points.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i, i += 1) {
    const xi = points[i * 2] ?? 0;
    const yi = points[i * 2 + 1] ?? 0;
    const xj = points[j * 2] ?? 0;
    const yj = points[j * 2 + 1] ?? 0;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function edgeKey(x1: number, y1: number, x2: number, y2: number): string {
  const ax = Math.round(x1 * 10000) / 10000;
  const ay = Math.round(y1 * 10000) / 10000;
  const bx = Math.round(x2 * 10000) / 10000;
  const by = Math.round(y2 * 10000) / 10000;
  if (ax < bx || (ax === bx && ay < by)) return `${ax},${ay}|${bx},${by}`;
  return `${bx},${by}|${ax},${ay}`;
}

export class MapRenderer {
  private app: Application | null = null;
  private world = new Container();
  private otherLayer = new Graphics();
  private seaLabelLayer = new Container();
  private otherLabelLayer = new Container();
  private landLayer = new Graphics();
  private shadowLayer = new Graphics();
  private fillLayer = new Graphics();
  private occupiedLayer = new Graphics();
  private terrainLayer = new Graphics();
  private terrainSymbolLayer = new Container();
  private terrainSymbols: Graphics[] = [];
  private terrainDetailLayer = new Graphics();
  private deployLayer = new Graphics();
  private deploymentKind: 'land' | 'navy' | null = null;
  private deploymentTag: string | null = null;
  private selectionLayer = new Graphics();
  private provinceBorderLayer = new Graphics();
  private prefectureBorderLayer = new Graphics();
  private countryBorderLayer = new Graphics();
  private seaRouteLayer = new Graphics();
  private trailLayer = new Graphics();
  private attackCanvas: HTMLCanvasElement | null = null;
  private hoverLayer = new Graphics();
  private cityLayer = new Graphics();
  private portLayer = new Graphics();
  private portLabelLayer = new Container();
  private countryLabelLayer = new Container();
  private provinceLabelLayer = new Container();
  private localLabelLayer = new Container();
  private provinceLabels = new Map<Text, number>();
  private localLabels = new Map<Text, number>();
  private provinceLabelArea = new Map<Text, number>();
  private localLabelArea = new Map<Text, number>();
  private localLabelsDrawn = false;
  private armyLayer = new Container();
  private battleLayer = new Container();
  private battleMarkers = new Map<string, Container>();
  private occupationLayer = new Container();
  private occupationMarkers = new Map<string, Container>();
  private projected = new Map<string, number[]>();
  private centroids = new Map<string, { x: number; y: number }>();
  private edges: EdgeRecord[] = [];
  private countryLabels = new Map<string, Text>();
  private smallLabels = new Set<Text>();
  private portLabels = new Set<Text>();
  private labelBaseScale = new Map<Text, number>();
  private armyMarkers = new Map<string, ArmyMarker>();
  private state: GameState | null = null;
  private selectedProvince: string | null = null;
  private selectedArmy: string | null = null;
  private hoveredProvince: string | null = null;
  private diplomaticAnchor: string | null = null;
  private mapMode: MapMode = 'normal';
  private fitScale = 1;
  private ownerSignature = '';
  private hasDrawn = false;
  private dragging = false;
  private rightSelectStart: { x: number; y: number } | null = null;
  private rightSelectMoved = false;
  private rightSelectBox = new Graphics();
  private suppressContextUntil = 0;
  private moved = false;
  private lastPointer = { x: 0, y: 0 };
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private contextHandler: ((event: MouseEvent) => void) | null = null;
  private destroyed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly geo: MapGeo,
    private readonly content: ContentIndex,
    private readonly onSelectProvince: SelectProvinceHandler,
    private readonly onSelectArmy: SelectArmyHandler,
    private readonly onSelectArmyStack: SelectArmyStackHandler,
    private readonly onContextProvince: ContextProvinceHandler,
    private readonly onSelectBattle: SelectBattleHandler,
  ) {}

  async init(): Promise<void> {
    const app = new Application();
    await app.init({
      background: 0xd6ded5,
      resizeTo: this.host,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    if (this.destroyed) {
      app.destroy(true, { children: true });
      return;
    }
    this.app = app;
    this.host.appendChild(app.canvas);
    this.attackCanvas = document.createElement('canvas');
    this.attackCanvas.style.position = 'absolute';
    this.attackCanvas.style.inset = '0';
    this.attackCanvas.style.width = '100%';
    this.attackCanvas.style.height = '100%';
    this.attackCanvas.style.pointerEvents = 'none';
    this.attackCanvas.style.zIndex = '4';
    this.host.appendChild(this.attackCanvas);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.armyLayer.sortableChildren = true;
    this.world.addChild(
      this.otherLayer,
      this.seaLabelLayer,
      this.otherLabelLayer,
      this.landLayer,
      this.shadowLayer,
      this.fillLayer,
      this.terrainLayer,
      this.terrainSymbolLayer,
      this.terrainDetailLayer,
      this.occupiedLayer,
      this.deployLayer,
      this.provinceBorderLayer,
      this.prefectureBorderLayer,
      this.countryBorderLayer,
      this.seaRouteLayer,
      this.selectionLayer,
      this.hoverLayer,
      this.cityLayer,
      this.portLayer,
      this.provinceLabelLayer,
      this.localLabelLayer,
      this.countryLabelLayer,
      this.portLabelLayer,
      this.trailLayer,
      this.armyLayer,
      this.occupationLayer,
      this.battleLayer,
    );
    app.stage.addChild(this.world);
    this.prepareGeometry();
    this.drawOtherRegions();
    this.drawLandBase();
    this.drawTerrain();
    this.drawSeaRoutes();
    this.drawPorts();
    this.fit();
    this.bindPointer();
    app.stage.addChild(this.rightSelectBox);
    this.rightSelectBox.eventMode = 'none';
    app.ticker.add(() => this.animateArmyMarkers());
  }

  private animateArmyMarkers(): void {
    for (const marker of this.armyMarkers.values()) {
      if (!marker.positioned) continue;
      marker.container.position.x += (marker.targetX - marker.container.position.x) * 0.16;
      marker.container.position.y += (marker.targetY - marker.container.position.y) * 0.16;
    }
  }

  private drawLandBase(): void {
    this.landLayer.clear();
    const japanColor = this.colorOf('JAPAN');
    for (const polygon of this.geo.land) {
      const points: number[] = [];
      let lonSum = 0;
      let latSum = 0;
      for (const [lon, lat] of polygon) {
        const point = this.projectPoint(lon, lat);
        points.push(point.x, point.y);
        lonSum += lon;
        latSum += lat;
      }
      if (points.length < 6) continue;
      const count = points.length / 2;
      const avgLon = lonSum / count;
      const avgLat = latSum / count;
      const japan = avgLon >= 129 && avgLon <= 146 && avgLat >= 30 && avgLat <= 46;
      this.landLayer.poly(points)
        .fill({ color: japan ? japanColor : 0xd8d0bd, alpha: japan ? 0.72 : 1 })
        .stroke({ width: 0.05, color: japan ? 0x3a2a4a : 0x9a8f7a, alpha: 0.6 });
    }
  }

  private projectPoint(lon: number, lat: number): { x: number; y: number } {
    const minLon = this.geo.bounds[0];
    const maxLat = this.geo.bounds[3];
    return { x: lon - minLon, y: maxLat - lat };
  }

  private drawOtherRegions(): void {
    this.otherLayer.clear();
    for (const region of this.geo.otherRegions) {      const points: number[] = [];
      let x = 0;
      let y = 0;
      for (const [lon, lat] of region.points) {
        const projected = this.projectPoint(lon, lat);
        points.push(projected.x, projected.y);
        x += projected.x;
        y += projected.y;
      }
      if (points.length < 6) continue;
      this.otherLayer.poly(points)
        .fill({ color: 0xf2efe6, alpha: 1 })
        .stroke({ width: 0.09, color: 0xb8b2a4, alpha: 0.9 });
      const text = new Text({
        text: region.name,
        style: new TextStyle({
          fontFamily: '"Noto Serif SC", "Songti SC", serif',
          fontSize: 48,
          fill: 0x6f6a60,
          letterSpacing: 4,
        }),
      });
      text.anchor.set(0.5);
      text.scale.set(0.9 / 48);
      text.position.set(x / (points.length / 2), y / (points.length / 2));
      text.alpha = 0.7;
      text.eventMode = 'none';
      this.otherLabelLayer.addChild(text);
    }

    for (const sea of this.geo.seaLabels) {
      const point = this.projectPoint(sea.lon, sea.lat);
      const text = new Text({
        text: sea.name,
        style: new TextStyle({
          fontFamily: '"Noto Serif SC", "Songti SC", serif',
          fontStyle: 'italic',
          fontSize: 48,
          fill: 0x6d8183,
          letterSpacing: 5,
        }),
      });
      text.anchor.set(0.5);
      text.scale.set(0.9 / 48);
      text.position.set(point.x, point.y);
      text.alpha = 0.5;
      text.eventMode = 'none';
      this.seaLabelLayer.addChild(text);
    }
  }

  private drawTerrain(): void {
    this.terrainLayer.clear();
    this.terrainSymbolLayer.removeChildren();
    for (const symbol of this.terrainSymbols) symbol.destroy();
    this.terrainSymbols = [];
    for (const [id, points] of this.projected) {
      const terrain = this.content.provinces.get(id)?.terrain ?? 'plains';
      const tint = TERRAIN_TINT[terrain] ?? TERRAIN_TINT.plains;
      if (tint) this.terrainLayer.poly(points).fill({ color: tint.color, alpha: tint.alpha });
      const centroid = this.centroids.get(id);
      if (centroid) {
        const symbol = new Graphics();
        this.drawTerrainSymbol(symbol, 0, 0, terrain);
        symbol.position.set(centroid.x, centroid.y);
        this.terrainSymbols.push(symbol);
        this.terrainSymbolLayer.addChild(symbol);
      }
    }
    this.updateTerrainScale();
    this.drawTerrainDetail();
  }

  private updateTerrainScale(): void {
    const scale = this.world.scale.x || 1;
    const targetPixels = 6 + Math.min(10, scale / 20);
    const symbolScale = targetPixels / (0.55 * scale);
    for (const symbol of this.terrainSymbols) symbol.scale.set(symbolScale);
  }

  private drawTerrainDetail(): void {
    this.terrainDetailLayer.clear();
    const scale = this.world.scale.x;
    if (scale < 30) return;
    const count = Math.min(30, Math.max(2, Math.floor(scale / 10)));
    const size = 12 / scale;
    for (const [id, points] of this.projected) {
      const terrain = this.content.provinces.get(id)?.terrain ?? 'plains';
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < points.length; i += 2) {
        const x = points[i] ?? 0;
        const y = points[i + 1] ?? 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) continue;
      for (let index = 0; index < count; index += 1) {
        const seed = hashString(`${id}:${index}`);
        const x = minX + ((seed & 0xffff) / 0xffff) * (maxX - minX);
        const y = minY + (((seed >>> 16) & 0xffff) / 0xffff) * (maxY - minY);
        if (!pointInPolygon(x, y, points)) continue;
        this.drawTerrainDetailMark(x, y, terrain, size);
      }
    }
  }

  private drawTerrainDetailMark(x: number, y: number, terrain: string, size: number): void {
    const g = this.terrainDetailLayer;
    if (terrain === 'mountains') {
      for (const scale of [0.62, 1, 1.38]) {
        g.moveTo(x - size * scale, y + size * 0.55 * scale)
          .lineTo(x, y - size * 0.55 * scale)
          .lineTo(x + size * scale, y + size * 0.55 * scale)
          .stroke({ width: Math.max(0.02, size * 0.13), color: 0x3a3226, alpha: 0.3 });
      }
      return;
    }
    if (terrain === 'hills') {
      g.poly([x - size, y + size * 0.5, x, y - size * 0.4, x + size, y + size * 0.5])
        .fill({ color: 0x5a4a32, alpha: 0.24 });
      g.moveTo(x - size * 0.55, y + size * 0.22)
        .lineTo(x + size * 0.2, y + size * 0.22)
        .stroke({ width: Math.max(0.02, size * 0.1), color: 0x5a4a32, alpha: 0.2 });
      return;
    }
    if (terrain === 'jungle' || terrain === 'steppe') {
      for (const offset of [-0.4, 0, 0.4]) {
        g.circle(x + size * offset, y - size * 0.1, size * 0.28)
          .fill({ color: terrain === 'jungle' ? 0x2f5b32 : 0x77703a, alpha: 0.25 });
      }
      g.moveTo(x, y + size * 0.2).lineTo(x, y + size * 0.7)
        .stroke({ width: Math.max(0.02, size * 0.13), color: 0x3a3226, alpha: 0.25 });
      return;
    }
    if (terrain === 'desert') {
      g.moveTo(x - size, y).lineTo(x + size, y)
        .stroke({ width: Math.max(0.02, size * 0.12), color: 0x9a7430, alpha: 0.26 });
      return;
    }
    if (terrain === 'wetland') {
      g.moveTo(x - size * 0.7, y - size * 0.12).lineTo(x + size * 0.7, y - size * 0.12)
        .stroke({ width: Math.max(0.02, size * 0.12), color: 0x3f6f6a, alpha: 0.3 });
      g.moveTo(x - size * 0.45, y + size * 0.3).lineTo(x + size * 0.55, y + size * 0.3)
        .stroke({ width: Math.max(0.02, size * 0.12), color: 0x3f6f6a, alpha: 0.24 });
      return;
    }
    g.moveTo(x - size * 0.7, y + size * 0.25).lineTo(x + size * 0.5, y + size * 0.25)
      .stroke({ width: Math.max(0.02, size * 0.1), color: 0x5f6b3a, alpha: 0.22 });
  }

  private drawSeaRoutes(): void {
    this.seaRouteLayer.clear();
    const factor = this.lineFactor();
    for (const route of this.geo.seaRoutes) {
      const from = this.centroids.get(route.from);
      const to = this.centroids.get(route.to);
      if (!from || !to) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.2) continue;
      const dash = 0.32 * factor;
      const gap = 0.24 * factor;
      for (let offset = 0; offset < length; offset += dash + gap) {
        const start = offset / length;
        const end = Math.min(length, offset + dash) / length;
        this.seaRouteLayer.moveTo(from.x + dx * start, from.y + dy * start)
          .lineTo(from.x + dx * end, from.y + dy * end)
          .stroke({ width: 0.09 * factor, color: 0x3f6f8a, alpha: 0.8 });
      }
    }
  }

  private drawPorts(): void {
    this.portLayer.clear();
    for (const label of this.portLabels) label.destroy();
    this.portLabels.clear();
    this.portLabelLayer.removeChildren();
    for (const [id, centroid] of this.centroids) {
      const def = this.content.provinces.get(id);
      if (!def?.isPort) continue;
      this.portLayer.circle(centroid.x, centroid.y, 0.25)
        .fill({ color: 0xf2ead8, alpha: 0.8 })
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 0.95 });
      this.portLayer.circle(centroid.x, centroid.y - 0.18, 0.07)
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 1 });
      this.portLayer.moveTo(centroid.x, centroid.y - 0.11)
        .lineTo(centroid.x, centroid.y + 0.17)
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 1 });
      this.portLayer.moveTo(centroid.x - 0.17, centroid.y + 0.02)
        .lineTo(centroid.x + 0.17, centroid.y + 0.02)
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 1 });
      this.portLayer.moveTo(centroid.x - 0.17, centroid.y + 0.02)
        .lineTo(centroid.x - 0.24, centroid.y + 0.13)
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 1 });
      this.portLayer.moveTo(centroid.x + 0.17, centroid.y + 0.02)
        .lineTo(centroid.x + 0.24, centroid.y + 0.13)
        .stroke({ width: 0.05, color: 0x2b4a6f, alpha: 1 });
      const text = new Text({
        text: '港',
        style: new TextStyle({ fontFamily: 'serif', fontSize: 48, fill: 0x2b4a6f }),
      });
      text.anchor.set(0.5);
      text.scale.set(0.5 / 48);
      text.position.set(centroid.x + 0.35, centroid.y - 0.3);
      text.visible = this.world.scale.x >= 13.5;
      text.eventMode = 'none';
      this.portLabelLayer.addChild(text);
      this.portLabels.add(text);
    }
  }

  private drawTerrainSymbol(target: Graphics, x: number, y: number, terrain: string): void {
    const ink = 0x4a4034;
    const green = 0x3f6b3a;
    const lake = 0x3f6f6a;
    if (terrain === 'mountains') {
      for (const offset of [-0.42, 0, 0.42]) {
        target.poly([x + offset - 0.28, y + 0.24, x + offset, y - 0.28, x + offset + 0.28, y + 0.24])
          .fill({ color: ink, alpha: 0.32 });
      }
      return;
    }
    if (terrain === 'hills') {
      for (const offset of [-0.3, 0.3]) {
        target.poly([
          x + offset - 0.28, y + 0.18,
          x + offset - 0.14, y - 0.12,
          x + offset + 0.02, y + 0.18,
        ]).fill({ color: 0x6b5a3a, alpha: 0.28 });
      }
      return;
    }
    if (terrain === 'desert') {
      target.rect(x - 0.38, y + 0.04, 0.38, 0.05).fill({ color: 0x9e7a3a, alpha: 0.4 });
      target.rect(x + 0.02, y + 0.18, 0.36, 0.05).fill({ color: 0x9e7a3a, alpha: 0.35 });
      target.circle(x + 0.28, y - 0.08, 0.04).fill({ color: 0x9e7a3a, alpha: 0.4 });
      return;
    }
    if (terrain === 'wetland') {
      for (const offset of [-0.22, 0.04, 0.28]) {
        target.rect(x - 0.36, y + offset, 0.72, 0.045).fill({ color: lake, alpha: 0.4 });
      }
      return;
    }
    if (terrain === 'jungle' || terrain === 'steppe') {
      const color = terrain === 'jungle' ? green : 0x8a843a;
      for (const offset of [-0.34, 0, 0.34]) {
        target.poly([x + offset - 0.18, y + 0.18, x + offset, y - 0.18, x + offset + 0.18, y + 0.18])
          .fill({ color, alpha: 0.32 });
        target.rect(x + offset - 0.03, y + 0.16, 0.06, 0.16).fill({ color: ink, alpha: 0.3 });
      }
      return;
    }
    if (terrain === 'plains') {
      target.rect(x - 0.3, y + 0.06, 0.36, 0.04).fill({ color: 0x6b7a42, alpha: 0.26 });
      target.rect(x + 0.04, y + 0.2, 0.3, 0.04).fill({ color: 0x6b7a42, alpha: 0.22 });
    }
  }

  private prepareGeometry(): void {
    const [minLon, , , maxLat] = this.geo.bounds;
    const edgeMap = new Map<string, EdgeRecord>();

    for (const [id, points] of Object.entries(this.geo.provinces)) {
      const flat: number[] = [];
      let sx = 0;
      let sy = 0;
      for (const [lon, lat] of points) {
        const x = lon - minLon;
        const y = maxLat - lat;
        flat.push(x, y);
        sx += x;
        sy += y;
      }
      this.projected.set(id, flat);
      const count = points.length || 1;
      this.centroids.set(id, interiorPoint(flat, sx / count, sy / count));

      const countPoints = flat.length / 2;
      for (let i = 0; i < countPoints; i += 1) {
        const j = (i + 1) % countPoints;
        const x1 = flat[i * 2] ?? 0;
        const y1 = flat[i * 2 + 1] ?? 0;
        const x2 = flat[j * 2] ?? 0;
        const y2 = flat[j * 2 + 1] ?? 0;
        const key = edgeKey(x1, y1, x2, y2);
        const existing = edgeMap.get(key);
        if (existing) {
          if (existing.b === null) existing.b = id;
        } else {
          edgeMap.set(key, { a: id, b: null, x1, y1, x2, y2 });
        }
      }
    }
    this.edges = [...edgeMap.values()];
    const findProvinceAt = (x: number, y: number, exclude: string): string | null => {
      for (const [id, polygon] of this.projected) {
        if (id === exclude) continue;
        if (pointInPolygon(x, y, polygon)) return id;
      }
      return null;
    };
    for (const edge of this.edges) {
      if (edge.b !== null) continue;
      const dx = edge.x2 - edge.x1;
      const dy = edge.y2 - edge.y1;
      const length = Math.hypot(dx, dy) || 1;
      const mx = (edge.x1 + edge.x2) / 2;
      const my = (edge.y1 + edge.y2) / 2;
      const ox = (-dy / length) * 0.1;
      const oy = (dx / length) * 0.1;
      const neighbor = findProvinceAt(mx + ox, my + oy, edge.a)
        ?? findProvinceAt(mx - ox, my - oy, edge.a);
      if (neighbor) edge.b = neighbor;
    }
  }

  private mapWidth(): number {
    return this.geo.bounds[2] - this.geo.bounds[0];
  }

  private mapHeight(): number {
    return this.geo.bounds[3] - this.geo.bounds[1];
  }

  fit(): void {
    if (!this.app) return;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const scale = Math.min(width / this.mapWidth(), height / this.mapHeight()) * 0.94;
    this.fitScale = scale;
    this.world.scale.set(scale);
    this.world.position.set(
      (width - this.mapWidth() * scale) / 2,
      (height - this.mapHeight() * scale) / 2,
    );
    this.clampWorld();
    this.updateZoomScales();
    this.drawTerrainDetail();
    if (this.state) this.drawArmyTrails();
  }

  private clampWorld(): void {
    if (!this.app) return;
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const scale = this.world.scale.x;
    const mapWidth = this.mapWidth() * scale;
    const mapHeight = this.mapHeight() * scale;
    if (mapWidth <= width) {
      this.world.position.x = (width - mapWidth) / 2;
    } else {
      this.world.position.x = Math.min(0, Math.max(width - mapWidth, this.world.position.x));
    }
    if (mapHeight <= height) {
      this.world.position.y = (height - mapHeight) / 2;
    } else {
      this.world.position.y = Math.min(0, Math.max(height - mapHeight, this.world.position.y));
    }
  }

  private lineFactor(): number {
    return Math.max(0.035, 16 / this.world.scale.x);
  }

  private updateZoomScales(): void {
    const scale = this.world.scale.x;
    const zoomT = Math.max(0, Math.min(1, (scale - 4) / 80));
    const markerPixels = 16 + zoomT * 10;
    const markerScale = markerPixels / Math.max(0.001, scale);
    for (const marker of this.armyMarkers.values()) {
      marker.container.scale.set(markerScale * marker.stackScale);
      const showLabel = zoomT > 0.04 || marker.container.zIndex >= 10;
      marker.label.visible = showLabel;
      marker.labelBg.visible = showLabel;
    }
    const bubbleScale = (0.82 + zoomT * 0.25) / Math.max(0.001, scale);
    for (const marker of this.battleMarkers.values()) {
      marker.scale.set(bubbleScale);
    }
    for (const marker of this.occupationMarkers.values()) {
      marker.scale.set(bubbleScale);
    }
    const labelScale = Math.min(1, 18 / scale);
    for (const [label, base] of this.labelBaseScale) {
      label.scale.set(base * labelScale);
    }
    for (const label of this.smallLabels) {
      label.visible = scale >= 13.5;
    }
    for (const label of this.portLabels) {
      label.visible = scale >= 13.5 && scale < 60;
    }
    if (scale >= 120) this.ensureLocalLabels();
    this.updateProvinceLabelScales();
    this.portLayer.visible = scale < 60;
    this.cityLayer.visible = scale < 80;
    this.updateTerrainScale();
    this.landLayer.visible = scale < 80;
    this.shadowLayer.visible = scale < 40;
    this.otherLayer.visible = scale < 60;
    this.otherLabelLayer.visible = scale < 60;
    this.seaLabelLayer.visible = scale < 50;
  }

  private bindPointer(): void {
    const app = this.app;
    if (!app) return;
    const stage = app.stage;
    stage.on('pointerdown', (event) => {
      if (event.button === 2) {
        this.rightSelectStart = { x: event.global.x, y: event.global.y };
        this.rightSelectMoved = false;
        this.rightSelectBox.clear();
        return;
      }
      this.dragging = true;
      this.moved = false;
      this.lastPointer = { x: event.global.x, y: event.global.y };
    });
    stage.on('pointermove', (event) => {
      if (this.rightSelectStart) {
        const dx = event.global.x - this.rightSelectStart.x;
        const dy = event.global.y - this.rightSelectStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) this.rightSelectMoved = true;
        if (this.rightSelectMoved) {
          this.rightSelectBox.clear();
          this.rightSelectBox.rect(
            Math.min(this.rightSelectStart.x, event.global.x),
            Math.min(this.rightSelectStart.y, event.global.y),
            Math.abs(dx),
            Math.abs(dy),
          ).fill({ color: 0x1f1c18, alpha: 0.08 })
            .stroke({ width: 1.2, color: 0x9e2b25, alpha: 0.95 });
        }
        return;
      }
      if (!this.dragging) {
        this.updateHover(event.global.x, event.global.y);
        return;
      }
      const dx = event.global.x - this.lastPointer.x;
      const dy = event.global.y - this.lastPointer.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
      this.world.position.x += dx;
      this.world.position.y += dy;
      this.clampWorld();
      this.drawAttackOverlay();
      this.lastPointer = { x: event.global.x, y: event.global.y };
    });
    stage.on('pointerup', (event) => {
      if (event.button === 2 || this.rightSelectStart) {
        this.finishRightSelection(event.global.x, event.global.y, event.ctrlKey);
        return;
      }
      this.dragging = false;
      if (!this.moved) this.pick(event.global.x, event.global.y);
    });
    stage.on('pointerupoutside', () => {
      this.dragging = false;
      this.rightSelectStart = null;
      this.rightSelectBox.clear();
    });

    this.wheelHandler = (event: WheelEvent) => {
      event.preventDefault();
      if (!this.app) return;
      const rect = this.app.canvas.getBoundingClientRect();
      const scaleX = this.app.screen.width / rect.width;
      const scaleY = this.app.screen.height / rect.height;
      const px = (event.clientX - rect.left) * scaleX;
      const py = (event.clientY - rect.top) * scaleY;
      const before = this.world.toLocal(new Point(px, py));
      const factor = event.deltaY < 0 ? 1.35 : 1 / 1.35;
      const nextScale = Math.max(this.fitScale, Math.min(260, this.world.scale.x * factor));
      this.world.scale.set(nextScale);
      const after = this.world.toLocal(new Point(px, py));
      this.world.position.x += (after.x - before.x) * nextScale;
      this.world.position.y += (after.y - before.y) * nextScale;
      this.clampWorld();
      this.updateZoomScales();
      this.drawBorders();
      this.drawSelection();
      this.drawHover();
      this.drawSeaRoutes();
      this.drawTerrainDetail();
      this.drawArmyTrails();
    };
    app.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    this.contextHandler = (event: MouseEvent) => {
      event.preventDefault();
      if (!this.app) return;
      const rect = this.app.canvas.getBoundingClientRect();
      const scaleX = this.app.screen.width / rect.width;
      const scaleY = this.app.screen.height / rect.height;
      const screenX = (event.clientX - rect.left) * scaleX;
      const screenY = (event.clientY - rect.top) * scaleY;
      if (this.rightSelectStart && !this.rightSelectMoved) {
        this.finishRightSelection(screenX, screenY, event.ctrlKey);
        return;
      }
      if (this.rightSelectStart || performance.now() < this.suppressContextUntil) return;
      const province = this.provinceAt(screenX, screenY);
      if (province) this.onContextProvince(province, event.ctrlKey);
    };
    app.canvas.addEventListener('contextmenu', this.contextHandler);
    app.renderer.on('resize', () => this.fit());
  }

  private finishRightSelection(screenX: number, screenY: number, ctrlKey: boolean): void {
    const start = this.rightSelectStart;
    this.rightSelectStart = null;
    this.rightSelectBox.clear();
    this.suppressContextUntil = performance.now() + 250;
    this.dragging = false;
    this.moved = true;
    if (!start) return;
    if (!this.rightSelectMoved) {
      const province = this.provinceAt(screenX, screenY);
      if (province) this.onContextProvince(province, ctrlKey);
      return;
    }
    const minX = Math.min(start.x, screenX);
    const maxX = Math.max(start.x, screenX);
    const minY = Math.min(start.y, screenY);
    const maxY = Math.max(start.y, screenY);
    const selected: string[] = [];
    if (this.state) {
      for (const army of Object.values(this.state.armies)) {
        if (!this.state.spectator && army.tag !== this.state.playerTag) continue;
        const centroid = this.centroids.get(army.province);
        if (!centroid) continue;
        const screen = this.world.toGlobal(new Point(centroid.x, centroid.y));
        if (screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY) {
          selected.push(army.id);
        }
      }
    }
    if (selected.length === 1) this.onSelectArmy(selected[0]!);
    else if (selected.length > 1) this.onSelectArmyStack(selected);
  }

  private provinceAt(screenX: number, screenY: number): string | null {
    if (!this.app) return null;
    const local = this.world.toLocal(new Point(screenX, screenY));
    for (const [id, points] of this.projected) {
      if (pointInPolygon(local.x, local.y, points)) return id;
    }
    return null;
  }

  private pick(screenX: number, screenY: number): void {
    const province = this.provinceAt(screenX, screenY);
    if (province) this.onSelectProvince(province);
  }

  private updateHover(screenX: number, screenY: number): void {
    const province = this.provinceAt(screenX, screenY);
    if (province === this.hoveredProvince) return;
    this.hoveredProvince = province;
    this.drawHover();
  }

  private colorOf(tag: string): number {
    const color = this.content.countries.get(tag)?.color ?? '#7a7468';
    return hexToNumber(color);
  }

  private fillColor(tag: string, provinceId: string): number {
    if (this.mapMode === 'estates') {
      const estate = this.content.provinces.get(provinceId)?.dominantEstate;
      return ESTATE_COLORS[estate ?? ''] ?? 0x8a8578;
    }
    if (this.mapMode === 'finance') {
      const development = this.content.provinces.get(provinceId)?.development ?? 0;
      const t = Math.max(0, Math.min(1, development / 100));
      return lerpColor(0xa33a32, 0xd4b25a, t);
    }
    if (this.mapMode === 'military' && this.state) {
      const armiesHere = Object.values(this.state.armies).filter(army => army.province === provinceId);
      if (armiesHere.some(army => army.tag !== this.state?.playerTag && areAtWar(this.state!, army.tag, this.state!.playerTag))) {
        return 0xa33a32;
      }
      if (armiesHere.some(army => army.tag === this.state?.playerTag)) return 0x3f6f9a;
      const province = this.state.provinces[provinceId];
      if (province?.controller === this.state.playerTag) return 0x4f7088;
      if (province && areAtWar(this.state, this.state.playerTag, province.controller)) return 0x7a3a34;
      return 0x8a8578;
    }
    if (this.mapMode === 'core' && this.state) {
      const province = this.state.provinces[provinceId];
      if (!province) return 0x8a8578;
      if (province.controller !== this.state.playerTag) return 0x9a9384;
      return province.cores.includes(this.state.playerTag) ? 0x6f8a5a : 0xb0603f;
    }
    if (this.mapMode !== 'diplomacy' || !this.state) return this.colorOf(tag);
    const anchor = this.diplomaticAnchor ?? this.state.playerTag;
    if (tag === anchor) return 0xe0c26a;
    if (areAtWar(this.state, anchor, tag)) return 0xa33a32;
    const relation = this.state.relations[relationKey(anchor, tag)] ?? 0;
    if (relation >= 20) return 0x3f6f9a;
    return 0x8a8578;
  }

  setMapMode(mode: MapMode, anchor: string | null): void {    const nextAnchor = mode === 'diplomacy' ? anchor ?? this.state?.playerTag ?? null : null;
    if (this.mapMode === mode && this.diplomaticAnchor === nextAnchor) return;
    this.mapMode = mode;
    this.diplomaticAnchor = nextAnchor;
    this.ownerSignature = '';
    if (this.state) this.redrawMap();
  }

  setDeploymentTargets(kind: 'land' | 'navy' | null, tag: string | null): void {
    if (this.deploymentKind === kind && this.deploymentTag === tag) return;
    this.deploymentKind = kind;
    this.deploymentTag = tag;
    this.drawDeploymentTargets();
  }

  private drawDeploymentTargets(): void {
    this.deployLayer.clear();
    if (!this.state || !this.deploymentKind || !this.deploymentTag) return;
    for (const [id, points] of this.projected) {
      const province = this.state.provinces[id];
      const def = this.content.provinces.get(id);
      if (!province || !def) continue;
      if (province.controller !== this.deploymentTag) continue;
      if (this.deploymentKind === 'navy' && !def.isPort) continue;
      this.deployLayer.poly(points)
        .fill({ color: 0x3f9a62, alpha: 0.36 })
        .stroke({ width: Math.max(0.04, 0.9 / this.world.scale.x), color: 0x1e6b3a, alpha: 0.85 });
    }
  }

  setState(state: GameState, selectedProvince: string | null, selectedArmy: string | null): void {
    this.state = state;
    this.selectedProvince = selectedProvince;
    this.selectedArmy = selectedArmy;
    const signature = Object.values(state.provinces)
      .map(province => `${province.id}:${province.controller}:${province.owner}`)
      .join('|');
    if (signature !== this.ownerSignature || !this.hasDrawn) {
      this.ownerSignature = signature;
      this.redrawMap();
    } else {
      this.drawSelection();
      this.updateArmies();
      this.drawArmyTrails();
      this.updateBattles();
      this.updateOccupationBubbles();
      this.updateZoomScales();
    }
  }

  private redrawMap(): void {
    if (!this.state || this.projected.size === 0) return;
    this.shadowLayer.clear();
    this.fillLayer.clear();
    this.occupiedLayer.clear();
    for (const [id, points] of this.projected) {
      const province = this.state.provinces[id];
      const color = this.fillColor(province?.controller ?? 'NEU', id);
      this.shadowLayer.poly(points.map((value, index) => value + (index % 2 === 0 ? 0.12 : 0.18)))
        .fill({ color: 0x2a241c, alpha: 0.13 });
      this.fillLayer.poly(points)
        .fill({ color, alpha: 0.92 });
      if (province && province.owner !== province.controller) {
        const centroid = this.centroids.get(id);
        if (centroid) {
          const width = Math.max(0.16, 0.55 / Math.max(1, this.world.scale.x));
          this.occupiedLayer.moveTo(centroid.x - width, centroid.y + 0.18)
            .lineTo(centroid.x + width, centroid.y + 0.18)
            .stroke({ width: Math.max(0.02, 2.2 / Math.max(1, this.world.scale.x)), color, alpha: 0.95 });
        }
      }
    }

    this.provinceBorderLayer.clear();
    this.countryBorderLayer.clear();
    this.drawBorders();

    this.drawCities();
    this.drawDeploymentTargets();
    this.drawProvinceLabels();
    this.drawCountryLabels();
    this.hasDrawn = true;
    this.drawSelection();
    this.drawHover();
    this.updateArmies();
    this.drawArmyTrails();
    this.updateBattles();
    this.updateOccupationBubbles();
    this.updateZoomScales();
  }

  private drawSelection(): void {
    this.selectionLayer.clear();
    if (!this.selectedProvince) return;
    const points = this.projected.get(this.selectedProvince);
    if (!points) return;
    this.selectionLayer.poly(points).stroke({ width: 0.26 * this.lineFactor(), color: 0xffd27a, alpha: 1 });
  }

  private drawHover(): void {
    this.hoverLayer.clear();
    if (!this.hoveredProvince || this.hoveredProvince === this.selectedProvince) return;
    const points = this.projected.get(this.hoveredProvince);
    if (!points) return;
    this.hoverLayer.poly(points).stroke({ width: 0.16 * this.lineFactor(), color: PAPER, alpha: 0.75 });
  }

  private drawBorders(): void {
    if (!this.state) return;
    this.provinceBorderLayer.clear();
    this.prefectureBorderLayer.clear();
    this.countryBorderLayer.clear();
    const scale = this.world.scale.x || 1;
    const countryWidth = Math.max(0.1, 3 / scale);
    const prefectureWidth = Math.max(0.04, 1.1 / scale);
    const provinceWidth = Math.max(0.02, 0.25 / scale);
    for (const edge of this.edges) {
      const a = this.state.provinces[edge.a];
      if (!a || edge.b === null) continue;
      const b = this.state.provinces[edge.b];
      if (!b) continue;
      if (a.controller !== b.controller) {
        this.countryBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2)
          .stroke({ width: countryWidth, color: 0x1f1913, alpha: 1 });
      } else if (this.content.provinces.get(edge.a)?.prefectureId !== this.content.provinces.get(edge.b)?.prefectureId) {
        this.prefectureBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2)
          .stroke({ width: prefectureWidth, color: 0x7a6a54, alpha: 0.45 });
      } else {
        this.provinceBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2)
          .stroke({ width: provinceWidth, color: 0x85765f, alpha: 0.18 });
      }
    }
  }

  private drawCities(): void {
    if (!this.state) return;
    this.cityLayer.clear();
    const capitals = new Set([...this.content.countries.values()].map(country => country.capital));
    for (const id of MAJOR_CITIES) {
      const centroid = this.centroids.get(id);
      if (!centroid) continue;
      if (capitals.has(id)) {
        this.drawStar(centroid.x, centroid.y, 0.34, 0.15);
      } else {
        this.cityLayer.circle(centroid.x, centroid.y, 0.18)
          .fill({ color: PAPER, alpha: 0.95 })
          .stroke({ width: 0.06, color: INK, alpha: 0.8 });
      }
    }
  }

  private drawStar(x: number, y: number, radius: number, inner: number): void {
    const points: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? radius : inner;
      points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    }
    this.cityLayer.poly(points).fill({ color: PAPER, alpha: 1 }).stroke({ width: 0.07, color: INK, alpha: 0.9 });
  }

  private drawCountryLabels(): void {
    if (!this.state) return;
    for (const label of this.countryLabels.values()) label.destroy();
    this.countryLabels.clear();
    this.smallLabels.clear();
    this.labelBaseScale.clear();
    this.countryLabelLayer.removeChildren();

    for (const country of Object.values(this.state.countries)) {
      if (!country.alive) continue;
      const controlled = Object.values(this.state.provinces).filter(province => province.controller === country.tag);
      if (controlled.length === 0) continue;
      let x = 0;
      let y = 0;
      if (controlled.length < 3) {
        const capital = this.centroids.get(country.capital);
        if (!capital) continue;
        x = capital.x;
        y = capital.y;
      } else {
        for (const province of controlled) {
          const centroid = this.centroids.get(province.id);
          if (!centroid) continue;
          x += centroid.x;
          y += centroid.y;
        }
        x /= controlled.length;
        y /= controlled.length;
        const inTerritory = controlled.some(province => {
          const polygon = this.projected.get(province.id);
          return polygon !== undefined && pointInPolygon(x, y, polygon);
        });
        if (!inTerritory) {
          const capital = this.centroids.get(country.capital);
          if (capital) {
            x = capital.x;
            y = capital.y;
          }
        }
      }
      const def = this.content.countries.get(country.tag);
      const color = hexToNumber(def?.color ?? '#7a7468');
      const lightText = colorLuma(color) < 0.52;
      const small = controlled.length <= 14;
      const fontSize = small
        ? 0.7
        : Math.max(1.25, Math.min(2.8, 1.15 + Math.sqrt(controlled.length) * 0.11));
      const baseSize = 64;
      const text = new Text({
        text: def?.name ?? country.tag,
        style: new TextStyle({
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif',
          fontSize: baseSize,
          fontWeight: '600',
          fill: lightText ? PAPER : INK,
          letterSpacing: 3,
          dropShadow: {
            color: 0x1f1c18,
            alpha: lightText ? 0.38 : 0.2,
            blur: 2.5,
            distance: 1.2,
            angle: Math.PI / 2,
          },
        }),
      });
      text.anchor.set(0.5);
      text.scale.set(fontSize / baseSize);
      this.labelBaseScale.set(text, fontSize / baseSize);
      text.position.set(x, y - 0.15);
      text.alpha = small ? 0.82 : 0.94;
      text.visible = !small || this.world.scale.x >= 13.5;
      text.eventMode = 'none';
      this.countryLabelLayer.addChild(text);
      this.countryLabels.set(country.tag, text);
      if (small) this.smallLabels.add(text);
    }
  }

  private drawProvinceLabels(): void {
    for (const label of this.provinceLabels.keys()) label.destroy();
    for (const label of this.localLabels.keys()) label.destroy();
    this.provinceLabels.clear();
    this.localLabels.clear();
    this.provinceLabelArea.clear();
    this.localLabelArea.clear();
    this.provinceLabelLayer.removeChildren();
    this.localLabelLayer.removeChildren();
    this.localLabelsDrawn = false;
    if (!this.state) return;
    const groups = new Map<string, { x: number; y: number; area: number; count: number; controller: string }>();
    for (const def of this.content.provinces.values()) {
      const centroid = this.centroids.get(def.id);
      if (!centroid) continue;
      const group = groups.get(def.prefectureId) ?? { x: 0, y: 0, area: 0, count: 0, controller: 'NEU' };
      group.x += centroid.x;
      group.y += centroid.y;
      group.area += labelArea(this.projected.get(def.id));
      group.count += 1;
      if (group.count === 1) group.controller = this.state.provinces[def.id]?.controller ?? 'NEU';
      groups.set(def.prefectureId, group);
    }
    for (const [id, group] of groups) {
      const name = this.content.prefectures.get(id)?.name;
      if (!name) continue;
      const text = new Text({
        text: name,
        style: new TextStyle({
          fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
          fontSize: 38,
          fontWeight: '600',
          fill: colorLuma(this.colorOf(group.controller)) > 0.55 ? INK : PAPER,
          letterSpacing: 1.2,
          dropShadow: {
            color: 0x1f1c18,
            alpha: 0.36,
            blur: 2,
            distance: 1,
            angle: Math.PI / 2,
          },
        }),
      });
      text.anchor.set(0.5);
      text.resolution = 4;
      text.position.set(group.x / Math.max(1, group.count), group.y / Math.max(1, group.count));
      this.provinceLabels.set(text, 20);
      this.provinceLabelArea.set(text, group.area);
      this.provinceLabelLayer.addChild(text);
    }
    this.updateProvinceLabelScales();
  }

  private ensureLocalLabels(): void {
    if (this.localLabelsDrawn || !this.state) return;
    this.localLabelsDrawn = true;
    for (const def of this.content.provinces.values()) {
      const points = this.projected.get(def.id);
      const centroid = this.centroids.get(def.id);
      if (!points || !centroid || !def.name) continue;
      const text = new Text({
        text: def.name,
        style: new TextStyle({
          fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
          fontSize: 32,
          fontWeight: '600',
          fill: colorLuma(this.colorOf(this.state.provinces[def.id]?.controller ?? 'NEU')) > 0.55 ? INK : PAPER,
          letterSpacing: 0.8,
          dropShadow: {
            color: 0x1f1c18,
            alpha: 0.34,
            blur: 1.8,
            distance: 0.8,
            angle: Math.PI / 2,
          },
        }),
      });
      text.anchor.set(0.5);
      text.resolution = 4;
      text.position.set(centroid.x, centroid.y);
      this.localLabels.set(text, 20);
      this.localLabelArea.set(text, labelArea(points));
      this.localLabelLayer.addChild(text);
    }
    this.updateProvinceLabelScales();
  }

  private updateProvinceLabelScales(): void {
    const scale = this.world.scale.x || 1;
    const used: Array<{ x: number; y: number }> = [];
    const provinceCandidates = [...this.provinceLabels.entries()]
      .sort((a, b) => (this.provinceLabelArea.get(b[0]) ?? 0) - (this.provinceLabelArea.get(a[0]) ?? 0));
    const minProvinceDistance = 140 / scale;
    for (const [label, target] of provinceCandidates) {
      label.scale.set(target / (38 * scale));
      label.visible = false;
      if (scale < 17 || scale >= 120) continue;
      const tooClose = used.some(point => Math.hypot(point.x - label.position.x, point.y - label.position.y) < minProvinceDistance);
      if (tooClose) continue;
      used.push({ x: label.position.x, y: label.position.y });
      label.visible = true;
    }
    const usedLocal: Array<{ x: number; y: number }> = [];
    const localCandidates = [...this.localLabels.entries()]
      .sort((a, b) => (this.localLabelArea.get(b[0]) ?? 0) - (this.localLabelArea.get(a[0]) ?? 0));
    const minLocalDistance = 90 / scale;
    for (const [label, target] of localCandidates) {
      label.scale.set(target / (32 * scale));
      label.visible = false;
      if (scale < 120) continue;
      const tooClose = usedLocal.some(point => Math.hypot(point.x - label.position.x, point.y - label.position.y) < minLocalDistance);
      if (tooClose) continue;
      usedLocal.push({ x: label.position.x, y: label.position.y });
      label.visible = true;
    }
  }

  private drawArmyTrails(): void {
    if (!this.state) return;
    this.trailLayer.clear();
    const lf = this.lineFactor();
    for (const army of Object.values(this.state.armies)) {
      if (army.tag !== this.state.playerTag) continue;
      const selected = army.id === this.selectedArmy;
      const history = this.positions([...(army.history ?? []), army.province]);
      const planned = this.positions([army.province, ...army.movePath]);
      if (army.embarked && army.navalTarget) {
        const from = this.centroids.get(army.province);
        const to = this.centroids.get(army.navalTarget);
        if (from && to) {
          this.strokeTrail([from, to], (selected ? 0.24 : 0.12) * lf, 0x3f7f9a, selected ? 0.75 : 0.45);
          this.trailLayer.circle(to.x, to.y, (selected ? 0.1 : 0.06) * lf).fill({ color: 0x3f7f9a, alpha: 0.8 });
        }
      }
      if (history.length > 1) {
        this.strokeTrail(history, (selected ? 0.18 : 0.06) * lf, 0x1f1c18, selected ? 0.4 : 0.18);
        if (selected) {
          this.strokeTrail(history, 0.1 * lf, 0xf2ead8, 0.7);
          for (const point of history) {
            this.trailLayer.circle(point.x, point.y, 0.06 * lf).fill({ color: 0xf2ead8, alpha: 0.8 });
          }
        }
      }
      if (planned.length > 1) {
        // planned routes are rendered by the screen-space canvas overlay
      }
    }
    this.drawAttackOverlay();
  }

  private drawAttackOverlay(): void {
    const canvas = this.attackCanvas;
    const app = this.app;
    if (!canvas || !app || !this.state) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = app.screen.width;
    const height = app.screen.height;
    const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const toCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
    for (const army of Object.values(this.state.armies)) {
      if (army.tag !== this.state.playerTag || army.movePath.length === 0) continue;
      const worldPoints = this.positions([army.province, ...army.movePath]);
      if (worldPoints.length < 2) continue;
      const screenPoints = worldPoints.map(point => this.world.toGlobal(new Point(point.x, point.y)));
      const curve = this.smoothRoute(screenPoints);
      const selected = army.id === this.selectedArmy;
      const faction = this.colorOf(army.tag);
      const factionCss = toCss(faction);
      const baseWidth = selected ? 8.6 : 6.2;
      const left: Array<{ x: number; y: number }> = [];
      const right: Array<{ x: number; y: number }> = [];
      let travelled = 0;
      let totalLength = 0;
      const segmentLengths: number[] = [];
      for (let i = 1; i < curve.length; i += 1) {
        const from = curve[i - 1];
        const to = curve[i];
        if (!from || !to) continue;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        segmentLengths.push(length);
        totalLength += length;
      }
      if (totalLength < 1) continue;
      const first = curve[0];
      const second = curve[1];
      if (first && second) {
        const firstDx = second.x - first.x;
        const firstDy = second.y - first.y;
        const firstLength = Math.hypot(firstDx, firstDy);
        if (firstLength > 0.01) {
          const firstWidth = baseWidth * 1.15 * 0.5;
          const nx = -firstDy / firstLength;
          const ny = firstDx / firstLength;
          left.push({ x: first.x + nx * firstWidth, y: first.y + ny * firstWidth });
          right.push({ x: first.x - nx * firstWidth, y: first.y - ny * firstWidth });
        }
      }
      for (let i = 1; i < curve.length; i += 1) {
        const from = curve[i - 1];
        const to = curve[i];
        const length = segmentLengths[i - 1] ?? 0;
        if (!from || !to || length < 0.01) continue;
        const t = (travelled + length * 0.5) / totalLength;
        const width = baseWidth * (1.15 - 0.55 * t) * 0.5;
        const nx = -(to.y - from.y) / length;
        const ny = (to.x - from.x) / length;
        left.push({ x: to.x + nx * width, y: to.y + ny * width });
        right.push({ x: to.x - nx * width, y: to.y - ny * width });
        travelled += length;
      }
      if (left.length < 2 || right.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(left[0]!.x, left[0]!.y);
      for (let i = 1; i < left.length; i += 1) ctx.lineTo(left[i]!.x, left[i]!.y);
      for (let i = right.length - 1; i >= 0; i -= 1) ctx.lineTo(right[i]!.x, right[i]!.y);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(
        curve[0]!.x, curve[0]!.y,
        curve[curve.length - 1]!.x, curve[curve.length - 1]!.y,
      );
      gradient.addColorStop(0, 'rgba(247,237,217,.72)');
      gradient.addColorStop(0.45, toCss(lerpColor(0xf7edd9, faction, 0.55)));
      gradient.addColorStop(1, factionCss);
      ctx.fillStyle = gradient;
      ctx.shadowColor = factionCss;
      ctx.shadowBlur = selected ? 9 : 5;
      ctx.globalAlpha = 0.98;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = selected ? 'rgba(255,210,122,.95)' : 'rgba(31,28,24,.35)';
      ctx.lineWidth = selected ? 1.8 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      const last = curve[curve.length - 1];
      const previous = curve[curve.length - 2];
      if (last && previous) {
        const angle = Math.atan2(last.y - previous.y, last.x - previous.x);
        const headLength = selected ? 25 : 20;
        const headWidth = selected ? 13 : 10;
        const baseX = last.x - Math.cos(angle) * headLength;
        const baseY = last.y - Math.sin(angle) * headLength;
        const px = -Math.sin(angle) * headWidth;
        const py = Math.cos(angle) * headWidth;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(baseX + px, baseY + py);
        ctx.lineTo(baseX - px, baseY - py);
        ctx.closePath();
        ctx.fillStyle = factionCss;
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = factionCss;
        ctx.fill();
        ctx.strokeStyle = selected ? '#ffd27a' : 'rgba(31,28,24,.9)';
        ctx.lineWidth = selected ? 2.4 : 1.6;
        ctx.stroke();
      }
    }
  }
  private smoothRoute(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (points.length < 3) return points;
    const result: Array<{ x: number; y: number }> = [];
    const samples = 16;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] ?? points[i]!;
      const p1 = points[i]!;
      const p2 = points[i + 1]!;
      const p3 = points[i + 2] ?? p2;
      for (let step = 0; step < samples; step += 1) {
        const t = step / samples;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t
          + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
          + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t
          + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2
          + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        result.push({ x, y });
      }
    }
    result.push(points[points.length - 1]!);
    return result;
  }

  private positions(ids: string[]): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    for (const id of ids) {
      const point = this.centroids.get(id);
      if (!point) continue;
      const previous = points[points.length - 1];
      if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 0.01) continue;
      points.push(point);
    }
    return points;
  }

  private strokeTrail(points: Array<{ x: number; y: number }>, width: number, color: number, alpha: number): void {
    const first = points[0];
    if (!first) return;
    this.trailLayer.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (point) this.trailLayer.lineTo(point.x, point.y);
    }
    this.trailLayer.stroke({ width, color, alpha });
  }

  private ensureArmyMarker(key: string, tag: string, army: ArmyState): ArmyMarker {
    const existing = this.armyMarkers.get(key);
    if (existing) return existing;
    const color = this.colorOf(tag);
    const light = colorLuma(color) > 0.55;
    const container = new Container();
    const shadow = new Graphics();
    shadow.roundRect(-1.35, -0.95, 2.7, 1.85, 0.24).fill({ color: 0x000000, alpha: 0.22 });
    shadow.position.set(0.12, 0.18);

    const body = new Graphics();
    body.roundRect(-1.2, -0.78, 2.4, 1.2, 0.2)
      .fill({ color, alpha: 0.98 })
      .stroke({ width: 0.08, color: INK, alpha: 1 });
    body.rect(-1.2, -0.78, 0.18, 1.2).fill({ color: INK, alpha: 0.9 });

    const plate = new Graphics();
    plate.roundRect(-1.02, -0.66, 1.55, 1.0, 0.13)
      .fill({ color: 0xf7edd9, alpha: 0.96 })
      .stroke({ width: 0.045, color: INK, alpha: 0.75 });
    drawUnitIcon(plate, army.composition, INK, tag);

    const badge = new Graphics();
    badge.circle(0.72, -0.38, 0.42)
      .fill({ color: 0xf7edd9, alpha: 0.98 })
      .stroke({ width: 0.07, color: INK, alpha: 0.95 });
    badge.circle(0.72, -0.38, 0.33)
      .fill({ color, alpha: 0.95 });

    const selection = new Graphics();
    selection.roundRect(-1.56, -0.9, 2.98, 1.98, 0.28)
      .stroke({ width: 0.1, color: 0xffd27a, alpha: 1 });
    selection.visible = false;

    const bars = new Graphics();

    const label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
        fontSize: 40,
        fontWeight: '700',
        fill: 0xf7edd9,
        stroke: { color: 0x1f1c18, width: 1.8 },
      }),
    });
    label.anchor.set(0.5);
    label.scale.set(0.7 / 40);
    label.position.set(0, 0.66);
    label.resolution = 4;

    const labelBg = new Graphics();
    labelBg.roundRect(-1.27, 0.36, 2.54, 0.56, 0.1)
      .fill({ color: 0x241f19, alpha: 0.92 })
      .stroke({ width: 0.035, color, alpha: 0.95 });

    const faction = new Text({
      text: FACTION_MARKS[tag] ?? tag.slice(0, 1),
      style: new TextStyle({
        fontFamily: '"Noto Serif SC", "Songti SC", serif',
        fontSize: 28,
        fontWeight: '700',
        fill: light ? INK : PAPER,
        stroke: { color: light ? PAPER : INK, width: 1.2 },
      }),
    });
    faction.anchor.set(0.5);
    faction.scale.set(0.48 / 28);
    faction.position.set(0.72, -0.38);
    faction.resolution = 3;

    container.addChild(shadow, body, plate, badge, bars, selection, labelBg, label, faction);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      const marker = this.armyMarkers.get(key);
      if (!marker) return;
      const ids = marker.armyIds;
      if (ids.length > 1) {
        this.onSelectArmyStack(ids);
        return;
      }
      const index = ids.indexOf(marker.armyId);
      const next = ids[(index + 1) % Math.max(1, ids.length)] ?? marker.armyId;
      if (next) this.onSelectArmy(next);
    });
    this.armyLayer.addChild(container);
    const marker: ArmyMarker = {
      container, body, bars, selection, label, labelBg, stackScale: 1,
      armyId: army.id, armyIds: [army.id], targetX: 0, targetY: 0, positioned: false,
    };
    this.armyMarkers.set(key, marker);
    return marker;
  }

  private drawArmyBars(marker: ArmyMarker, organization: number, strength: number): void {
    const clampedOrg = Math.max(0, Math.min(1, organization));
    const clampedStrength = Math.max(0, Math.min(1, strength));
    marker.bars.clear();
    marker.bars.roundRect(-1.43, -0.72, 0.3, 1.2, 0.08)
      .fill({ color: 0x1f1c18, alpha: 0.92 })
      .stroke({ width: 0.03, color: 0xf7edd9, alpha: 0.65 });
    const orgHeight = (1.12 * clampedOrg);
    const strengthHeight = (1.12 * clampedStrength);
    marker.bars.roundRect(-1.38, 0.4 - orgHeight, 0.1, orgHeight, 0.03)
      .fill({ color: 0xe8bc42, alpha: 1 });
    marker.bars.roundRect(-1.26, 0.4 - strengthHeight, 0.1, strengthHeight, 0.03)
      .fill({ color: 0x62a85c, alpha: 1 });
  }

  private updateArmies(): void {
    if (!this.state) return;
    const groups = new Map<string, ArmyState[]>();
    for (const army of Object.values(this.state.armies)) {
      if (!this.centroids.get(army.province)) continue;
      const key = `${army.province}:${army.tag}`;
      const list = groups.get(key) ?? [];
      list.push(army);
      groups.set(key, list);
    }
    const alive = new Set<string>(groups.keys());
    for (const [key, armies] of groups) {
      const centroid = this.centroids.get(armies[0]?.province ?? '');
      if (!centroid) continue;
      const ordered = [...armies].sort((a, b) => a.id.localeCompare(b.id));
      const representative = ordered.find(army => army.id === this.selectedArmy) ?? ordered[0];
      if (!representative) continue;
      const marker = this.ensureArmyMarker(key, representative.tag, representative);
      const count = ordered.length;
      let total = 0;
      let maxTotal = 0;
      let organization = 0;
      for (const army of ordered) {
        const strength = army.composition.infantry + army.composition.firearm
          + army.composition.cavalry + army.composition.artillery + army.composition.naval;
        total += strength;
        maxTotal += Math.max(1, army.maxStrength);
        organization += army.organization * strength;
      }
      const organizationPct = total > 0 ? organization / total / 100 : 0;
      const strengthPct = maxTotal > 0 ? total / maxTotal : 0;
      this.drawArmyBars(marker, organizationPct, strengthPct);
      marker.armyId = representative.id;
      marker.armyIds = ordered.map(army => army.id);
      const nextId = representative.movePath[0];
      const nextCentroid = nextId ? this.centroids.get(nextId) : null;
      const travel = ordered.length === 1 && nextCentroid
        ? Math.min(0.82, Math.max(0, representative.moveProgress))
        : 0;
      marker.targetX = centroid.x + (nextCentroid ? (nextCentroid.x - centroid.x) * travel : 0);
      marker.targetY = centroid.y + (nextCentroid ? (nextCentroid.y - centroid.y) * travel : 0);
      if (!marker.positioned) {
        marker.container.position.set(marker.targetX, marker.targetY);
        marker.positioned = true;
      }
      marker.container.zIndex = this.selectedArmy === representative.id ? 10 : 0;
      const selectable = representative.tag === this.state.playerTag || this.state.spectator;
      marker.container.eventMode = selectable ? 'static' : 'none';
      marker.container.cursor = selectable ? 'pointer' : 'default';
      marker.selection.visible = ordered.some(army => army.id === this.selectedArmy);
      marker.stackScale = 1 + Math.min(0.4, Math.max(0, count - 1) * 0.08);
      marker.label.text = `${strengthText(total)}${count > 1 ? ` ×${count}` : ''}`;
    }
    this.updateZoomScales();
    this.armyLayer.sortChildren();
    for (const [key, marker] of this.armyMarkers) {
      if (!alive.has(key)) {
        marker.container.destroy({ children: true });
        this.armyMarkers.delete(key);
      }
    }
  }

  private updateOccupationBubbles(): void {
    if (!this.state) return;
    const alive = new Set<string>();
    for (const province of Object.values(this.state.provinces)) {
      const occupation = province.occupation;
      if (!occupation) continue;
      if (!this.state.spectator && occupation.country !== this.state.playerTag) continue;
      const centroid = this.centroids.get(province.id);
      if (!centroid) continue;
      alive.add(province.id);
      let marker = this.occupationMarkers.get(province.id);
      if (!marker) {
        marker = new Container();
        marker.position.set(centroid.x, centroid.y);
        const bg = new Graphics();
        bg.roundRect(-57, -36, 114, 31, 12)
          .fill({ color: 0xf7edd9, alpha: 0.97 })
          .stroke({ width: 1.1, color: 0xa33a32, alpha: 0.9 });
        const label = new Text({
          text: '',
          style: {
            fontFamily: 'Noto Serif SC, SimSun, serif',
            fontSize: 11,
            fontWeight: '600',
            fill: 0x8f2b25,
          },
        });
        label.anchor.set(0.5);
        label.position.set(0, -25);
        label.resolution = 3;
        const bar = new Graphics();
        marker.addChild(bg, label, bar);
        this.occupationLayer.addChild(marker);
        this.occupationMarkers.set(province.id, marker);
      }
      const label = marker.children[1];
      if (label instanceof Text) {
        label.text = `${this.content.provinces.get(province.id)?.name ?? province.id} 占领中 ${Math.round(occupation.progress)}%`;
      }
      const bar = marker.children[2];
      if (bar instanceof Graphics) {
        bar.clear();
        bar.roundRect(-48, -12, 96, 4, 2).fill({ color: 0x1f1c18, alpha: 0.18 });
        bar.roundRect(-48, -12, 96 * Math.max(0, Math.min(1, occupation.progress / 100)), 4, 2)
          .fill({ color: this.colorOf(occupation.country), alpha: 1 });
      }
      marker.position.set(centroid.x, centroid.y);
    }
    for (const [id, marker] of this.occupationMarkers) {
      if (alive.has(id)) continue;
      marker.destroy({ children: true });
      this.occupationMarkers.delete(id);
    }
  }

  private updateBattles(): void {
    if (!this.state) return;
    const alive = new Set<string>();
    for (const battle of this.state.battles) {
      const centroid = this.centroids.get(battle.provinceId);
      if (!centroid) continue;
      alive.add(battle.id);
      let marker = this.battleMarkers.get(battle.id);
      if (!marker) {
        marker = new Container();
        marker.eventMode = 'static';
        marker.cursor = 'pointer';
        const bg = new Graphics();
        bg.roundRect(-48, -29, 96, 26, 13)
          .fill({ color: 0xf7edd9, alpha: 0.96 })
          .stroke({ width: 1.4, color: 0x9e2b25, alpha: 0.95 });
        const label = new Text({
          text: '',
          style: {
            fontFamily: 'Noto Serif SC, SimSun, serif',
            fontSize: 11,
            fontWeight: '600',
            fill: 0x9e2b25,
          },
        });
        label.anchor.set(0.5);
        label.resolution = 3;
        label.position.y = -16;
        marker.addChild(bg, label);
        marker.position.set(centroid.x, centroid.y);
        marker.on('pointertap', (event) => {
          event.stopPropagation();
          this.onSelectBattle(battle.id);
        });
        this.battleLayer.addChild(marker);
        this.battleMarkers.set(battle.id, marker);
      }
      const label = marker.children[1];
      if (label instanceof Text) {
        const name = this.content.provinces.get(battle.provinceId)?.name ?? battle.provinceId;
        label.text = `⚔ ${name} ${battle.days}日`;
      }
      marker.position.set(centroid.x, centroid.y);
    }
    for (const [id, marker] of this.battleMarkers) {
      if (alive.has(id)) continue;
      marker.destroy({ children: true });
      this.battleMarkers.delete(id);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.app && this.wheelHandler) {
      this.app.canvas.removeEventListener('wheel', this.wheelHandler);
    }
    if (this.app && this.contextHandler) {
      this.app.canvas.removeEventListener('contextmenu', this.contextHandler);
    }
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.attackCanvas?.remove();
    this.attackCanvas = null;
  }
}

function interiorPoint(points: number[], fallbackX: number, fallbackY: number): { x: number; y: number } {
  if (pointInPolygon(fallbackX, fallbackY, points)) return { x: fallbackX, y: fallbackY };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (let radius = 0.42; radius >= 0.05; radius -= 0.045) {
    for (let step = 0; step < 24; step += 1) {
      const angle = (step / 24) * Math.PI * 2;
      const x = cx + Math.cos(angle) * (maxX - minX) * radius;
      const y = cy + Math.sin(angle) * (maxY - minY) * radius;
      if (pointInPolygon(x, y, points)) return { x, y };
    }
  }
  return { x: fallbackX, y: fallbackY };
}

function labelArea(points: number[] | undefined): number {
  if (!points || points.length < 6) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] ?? 0;
    const y = points[i + 1] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return Math.max(0, (maxX - minX) * (maxY - minY));
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function strengthText(strength: number): string {
  if (strength >= 10000) return `${Math.round(strength / 1000)}k`;
  if (strength >= 1000) {
    const value = strength / 1000;
    return `${value >= 5 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(Math.max(0, Math.round(strength)));
}

function drawUnitIcon(graphics: Graphics, composition: ArmyState['composition'], iconColor: number, tag: string): void {
  const total = composition.infantry + composition.firearm + composition.cavalry
    + composition.artillery + composition.naval || 1;
  drawFactionGlyph(graphics, tag, iconColor);
  if (composition.naval / total > 0.35) {
    graphics.poly([-0.72, 0.12, 0.62, 0.12, 0.42, 0.42, -0.52, 0.42]).fill({ color: iconColor, alpha: 1 });
    graphics.rect(-0.06, -0.58, 0.1, 0.7).fill({ color: iconColor, alpha: 1 });
    graphics.poly([-0.02, -0.56, 0.52, -0.28, -0.02, -0.06]).fill({ color: iconColor, alpha: 0.95 });
    return;
  }
  if (composition.artillery / total > 0.24) {
    graphics.circle(-0.34, 0.18, 0.23).stroke({ width: 0.1, color: iconColor, alpha: 1 });
    graphics.circle(-0.34, 0.18, 0.06).fill({ color: iconColor, alpha: 1 });
    graphics.moveTo(-0.28, 0.12).lineTo(0.6, -0.22).stroke({ width: 0.15, color: iconColor, alpha: 1 });
    return;
  }
  if (composition.cavalry / total > 0.42) {
    graphics.ellipse(0.0, 0.02, 0.5, 0.22).fill({ color: iconColor, alpha: 1 });
    graphics.poly([0.34, -0.1, 0.64, -0.42, 0.78, -0.34, 0.5, 0.0]).fill({ color: iconColor, alpha: 1 });
    graphics.circle(0.02, -0.22, 0.13).fill({ color: iconColor, alpha: 1 });
    graphics.moveTo(-0.35, 0.16).lineTo(-0.48, 0.48).stroke({ width: 0.09, color: iconColor, alpha: 1 });
    graphics.moveTo(-0.05, 0.16).lineTo(-0.12, 0.48).stroke({ width: 0.09, color: iconColor, alpha: 1 });
    graphics.moveTo(0.25, 0.14).lineTo(0.35, 0.46).stroke({ width: 0.09, color: iconColor, alpha: 1 });
    return;
  }
  graphics.circle(-0.48, -0.08, 0.17).fill({ color: iconColor, alpha: 1 });
  graphics.roundRect(-0.64, -0.23, 0.32, 0.45, 0.08).fill({ color: iconColor, alpha: 1 });
  graphics.moveTo(-0.8, 0.0).lineTo(0.48, 0.26).stroke({ width: 0.07, color: iconColor, alpha: 1 });
  graphics.moveTo(-0.55, -0.38).lineTo(-0.66, -0.04).stroke({ width: 0.07, color: iconColor, alpha: 1 });
  graphics.moveTo(-0.37, -0.38).lineTo(-0.26, -0.04).stroke({ width: 0.07, color: iconColor, alpha: 1 });
}

function drawFactionGlyph(graphics: Graphics, tag: string, color: number): void {
  if (tag === 'MING' || tag === 'SMING') {
    graphics.circle(0.52, -0.28, 0.14).stroke({ width: 0.05, color, alpha: 0.9 });
    graphics.circle(0.52, -0.28, 0.045).fill({ color, alpha: 0.95 });
    return;
  }
  if (tag === 'QING') {
    graphics.rect(0.42, -0.42, 0.18, 0.36).stroke({ width: 0.05, color, alpha: 0.9 });
    graphics.poly([0.42, -0.42, 0.72, -0.34, 0.42, -0.22]).fill({ color, alpha: 0.9 });
    return;
  }
  if (tag === 'JAPAN') {
    graphics.circle(0.52, -0.28, 0.15).fill({ color, alpha: 0.85 });
    graphics.circle(0.52, -0.28, 0.06).fill({ color: 0xf7edd9, alpha: 0.95 });
    return;
  }
  if (tag === 'JOSEON') {
    for (const offset of [-0.38, -0.28, -0.18]) {
      graphics.moveTo(0.38, offset).lineTo(0.7, offset).stroke({ width: 0.045, color, alpha: 0.9 });
    }
    return;
  }
  if (tag === 'MONGOL') {
    graphics.poly([0.36, -0.4, 0.72, -0.2, 0.36, 0.0]).fill({ color, alpha: 0.9 });
    return;
  }
  if (tag === 'VOC') {
    graphics.rect(0.42, -0.44, 0.05, 0.4).fill({ color, alpha: 0.9 });
    graphics.poly([0.47, -0.44, 0.72, -0.32, 0.47, -0.2]).fill({ color, alpha: 0.9 });
    return;
  }
  if (tag === 'RUSSIA') {
    graphics.moveTo(0.54, -0.46).lineTo(0.54, 0.0).stroke({ width: 0.055, color, alpha: 0.9 });
    graphics.moveTo(0.4, -0.28).lineTo(0.68, -0.28).stroke({ width: 0.055, color, alpha: 0.9 });
    return;
  }
  if (tag === 'TIBET') {
    graphics.poly([0.54, -0.44, 0.72, -0.26, 0.54, -0.08, 0.36, -0.26]).fill({ color, alpha: 0.86 });
    return;
  }
  if (tag === 'SHUN' || tag === 'XI') {
    graphics.poly([0.5, -0.46, 0.7, -0.18, 0.58, -0.18, 0.68, 0.02, 0.42, -0.24, 0.54, -0.24])
      .fill({ color, alpha: 0.9 });
  }
}


































