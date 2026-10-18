import { Application, Container, Graphics, Point, Text, TextStyle } from 'pixi.js';
import type { ContentIndex, MapGeo } from '../../content/types';
import type { ArmyState, GameState } from '../../engine/state/types';
import { relationKey } from '../../engine/state/types';
import { areAtWar } from '../../engine/rules/war';

type SelectProvinceHandler = (provinceId: string) => void;
type SelectArmyHandler = (armyId: string) => void;
type ContextProvinceHandler = (provinceId: string) => void;

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
  selection: Graphics;
  label: Text;
  stackScale: number;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;

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
  private shadowLayer = new Graphics();
  private fillLayer = new Graphics();
  private terrainLayer = new Graphics();
  private selectionLayer = new Graphics();
  private provinceBorderLayer = new Graphics();
  private countryBorderLayer = new Graphics();
  private trailLayer = new Graphics();
  private hoverLayer = new Graphics();
  private cityLayer = new Graphics();
  private countryLabelLayer = new Container();
  private armyLayer = new Container();
  private projected = new Map<string, number[]>();
  private centroids = new Map<string, { x: number; y: number }>();
  private edges: EdgeRecord[] = [];
  private countryLabels = new Map<string, Text>();
  private smallLabels = new Set<Text>();
  private armyMarkers = new Map<string, ArmyMarker>();
  private state: GameState | null = null;
  private selectedProvince: string | null = null;
  private selectedArmy: string | null = null;
  private hoveredProvince: string | null = null;
  private diplomaticMode = false;
  private fitScale = 1;
  private ownerSignature = '';
  private hasDrawn = false;
  private dragging = false;
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
    private readonly onContextProvince: ContextProvinceHandler,
  ) {}

  async init(): Promise<void> {
    const app = new Application();
    await app.init({
      background: 0xd6ded5,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
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
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.armyLayer.sortableChildren = true;
    this.world.addChild(
      this.otherLayer,
      this.seaLabelLayer,
      this.otherLabelLayer,
      this.shadowLayer,
      this.fillLayer,
      this.terrainLayer,
      this.provinceBorderLayer,
      this.countryBorderLayer,
      this.selectionLayer,
      this.hoverLayer,
      this.cityLayer,
      this.trailLayer,
      this.armyLayer,
      this.countryLabelLayer,
    );
    app.stage.addChild(this.world);
    this.prepareGeometry();
    this.drawOtherRegions();
    this.drawTerrain();
    this.fit();
    this.bindPointer();
  }

  private projectPoint(lon: number, lat: number): { x: number; y: number } {
    const minLon = this.geo.bounds[0];
    const maxLat = this.geo.bounds[3];
    return { x: lon - minLon, y: maxLat - lat };
  }

  private drawOtherRegions(): void {
    this.otherLayer.clear();
    for (const region of this.geo.otherRegions) {
      const points: number[] = [];
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
        .fill({ color: 0xd9d4c8, alpha: 1 })
        .stroke({ width: 0.09, color: 0x9b9588, alpha: 0.9 });
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
    for (const [id, points] of this.projected) {
      const terrain = this.content.provinces.get(id)?.terrain ?? 'plains';
      const tint = TERRAIN_TINT[terrain] ?? TERRAIN_TINT.plains;
      if (tint) this.terrainLayer.poly(points).fill({ color: tint.color, alpha: tint.alpha });
      const centroid = this.centroids.get(id);
      if (centroid) this.drawTerrainSymbol(centroid.x, centroid.y, terrain);
    }
  }

  private drawTerrainSymbol(x: number, y: number, terrain: string): void {
    const ink = 0x4a4034;
    const green = 0x3f6b3a;
    const lake = 0x3f6f6a;
    if (terrain === 'mountains') {
      for (const offset of [-0.42, 0, 0.42]) {
        this.terrainLayer.poly([x + offset - 0.28, y + 0.24, x + offset, y - 0.28, x + offset + 0.28, y + 0.24])
          .fill({ color: ink, alpha: 0.32 });
      }
      return;
    }
    if (terrain === 'hills') {
      for (const offset of [-0.3, 0.3]) {
        this.terrainLayer.poly([
          x + offset - 0.28, y + 0.18,
          x + offset - 0.14, y - 0.12,
          x + offset + 0.02, y + 0.18,
        ]).fill({ color: 0x6b5a3a, alpha: 0.28 });
      }
      return;
    }
    if (terrain === 'desert') {
      this.terrainLayer.rect(x - 0.38, y + 0.04, 0.38, 0.05).fill({ color: 0x9e7a3a, alpha: 0.4 });
      this.terrainLayer.rect(x + 0.02, y + 0.18, 0.36, 0.05).fill({ color: 0x9e7a3a, alpha: 0.35 });
      this.terrainLayer.circle(x + 0.28, y - 0.08, 0.04).fill({ color: 0x9e7a3a, alpha: 0.4 });
      return;
    }
    if (terrain === 'wetland') {
      for (const offset of [-0.22, 0.04, 0.28]) {
        this.terrainLayer.rect(x - 0.36, y + offset, 0.72, 0.045).fill({ color: lake, alpha: 0.4 });
      }
      return;
    }
    if (terrain === 'jungle' || terrain === 'steppe') {
      const color = terrain === 'jungle' ? green : 0x8a843a;
      for (const offset of [-0.34, 0, 0.34]) {
        this.terrainLayer.poly([x + offset - 0.18, y + 0.18, x + offset, y - 0.18, x + offset + 0.18, y + 0.18])
          .fill({ color, alpha: 0.32 });
        this.terrainLayer.rect(x + offset - 0.03, y + 0.16, 0.06, 0.16).fill({ color: ink, alpha: 0.3 });
      }
      return;
    }
    if (terrain === 'plains') {
      this.terrainLayer.rect(x - 0.3, y + 0.06, 0.36, 0.04).fill({ color: 0x6b7a42, alpha: 0.26 });
      this.terrainLayer.rect(x + 0.04, y + 0.2, 0.3, 0.04).fill({ color: 0x6b7a42, alpha: 0.22 });
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
      this.centroids.set(id, { x: sx / count, y: sy / count });

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

  private updateZoomScales(): void {
    const scale = this.world.scale.x;
    const markerScale = Math.max(0.5, 9 / scale);
    for (const marker of this.armyMarkers.values()) {
      marker.container.scale.set(markerScale * marker.stackScale);
    }
    for (const label of this.smallLabels) {
      label.visible = scale >= 13.5;
    }
  }

  private bindPointer(): void {
    const app = this.app;
    if (!app) return;
    const stage = app.stage;
    stage.on('pointerdown', (event) => {
      if (event.button === 2) return;
      this.dragging = true;
      this.moved = false;
      this.lastPointer = { x: event.global.x, y: event.global.y };
    });
    stage.on('pointermove', (event) => {
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
      this.lastPointer = { x: event.global.x, y: event.global.y };
    });
    stage.on('pointerup', (event) => {
      if (event.button === 2) return;
      this.dragging = false;
      if (!this.moved) this.pick(event.global.x, event.global.y);
    });
    stage.on('pointerupoutside', () => {
      this.dragging = false;
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
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
      const nextScale = Math.max(this.fitScale, Math.min(60, this.world.scale.x * factor));
      this.world.scale.set(nextScale);
      const after = this.world.toLocal(new Point(px, py));
      this.world.position.x += (after.x - before.x) * nextScale;
      this.world.position.y += (after.y - before.y) * nextScale;
      this.clampWorld();
      this.updateZoomScales();
    };
    app.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    this.contextHandler = (event: MouseEvent) => {
      event.preventDefault();
      if (!this.app) return;
      const rect = this.app.canvas.getBoundingClientRect();
      const scaleX = this.app.screen.width / rect.width;
      const scaleY = this.app.screen.height / rect.height;
      const province = this.provinceAt(
        (event.clientX - rect.left) * scaleX,
        (event.clientY - rect.top) * scaleY,
      );
      if (province) this.onContextProvince(province);
    };
    app.canvas.addEventListener('contextmenu', this.contextHandler);
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

  private fillColor(tag: string): number {
    if (!this.diplomaticMode || !this.state) return this.colorOf(tag);
    if (tag === this.state.playerTag) return 0xe0c26a;
    if (areAtWar(this.state, this.state.playerTag, tag)) return 0xa33a32;
    const relation = this.state.relations[relationKey(this.state.playerTag, tag)] ?? 0;
    if (relation >= 20) return 0x3f6f9a;
    return 0x8a8578;
  }

  setDiplomaticMode(enabled: boolean): void {
    if (this.diplomaticMode === enabled) return;
    this.diplomaticMode = enabled;
    this.ownerSignature = '';
    if (this.state) this.redrawMap();
  }

  setState(state: GameState, selectedProvince: string | null, selectedArmy: string | null): void {
    this.state = state;
    this.selectedProvince = selectedProvince;
    this.selectedArmy = selectedArmy;
    const signature = Object.values(state.provinces)
      .map(province => `${province.id}:${province.controller}`)
      .join('|');
    if (signature !== this.ownerSignature || !this.hasDrawn) {
      this.ownerSignature = signature;
      this.redrawMap();
    } else {
      this.drawSelection();
      this.updateArmies();
      this.drawArmyTrails();
    }
  }

  private redrawMap(): void {
    if (!this.state || this.projected.size === 0) return;
    this.shadowLayer.clear();
    this.fillLayer.clear();
    for (const [id, points] of this.projected) {
      const province = this.state.provinces[id];
      const color = this.fillColor(province?.controller ?? 'NEU');
      this.shadowLayer.poly(points.map((value, index) => value + (index % 2 === 0 ? 0.12 : 0.18)))
        .fill({ color: 0x2a241c, alpha: 0.13 });
      this.fillLayer.poly(points)
        .fill({ color, alpha: 0.92 })
        .stroke({ width: 0.025, color: 0x3a3226, alpha: 0.35 });
    }

    this.provinceBorderLayer.clear();
    this.countryBorderLayer.clear();
    for (const edge of this.edges) {
      const a = this.state.provinces[edge.a];
      if (!a || edge.b === null) continue;
      const b = this.state.provinces[edge.b];
      if (!b) continue;
      if (a.controller !== b.controller) {
        this.countryBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2)
          .stroke({ width: 0.28, color: 0x1f1913, alpha: 1 });
      } else {
        this.provinceBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2)
          .stroke({ width: 0.045, color: 0x5a5040, alpha: 0.6 });
      }
    }

    this.drawCities();
    this.drawCountryLabels();
    this.hasDrawn = true;
    this.drawSelection();
    this.drawHover();
    this.updateArmies();
    this.drawArmyTrails();
  }

  private drawSelection(): void {
    this.selectionLayer.clear();
    if (!this.selectedProvince) return;
    const points = this.projected.get(this.selectedProvince);
    if (!points) return;
    this.selectionLayer.poly(points).stroke({ width: 0.26, color: 0xffd27a, alpha: 1 });
  }

  private drawHover(): void {
    this.hoverLayer.clear();
    if (!this.hoveredProvince || this.hoveredProvince === this.selectedProvince) return;
    const points = this.projected.get(this.hoveredProvince);
    if (!points) return;
    this.hoverLayer.poly(points).stroke({ width: 0.16, color: PAPER, alpha: 0.75 });
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
          stroke: { color: lightText ? INK : PAPER, width: 3.2 },
          letterSpacing: 6,
        }),
      });
      text.anchor.set(0.5);
      text.scale.set(fontSize / baseSize);
      text.position.set(x, y - 0.15);
      text.alpha = small ? 0.82 : 0.94;
      text.visible = !small || this.world.scale.x >= 13.5;
      text.eventMode = 'none';
      this.countryLabelLayer.addChild(text);
      this.countryLabels.set(country.tag, text);
      if (small) this.smallLabels.add(text);
    }
  }

  private drawArmyTrails(): void {
    if (!this.state) return;
    this.trailLayer.clear();
    for (const army of Object.values(this.state.armies)) {
      const selected = army.id === this.selectedArmy;
      if (!selected && army.movePath.length === 0) continue;
      const color = this.colorOf(army.tag);
      const history = this.positions([...(army.history ?? []), army.province]);
      const planned = this.positions([army.province, ...army.movePath]);
      if (selected && history.length > 1) {
        this.strokeTrail(history, 0.18, 0x1f1c18, 0.4);
        this.strokeTrail(history, 0.1, 0xf2ead8, 0.7);
        for (const point of history) {
          this.trailLayer.circle(point.x, point.y, 0.06).fill({ color: 0xf2ead8, alpha: 0.8 });
        }
      }
      if (planned.length > 1) {
        if (selected) {
          this.strokeTrail(planned, 0.42, 0x1f1c18, 0.55);
          this.strokeTrail(planned, 0.22, 0xffd27a, 1);
          this.strokeTrailArrows(planned, 0xffd27a, 0x1f1c18);
          for (const point of planned) {
            this.trailLayer.circle(point.x, point.y, 0.09)
              .fill({ color: 0xffd27a, alpha: 1 })
              .stroke({ width: 0.04, color: 0x1f1c18, alpha: 0.9 });
          }
        } else {
          this.strokeTrail(planned, 0.07, color, 0.35);
        }
      }
    }
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

  private strokeTrailArrows(points: Array<{ x: number; y: number }>, color: number, outline: number): void {
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1];
      const to = points[i];
      if (!from || !to) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.2) continue;
      const angle = Math.atan2(dy, dx);
      const left = angle + Math.PI * 0.78;
      const right = angle - Math.PI * 0.78;
      const outlineSize = 0.38;
      const size = 0.27;
      this.trailLayer.poly([
        to.x, to.y,
        to.x + Math.cos(left) * outlineSize, to.y + Math.sin(left) * outlineSize,
        to.x + Math.cos(right) * outlineSize, to.y + Math.sin(right) * outlineSize,
      ]).fill({ color: outline, alpha: 0.9 });
      this.trailLayer.poly([
        to.x, to.y,
        to.x + Math.cos(left) * size, to.y + Math.sin(left) * size,
        to.x + Math.cos(right) * size, to.y + Math.sin(right) * size,
      ]).fill({ color, alpha: 1 });
    }
  }

  private separateMarkers(): void {
    const markers = [...this.armyMarkers.values()];
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (let i = 0; i < markers.length; i += 1) {
        const a = markers[i];
        if (!a) continue;
        for (let j = i + 1; j < markers.length; j += 1) {
          const b = markers[j];
          if (!b) continue;
          const dx = b.container.position.x - a.container.position.x;
          const dy = b.container.position.y - a.container.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= 2.5) continue;
          const angle = distance > 0.001 ? Math.atan2(dy, dx) : ((i + j) % 7) * 0.9;
          const push = (2.5 - distance) / 2 + 0.01;
          a.container.position.x -= Math.cos(angle) * push;
          a.container.position.y -= Math.sin(angle) * push;
          b.container.position.x += Math.cos(angle) * push;
          b.container.position.y += Math.sin(angle) * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  private ensureArmyMarker(id: string, tag: string, army: ArmyState): ArmyMarker {
    const existing = this.armyMarkers.get(id);
    if (existing) return existing;
    const color = this.colorOf(tag);
    const light = colorLuma(color) > 0.55;
    const iconColor = light ? INK : PAPER;
    const container = new Container();
    const shadow = new Graphics();
    shadow.roundRect(-1.35, -0.95, 2.7, 1.85, 0.24).fill({ color: 0x000000, alpha: 0.22 });
    shadow.position.set(0.12, 0.18);

    const body = new Graphics();
    body.roundRect(-1.2, -0.78, 2.4, 1.2, 0.2)
      .fill({ color, alpha: 0.98 })
      .stroke({ width: 0.08, color: INK, alpha: 1 });
    body.rect(-1.2, -0.78, 0.18, 1.2).fill({ color: INK, alpha: 0.9 });
    body.poly([-1.0, -0.78, -0.5, -0.78, -0.75, -1.15]).fill({ color: iconColor, alpha: 0.95 });
    drawUnitIcon(body, army.composition, iconColor);

    const selection = new Graphics();
    selection.roundRect(-1.35, -0.98, 2.7, 2.05, 0.28)
      .stroke({ width: 0.1, color: 0xffd27a, alpha: 1 });
    selection.visible = false;

    const label = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'serif',
        fontSize: 48,
        fill: light ? INK : PAPER,
        stroke: { color: light ? PAPER : INK, width: 2.2 },
      }),
    });
    label.anchor.set(0.5);
    label.scale.set(0.78 / 48);
    label.position.set(0, 0.78);

    container.addChild(shadow, body, selection, label);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();
      this.onSelectArmy(id);
    });
    this.armyLayer.addChild(container);
    const marker: ArmyMarker = { container, body, selection, label, stackScale: 1 };
    this.armyMarkers.set(id, marker);
    return marker;
  }

  private updateArmies(): void {
    if (!this.state) return;
    const byProvince = new Map<string, ArmyState[]>();
    const alive = new Set<string>();
    for (const army of Object.values(this.state.armies)) {
      if (!this.centroids.get(army.province)) continue;
      alive.add(army.id);
      const list = byProvince.get(army.province) ?? [];
      list.push(army);
      byProvince.set(army.province, list);
    }
    for (const [province, armies] of byProvince) {
      const centroid = this.centroids.get(province);
      if (!centroid) continue;
      const ordered = [...armies].sort((a, b) => a.id.localeCompare(b.id));
      const offsets = stackOffsets(ordered.length);
      ordered.forEach((army, index) => {
        const marker = this.ensureArmyMarker(army.id, army.tag, army);
        const offset = offsets[index] ?? { x: 0, y: 0 };
        marker.container.position.set(centroid.x + offset.x, centroid.y + offset.y);
        marker.container.zIndex = this.selectedArmy === army.id ? 10 : 0;
        marker.selection.visible = this.selectedArmy === army.id;
        marker.stackScale = ordered.length > 4 ? 0.78 : 1;
        marker.label.text = strengthLabel(army);
      });
    }
    this.separateMarkers();
    this.updateZoomScales();
    this.armyLayer.sortChildren();
    for (const [id, marker] of this.armyMarkers) {
      if (!alive.has(id)) {
        marker.container.destroy({ children: true });
        this.armyMarkers.delete(id);
      }
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
  }
}

function strengthLabel(army: ArmyState): string {
  const strength = army.composition.infantry + army.composition.firearm
    + army.composition.cavalry + army.composition.artillery + army.composition.naval;
  if (strength >= 10000) return `${(strength / 1000).toFixed(0)}k`;
  if (strength >= 1000) return `${(strength / 1000).toFixed(1)}k`;
  return String(Math.max(0, Math.round(strength)));
}

function stackOffsets(count: number): Array<{ x: number; y: number }> {
  if (count <= 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -1.8, y: 0 }, { x: 1.8, y: 0 }];
  if (count === 3) return [{ x: -1.7, y: 1.0 }, { x: 1.7, y: 1.0 }, { x: 0, y: -1.4 }];
  if (count === 4) return [
    { x: -1.6, y: 1.0 }, { x: 1.6, y: 1.0 },
    { x: -1.6, y: -1.0 }, { x: 1.6, y: -1.0 },
  ];
  const radius = 2.1 + (count - 4) * 0.1;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

function drawUnitIcon(graphics: Graphics, composition: ArmyState['composition'], iconColor: number): void {
  const total = composition.infantry + composition.firearm + composition.cavalry
    + composition.artillery + composition.naval || 1;
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
