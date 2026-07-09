export const DESKTOP_RESOLUTION = { width: 1280, height: 720 };
export const MOBILE_PORTRAIT_RESOLUTION = { width: 720, height: 1280 };
export const MOBILE_LANDSCAPE_RESOLUTION = { width: 1280, height: 720 };

export function getDeviceMode() {
  const isMobile = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
  return isMobile ? 'mobile' : 'desktop';
}

export function getViewportOrientation(viewport = {}) {
  return Number(viewport.width || 0) >= Number(viewport.height || 0) ? 'landscape' : 'portrait';
}

export function getEffectiveLayoutMode(deviceMode, orientation) {
  // Phones/tablets should use the portrait mobile UI while upright and the
  // existing 1280x720 landscape UI when physically rotated sideways.
  if (deviceMode === 'mobile' && orientation === 'landscape') return 'desktop';
  return deviceMode;
}

export function getDesignResolution(mode, orientation = 'portrait') {
  if (mode === 'mobile') {
    return orientation === 'landscape' ? MOBILE_LANDSCAPE_RESOLUTION : MOBILE_PORTRAIT_RESOLUTION;
  }

  return DESKTOP_RESOLUTION;
}
