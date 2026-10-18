import { Application, Container, Graphics, Point, Text, TextStyle } from 'pixi.js';
import type { ContentIndex, MapGeo } from '../../content/types';
import type { GameState } from '../../engine/state/types';

type SelectHandler = (provinceId: string) => void;

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
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

const MAJOR_LABELS = new Set([
  'beijing', 'nanjing', 'xian', 'shenyang', 'suzhou', 'hangzhou', 'wuchang',
  'chengdu', 'chongqing', 'guangzhou', 'fuzhou', 'quanzhou', 'kaifeng',
  'taiyuan', 'datong', 'shanhaiguan', 'ningyuan', 'jinzhou', 'liaoyang',
  'hanseong', 'edo', 'lhasa', 'albazin', 'anping', 'penghu',
]);

export class MapRenderer {
  private app: Application | null = null;
  private world = new Container();
  private fillLayer = new Graphics();
  private selectionLayer = new Graphics();
  private armyLayer = new Container();
  private labelLayer = new Container();
  private projected = new Map<string, number[]>();
  private centroids = new Map<string, { x: number; y: number }>();
  private labels = new Map<string, Text>();
  private armyMarkers = new Map<string, Container>();
  private state: GameState | null = null;
  private selectedProvince: string | null = null;
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
    private readonly onSelect: SelectHandler,
  ) {}

  async init(): Promise<void> {
    const app = new Application();
    await app.init({
      background: 0xe9e1d0,
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

    this.world.addChild(this.fillLayer, this.selectionLayer, this.labelLayer, this.armyLayer);
    app.stage.addChild(this.world);
    this.prepareGeometry();
    this.fit();
    this.bindPointer();
  }

  private prepareGeometry(): void {
    const [minLon, minLat, maxLon, maxLat] = this.geo.bounds;
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
    }
    void minLat;
    void maxLon;

    for (const [id, label] of this.labels) {
      label.destroy();
      this.labels.delete(id);
    }
    for (const id of MAJOR_LABELS) {
      const centroid = this.centroids.get(id);
      const province = this.content.provinces.get(id);
      if (!centroid || !province) continue;
      const text = new Text({
        text: province.name,
        style: new TextStyle({
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif',
          fontSize: 0.55,
          fill: 0x1f1c18,
          stroke: { color: 0xf2ead8, width: 0.1 },
        }),
      });
      text.anchor.set(0.5);
      text.position.set(centroid.x, centroid.y);
      this.labelLayer.addChild(text);
      this.labels.set(id, text);
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
    this.updateLabelScale();
  }

  private updateLabelScale(): void {
    const scale = this.world.scale.x;
    const visible = scale > 13;
    for (const label of this.labels.values()) label.visible = visible;
    for (const marker of this.armyMarkers.values()) marker.scale.set(Math.max(0.7, 10 / scale));
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
      if (!this.dragging) return;
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
      this.updateLabelScale();
    };
    app.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
    app.renderer.on('resize', () => this.fit());
  }

  private pick(screenX: number, screenY: number): void {
    if (!this.app) return;
    const local = this.world.toLocal(new Point(screenX, screenY));
    for (const [id, points] of this.projected) {
      if (pointInPolygon(local.x, local.y, points)) {
        this.onSelect(id);
        return;
      }
    }
  }

  private colorOf(tag: string): number {
    const color = this.content.countries.get(tag)?.color ?? '#7a7468';
    return hexToNumber(color);
  }

  setState(state: GameState, selectedProvince: string | null): void {
    this.state = state;
    this.selectedProvince = selectedProvince;
    const signature = Object.values(state.provinces)
      .map(province => `${province.id}:${province.controller}`)
      .join('|');
    if (signature !== this.ownerSignature || !this.hasDrawn) {
      this.ownerSignature = signature;
      this.redrawFills();
    }
    this.drawSelection();
    this.updateArmies();
  }

  private redrawFills(): void {
    if (!this.state || this.projected.size === 0) return;
    this.fillLayer.clear();
    for (const [id, points] of this.projected) {
      const province = this.state.provinces[id];
      const color = this.colorOf(province?.controller ?? 'NEU');
      this.fillLayer.poly(points).fill({ color, alpha: 0.88 }).stroke({ width: 0.055, color: 0x3b3228, alpha: 0.75 });
    }
    this.hasDrawn = true;
  }

  private drawSelection(): void {
    this.selectionLayer.clear();
    if (!this.selectedProvince) return;
    const points = this.projected.get(this.selectedProvince);
    if (!points) return;
    this.selectionLayer.poly(points).stroke({ width: 0.22, color: 0xffd27a, alpha: 1 });
  }

  private ensureArmyMarker(id: string): Container {
    const existing = this.armyMarkers.get(id);
    if (existing) return existing;
    const container = new Container();
    const box = new Graphics();
    box.rect(-0.42, -0.24, 0.84, 0.48).fill({ color: 0x1f1c18, alpha: 0.85 }).stroke({ width: 0.04, color: 0xf2ead8 });
    const label = new Text({
      text: '',
      style: new TextStyle({ fontFamily: 'serif', fontSize: 0.34, fill: 0xf2ead8 }),
    });
    label.anchor.set(0.5);
    label.name = 'label';
    container.addChild(box, label);
    this.armyLayer.addChild(container);
    this.armyMarkers.set(id, container);
    return container;
  }

  private updateArmies(): void {
    if (!this.state) return;
    const byProvince = new Map<string, number>();
    const alive = new Set<string>();
    for (const army of Object.values(this.state.armies)) {
      const centroid = this.centroids.get(army.province);
      if (!centroid) continue;
      alive.add(army.id);
      const marker = this.ensureArmyMarker(army.id);
      const index = byProvince.get(army.province) ?? 0;
      byProvince.set(army.province, index + 1);
      const offset = index * 0.5;
      marker.position.set(centroid.x + offset, centroid.y - offset);
      const label = marker.getChildByName('label');
      if (label instanceof Text) {
        const strength = army.composition.infantry + army.composition.firearm
          + army.composition.cavalry + army.composition.artillery + army.composition.naval;
        label.text = `${Math.round(strength / 100) / 10}k`;
      }
    }
    for (const [id, marker] of this.armyMarkers) {
      if (!alive.has(id)) {
        marker.destroy({ children: true });
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
