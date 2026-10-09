import { EXPORT_WIDTH, EXPORT_HEIGHT, EXPORT_CARD_WIDTH } from './cardPhotoExport';

export const GIF_FRAMES = 60;

/** Bound each stage and release non-cancellable results arriving after cancellation. */
export function exportStage<T>(work: Promise<T>, signal: AbortSignal, message: string,
  timeout = 120000, discard?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value as T);
    };
    const abort = () => finish(new DOMException('Export cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error(message)), timeout);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    work.then(value => {
      if (settled) discard?.(value);
      else finish(undefined, value);
    }, error => finish(error instanceof Error ? error : new Error(message)));
  });
}

export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

export function drawGifFrame(ctx: CanvasRenderingContext2D, front: HTMLCanvasElement,
  back: HTMLCanvasElement, background: HTMLImageElement, frame: number) {
  ctx.fillStyle = '#b245ef';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.drawImage(background, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  const angle = frame / GIF_FRAMES * Math.PI * 2;
  const cosine = Math.cos(angle);
  const face = cosine >= 0 ? front : back;
  const cardHeight = EXPORT_CARD_WIDTH / 1.56;
  for (let x = 0; x < EXPORT_CARD_WIDTH; x += 2) {
    const project = (position: number) => {
      const local = position - EXPORT_CARD_WIDTH / 2;
      const depth = local * Math.sin(angle) * (cosine >= 0 ? 1 : -1);
      const perspective = EXPORT_CARD_WIDTH * (1600 / 780);
      const scale = perspective / (perspective + depth);
      return { x: EXPORT_WIDTH / 2 + local * Math.abs(cosine) * scale, scale };
    };
    const left = project(x);
    const stripWidth = Math.min(2, EXPORT_CARD_WIDTH - x);
    const right = project(x + stripWidth);
    const height = cardHeight * left.scale;
    ctx.drawImage(face, x / EXPORT_CARD_WIDTH * face.width, 0,
      stripWidth / EXPORT_CARD_WIDTH * face.width, face.height,
      left.x, (EXPORT_HEIGHT - height) / 2, Math.max(0.3, right.x - left.x + 0.4), height);
  }
}
