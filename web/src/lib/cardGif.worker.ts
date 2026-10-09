import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { EXPORT_WIDTH, EXPORT_HEIGHT } from './cardPhotoExport';

const FRAME_COUNT = 60;
const MAX_SAMPLE_BYTES = 256 * 768 * 4;
let gif: ReturnType<typeof GIFEncoder> | undefined;
let palette: number[][] | undefined;
let completed = 0;
let failed = false;
let finished = false;

self.onmessage = ({ data }: MessageEvent<unknown>) => {
  if (failed) return;
  try {
    if (!data || typeof data !== 'object' || !('type' in data)) {
      throw new Error('The GIF encoder received an invalid request. Reload the page and try again.');
    }
    if (finished) throw new Error('The GIF export has already finished.');
    switch (data.type) {
      case 'init': {
        if (gif) throw new Error('The GIF encoder has already started.');
        if (!('samples' in data) || !(data.samples instanceof ArrayBuffer)
          || data.samples.byteLength === 0 || data.samples.byteLength % 4 !== 0
          || data.samples.byteLength > MAX_SAMPLE_BYTES) {
          throw new Error('The GIF color sample is invalid. Reload the page and try again.');
        }
        // One small shared palette avoids analyzing every full-size frame again.
        palette = quantize(new Uint8Array(data.samples), 256);
        gif = GIFEncoder();
        self.postMessage({ type: 'ready' });
        break;
      }
      case 'frame': {
        if (!gif || !palette) throw new Error('The GIF encoder is not ready.');
        if (!('index' in data) || data.index !== completed || completed >= FRAME_COUNT) {
          throw new Error('The GIF frames arrived out of order. Please start a new export.');
        }
        if (!('pixels' in data) || !(data.pixels instanceof ArrayBuffer)
          || data.pixels.byteLength !== EXPORT_WIDTH * EXPORT_HEIGHT * 4) {
          throw new Error('A GIF frame has the wrong dimensions. Please start a new export.');
        }
        const pixels = new Uint8Array(data.pixels);
        gif.writeFrame(applyPalette(pixels, palette), EXPORT_WIDTH, EXPORT_HEIGHT, {
          palette: completed === 0 ? palette : undefined,
          delay: completed === 0 || completed === FRAME_COUNT / 2 ? 800 : 70,
          repeat: 0,
        });
        completed++;
        self.postMessage({ type: 'progress', completed, total: FRAME_COUNT });
        break;
      }
      case 'finish': {
        if (!gif || completed !== FRAME_COUNT) {
          throw new Error('The GIF export is missing frames. Please start a new export.');
        }
        gif.finish();
        self.postMessage({ type: 'complete', blob: new Blob([gif.bytesView()], { type: 'image/gif' }) });
        finished = true;
        gif = undefined;
        palette = undefined;
        break;
      }
      default:
        throw new Error('The GIF encoder received an unknown request. Reload the page and try again.');
    }
  } catch (error) {
    failed = true;
    gif = undefined;
    palette = undefined;
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'GIF encoding failed. Close other tabs and try again.',
    });
  }
};
