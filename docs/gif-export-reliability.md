# GIF export reliability implementation plan

Keep the workshop artwork and final GIF at 1600 × 1600, with the same front/back rotation and readable pauses. All processing remains in the browser; no upload service or on-chain changes.

## Parallel implementation

1. Encoder: quantize a bounded sample of the background and both faces once, reuse the palette for 60 frames, encode in a worker, and validate frame order and dimensions. Compare performance with the existing full-frame palette approach.
2. Lifecycle and compatibility: capture the shared card faces, render frames on a normal browser canvas, and transfer one frame at a time to the worker. Bound capture/loading, wait for acknowledgments with a stall timeout, report progress and actionable errors, and clean up on cancel, failure, and unmount.
3. Regression checks: cover palette reuse, frame order, dimensions, pause timing, errors, valid GIF output, and real encoder cost. Cover lifecycle timeouts and cancellation independently of live chain access.

Each parallel lane uses its own branch and worktree. Integrate only task files; preserve existing README and Move lockfile edits.

## Integration and acceptance

- Keep export disabled until profile loading succeeds and prevent overlapping runs.
- Keep output dimensions, artwork aspect ratio, face order, looping, and pauses unchanged.
- Verify ordinary canvas rendering removes the worker OffscreenCanvas/ImageBitmap requirement.
- Verify slow but progressing encoding is not cancelled by a fixed total-duration timer.
- Verify failed assets, unsupported features, stalled encoding, cancellation, and retries release resources and restore controls.
- Run frontend tests, GIF checks, lint, production build, and diff whitespace checks.
- Inspect a rendered GIF when browser tooling permits; explicitly record any physical-device coverage gap.
- Review the final staged diff, make one Conventional Commit, fetch upstream, confirm a non-divergent push, and push without rewriting history.

## Validation results

Completed in three isolated agent branches, then integrated into the current checkout.

- Palette: one bounded 256 × 768 sample using rgb565 precision. The initial rgb444 candidate showed excessive banding during visual inspection and was replaced before completion.
- `npm run test`: 3 mapper tests passed.
- `npm run lint`: passed with five existing warnings outside this change.
- `node scripts/check-card-gif.mjs`: worker protocol, bounded palette reuse, frame order, error cases, cancellation/timeouts/late-result cleanup, projection bounds, and real GIF checks passed. Final synthetic encoder run: 4.9 seconds, 23.4 MiB for 60 varied full-size frames (previous implementation: 47.5 seconds in the earlier review). These timings exclude actual browser capture/drawing and vary by machine.
- `npm run build`: passed.
- Headless Edge with a synthetic profile: complete download in 6.3 seconds, no page errors. Download decoded as 1600 × 1600, 60 frames, infinite loop, 800 ms front/back pauses. Front/back images and narrow-screen layout inspected.
- Mobile-width Edge with 4× CPU throttling and OffscreenCanvas/createImageBitmap disabled: complete export in 10.0 seconds. This is emulation, not a physical-phone measurement.
- Browser checks passed for empty/loading/error disabled states, missing Worker, missing background, cancel followed by successful retry, and a non-responsive worker using a shortened test timer. Stalled worker was terminated and controls restored.
- Cancellation also aborts image-capture asset fetches; non-cancellable capture results arriving late have their canvases released.
- An initial pre-integration browser probe timed out; it did not provide enough diagnostics to assign a device-specific cause. Final integrated checks above completed successfully.
- Physical iOS/Android hardware and Safari were not available. GIF still has a 256-color palette, so gradients and photographs may show some banding. Browser download permissions may differ.

## Export behavior

The button reports preparation and frame progress and offers Cancel. Each preparation stage and each worker acknowledgement has a 120-second stall limit; there is no fixed two-minute limit on an export that continues completing frames. A failed run shows its stage and a recovery suggestion. Export continues to require a successfully loaded profile, a regular 2D canvas, and Web Worker support.

Run checks from `web/`. Browser validation used temporary local scripts and a mocked profile; it made no chain writes or external uploads.
