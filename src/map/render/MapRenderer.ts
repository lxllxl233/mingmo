import { Application, Container, Graphics, Point, Text, TextStyle } from 'pixi.js';
import type { ContentIndex, MapGeo } from '../../content/types';
import type { ArmyState, GameState } from '../../engine/state/types';

type SelectProvinceHandler = (provinceId: string) => void;
type SelectArmyHandler = (armyId: string) => void;

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
}

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
  private shadowLayer = new Graphics();
  private fillLayer = new Graphics();
  private selectionLayer = new Graphics();
  private provinceBorderLayer = new Graphics();
  private countryBorderLayer = new Graphics();
  private hoverLayer = new Graphics();
  private cityLayer = new Graphics();
  private countryLabelLayer = new Container();
  private armyLayer = new Container();
  private projected = new Map<string, number[]>();
  private centroids = new Map<string, { x: number; y: number }>();
  private edges: EdgeRecord[] = [];
  private countryLabels = new Map<string, Text>();
  private armyMarkers = new Map<string, ArmyMarker>();
  private state: GameState | null = null;
  private selectedProvince: string | null = null;
  private selectedArmy: string | null = null;
  private hoveredProvince: string | null = null;
  private ownerSignature = '';
  private hasDrawn = false;
  private dragging = false;
  private moved = false;
  private lastPointer = { x: 0, y: 0 };
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private destroyed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly geo: MapGeo,
    private readonly content: ContentIndex,
    private readonly onSelectProvince: SelectProvinceHandler,
    private readonly onSelectArmy: SelectArmyHandler,
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
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.armyLayer.sortableChildren = true;
    this.world.addChild(
      this.shadowLayer,
      this.fillLayer,
      this.provinceBorderLayer,
      this.countryBorderLayer,
      this.selectionLayer,
      this.hoverLayer,
      this.cityLayer,
      this.armyLayer,
      this.countryLabelLayer,
    );
    app.stage.addChild(this.world);
    this.prepareGeometry();
    this.fit();
    this.bindPointer();
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
    this.world.scale.set(scale);
    this.world.position.set(
      (width - this.mapWidth() * scale) / 2,
      (height - this.mapHeight() * scale) / 2,
    );
    this.updateZoomScales();
  }

  private updateZoomScales(): void {
    const scale = this.world.scale.x;
    const markerScale = Math.max(0.5, 9 / scale);
    for (const marker of this.armyMarkers.values()) marker.container.scale.set(markerScale);
  }

  private bindPointer(): void {
    const app = this.app;
    if (!app) return;
    const stage = app.stage;
    stage.on('pointerdown', (event) => {
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
      this.lastPointer = { x: event.global.x, y: event.global.y };
    });
    stage.on('pointerup', (event) => {
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
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const before = this.world.toLocal(new Point(px, py));
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
      const nextScale = Math.max(2, Math.min(60, this.world.scale.x * factor));
      this.world.scale.set(nextScale);
      const after = this.world.toLocal(new Point(px, py));
      this.world.position.x += (after.x - before.x) * nextScale;
      this.world.position.y += (after.y - before.y) * nextScale;
      this.updateZoomScales();
    };
    app.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    app.renderer.on('resize', () => this.fit());
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
    }
  }

  private redrawMap(): void {
    if (!this.state || this.projected.size === 0) return;
    this.shadowLayer.clear();
    this.fillLayer.clear();
    for (const [id, points] of this.projected) {
      const province = this.state.provinces[id];
      const color = this.colorOf(province?.controller ?? 'NEU');
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
        this.countryBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2);
      } else {
        this.provinceBorderLayer.moveTo(edge.x1, edge.y1).lineTo(edge.x2, edge.y2);
      }
    }
    this.provinceBorderLayer.stroke({ width: 0.045, color: 0x5a5040, alpha: 0.6 });
    this.countryBorderLayer.stroke({ width: 0.28, color: 0x1f1913, alpha: 1 });

    this.drawCities();
    this.drawCountryLabels();
    this.hasDrawn = true;
    this.drawSelection();
    this.drawHover();
    this.updateArmies();
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
      const fontSize = Math.max(1.15, Math.min(3.0, 1.15 + Math.sqrt(controlled.length) * 0.11));
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
      text.alpha = 0.94;
      text.eventMode = 'none';
      this.countryLabelLayer.addChild(text);
      this.countryLabels.set(country.tag, text);
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
      event.stopPropagation();
      this.onSelectArmy(id);
    });
    this.armyLayer.addChild(container);
    const marker: ArmyMarker = { container, body, selection, label };
    this.armyMarkers.set(id, marker);
    return marker;
  }

  private updateArmies(): void {
    if (!this.state) return;
    const byProvince = new Map<string, number>();
    const alive = new Set<string>();
    for (const army of Object.values(this.state.armies)) {
      const centroid = this.centroids.get(army.province);
      if (!centroid) continue;
      alive.add(army.id);
      const marker = this.ensureArmyMarker(army.id, army.tag, army);
      const index = byProvince.get(army.province) ?? 0;
      byProvince.set(army.province, index + 1);
      const offset = index * 1.3;
      marker.container.position.set(centroid.x + offset, centroid.y - offset);
      marker.container.zIndex = this.selectedArmy === army.id ? 10 : 0;
      marker.selection.visible = this.selectedArmy === army.id;
      marker.label.text = strengthLabel(army);
    }
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
