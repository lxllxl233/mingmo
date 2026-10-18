export class ContentError extends Error {
  constructor(
    readonly file: string,
    readonly path: string,
    message: string,
  ) {
    super(`${file}:${path}: ${message}`);
    this.name = 'ContentError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, file: string, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ContentError(file, path, 'expected object');
  return value;
}

export function asArray(value: unknown, file: string, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ContentError(file, path, 'expected array');
  return value;
}
