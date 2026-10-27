/** Match the workshop artwork at its original square size. */
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

/** Marble base fill for canvas letterbox / html-to-image fallback. */
export const EXPORT_BACKGROUND = '#0f1a2b';

/** Capture-failure PNG stays dark so the error copy remains readable. */
export const EXPORT_ERROR_BACKGROUND = '#131318';
