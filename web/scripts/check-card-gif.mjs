import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const code = transpile(readFileSync(new URL('../src/lib/cardGif.worker.ts', import.meta.url), 'utf8'));
const settings = {};
vm.runInNewContext(transpile(readFileSync(new URL('../src/lib/cardPhotoExport.ts', import.meta.url), 'utf8')), { exports: settings });
const width = 1600;
const height = 1600;
const total = 60;
const sampleBytes = 256 * 768 * 4;

function createWorker(encoder) {
  const messages = [];
  const worker = { postMessage: message => messages.push(message) };
  vm.runInNewContext(code, {
    exports: {}, self: worker, Blob, ArrayBuffer, Uint8Array, Uint8ClampedArray,
    require: name => name === './cardPhotoExport' ? settings : encoder,
  });
  return data => {
    const before = messages.length;
    worker.onmessage({ data });
    assert.equal(messages.length, before + 1, 'Every request must receive one acknowledgement or error');
    return messages.at(-1);
  };
}

let paletteCalls = 0;
const frames = [];
const palette = [[0, 0, 0], [255, 255, 255]];
const mockEncoder = {
  quantize(pixels, colors, options) {
    paletteCalls++;
    assert.ok(pixels.byteLength <= sampleBytes);
    assert.equal(colors, 256);
    assert.equal(options, undefined);
    return palette;
  },
  applyPalette(pixels, actualPalette, format) {
    assert.equal(pixels.byteLength, width * height * 4);
    assert.equal(actualPalette, palette);
    assert.equal(format, undefined);
    return new Uint8Array(1);
  },
  GIFEncoder: () => ({
    writeFrame: (...args) => frames.push(args),
    finish() {},
    bytesView: () => new Uint8Array([71, 73, 70]),
  }),
};
const send = createWorker(mockEncoder);
assert.equal(send({ type: 'init', samples: new ArrayBuffer(sampleBytes) }).type, 'ready');
const pixels = new ArrayBuffer(width * height * 4);
for (let index = 0; index < total; index++) {
  const progress = send({ type: 'frame', pixels, index });
  assert.equal(progress.type, 'progress');
  assert.equal(progress.completed, index + 1);
  assert.equal(progress.total, total);
}
const complete = send({ type: 'finish' });
assert.equal(complete.type, 'complete');
assert.equal(complete.blob.type, 'image/gif');
assert.equal(paletteCalls, 1, 'Quantize the samples once, never each full-size frame');
assert.equal(frames.length, total);
for (let index = 0; index < frames.length; index++) {
  const [, actualWidth, actualHeight, options] = frames[index];
  assert.equal(actualWidth, width);
  assert.equal(actualHeight, height);
  assert.equal(options.palette, index === 0 ? palette : undefined);
  assert.equal(options.repeat, 0);
  assert.equal(options.delay, index === 0 || index === 30 ? 800 : 70);
}

for (const invalid of [
  { type: 'init', samples: new ArrayBuffer(0) },
  { type: 'init', samples: new ArrayBuffer(3) },
  { type: 'init', samples: new ArrayBuffer(sampleBytes + 4) },
  { type: 'frame', pixels, index: 0 },
  { type: 'finish' },
]) {
  const result = createWorker(mockEncoder)(invalid);
  assert.equal(result.type, 'error');
  assert.ok(result.error);
}
for (const invalid of [
  { type: 'frame', pixels: new ArrayBuffer(4), index: 0 },
  { type: 'frame', pixels, index: 1 },
  { type: 'init', samples: new ArrayBuffer(4) },
  { type: 'finish' },
]) {
  const request = createWorker(mockEncoder);
  request({ type: 'init', samples: new ArrayBuffer(4) });
  const result = request(invalid);
  assert.equal(result.type, 'error');
  assert.ok(result.error);
}
console.log('GIF worker checks passed: one bounded palette, 60 acknowledged frames, dimensions, looping, pauses, and invalid sequencing.');

