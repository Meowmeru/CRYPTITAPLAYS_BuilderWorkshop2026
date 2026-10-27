/** Keep the GIF square; draw the workshop artwork across this canvas. */
export const EXPORT_WIDTH = 1600;
export const EXPORT_HEIGHT = 1600;
export const EXPORT_ASPECT_RATIO = 1;

/** The shared front and back faces in the still-picture export. */
export const PHOTO_WIDTH = 1080;
export const PHOTO_HEIGHT = 1350;

/**
 * Card width inside the export frame, scaled proportionally from the
 * original 1080px-wide composition.
 */
export const EXPORT_CARD_WIDTH = 780 * (1600 / 1080);

/** Match the Camera artwork if html-to-image needs a fallback fill. */
export const EXPORT_BACKGROUND = '#fcedf0';

/** Capture-failure PNG stays dark so the error copy remains readable. */
export const EXPORT_ERROR_BACKGROUND = '#131318';