// Real full-size encoding catches costs hidden by mocks; timing is reported, not tied to this machine's speed.
const real = createWorker(createRequire(import.meta.url)('gifenc'));
const rgba = new Uint8Array(width * height * 4);
function fillFrame(frame) {
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = (i + frame * 3) % 256;
    rgba[i * 4 + 1] = ((i >> 4) + frame * 5) % 256;
    rgba[i * 4 + 2] = ((i >> 8) + frame * 7) % 256;
    rgba[i * 4 + 3] = 255;
  }
}
fillFrame(0);
const started = performance.now();
assert.equal(real({ type: 'init', samples: rgba.slice(0, sampleBytes).buffer }).type, 'ready');
for (let index = 0; index < total; index++) {
  fillFrame(index);
  assert.equal(real({ type: 'frame', pixels: rgba.buffer, index }).type, 'progress');
}
const result = real({ type: 'finish' });
assert.equal(result.type, 'complete', result.error);
const bytes = new Uint8Array(await result.blob.arrayBuffer());
assert.equal(new TextDecoder().decode(bytes.slice(0, 6)), 'GIF89a');
assert.equal(bytes[6] | bytes[7] << 8, width);
assert.equal(bytes[8] | bytes[9] << 8, height);
assert.equal(bytes.at(-1), 0x3b);
console.log(`Real encoder: 60 full-size frames in ${((performance.now() - started) / 1000).toFixed(1)}s, ${(bytes.length / 1048576).toFixed(1)} MiB.`);

const lifecycle = {};
vm.runInNewContext(transpile(readFileSync(new URL('../src/lib/cardGifExport.ts', import.meta.url), 'utf8')), {
  exports: lifecycle, setTimeout, clearTimeout, DOMException, Error,
  require: () => settings,
});
const { exportStage, drawGifFrame, releaseCanvas } = lifecycle;
const controller = new AbortController();
assert.equal(await exportStage(Promise.resolve('ready'), controller.signal, 'timed out', 20), 'ready');
const expectedError = new Error('Asset failed');
await assert.rejects(exportStage(Promise.reject(expectedError), controller.signal, 'timed out', 20), error => error === expectedError);
await assert.rejects(exportStage(new Promise(() => {}), controller.signal, 'Stage timed out', 1), /Stage timed out/);
let resolveLate;
const pending = new Promise(resolve => { resolveLate = resolve; });
let discarded;
const cancelled = exportStage(pending, controller.signal, 'timed out', 100, value => { discarded = value; });
controller.abort();
await assert.rejects(cancelled, { name: 'AbortError' });
resolveLate('late canvas');
await Promise.resolve();
assert.equal(discarded, 'late canvas', 'A late capture result must be released after cancellation');
await assert.rejects(exportStage(Promise.resolve('already cancelled'), controller.signal, 'timed out', 20), { name: 'AbortError' });
let resolveTimedOut;
const lateAfterTimeout = new Promise(resolve => { resolveTimedOut = resolve; });
let timeoutDiscarded = false;
await assert.rejects(exportStage(lateAfterTimeout, new AbortController().signal, 'Slow asset', 1, () => { timeoutDiscarded = true; }), /Slow asset/);
resolveTimedOut({});
await Promise.resolve();
assert.equal(timeoutDiscarded, true, 'A late capture result must be released after timeout');

const front = { name: 'front', width: 1170, height: 750 };
const back = { name: 'back', width: 1170, height: 750 };
const background = { name: 'background' };
for (let frame = 0; frame < total; frame++) {
  const draws = [];
  const context = { fillRect() {}, drawImage: (...args) => draws.push(args) };
  drawGifFrame(context, front, back, background, frame);
  assert.deepEqual(draws[0], [background, 0, 0, width, height]);
  const face = Math.cos(frame / total * Math.PI * 2) >= 0 ? front : back;
  for (const [image, sx, sy, sw, sh, dx, dy, dw, dh] of draws.slice(1)) {
    assert.equal(image, face);
    assert.ok([sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isFinite));
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= image.width + 0.001 && sy + sh <= image.height);
    assert.ok(dx >= 0 && dy >= 0 && dx + dw <= width && dy + dh <= height);
  }
}
const captured = { width: 1170, height: 750 };
releaseCanvas(captured);
assert.deepEqual(captured, { width: 0, height: 0 });
console.log('GIF lifecycle checks passed: completion, rejection, stalled timeout, cancellation, late cleanup, front/back projection, canvas bounds and release.');
