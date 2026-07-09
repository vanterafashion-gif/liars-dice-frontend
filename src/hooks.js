import { useEffect, useState } from 'react';
import { getDesignResolution, getDeviceMode, getEffectiveLayoutMode, getViewportOrientation } from './utils/resolution.js';

const SAFARI_EXCLUSION_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg|OPR|SamsungBrowser/i;
const CHROME_PATTERN = /CriOS|Chrome|Chromium/i;
const CHROME_EXCLUSION_PATTERN = /FxiOS|EdgiOS|OPiOS|Edg|OPR|SamsungBrowser/i;

let lastStableMobileViewport = null;
let lastStableMobileOrientation = '';

function isSafariBrowser() {
  const userAgent = window.navigator.userAgent || '';
  const vendor = window.navigator.vendor || '';
  return /Safari/i.test(userAgent)
    && /Apple/i.test(vendor)
    && !SAFARI_EXCLUSION_PATTERN.test(userAgent);
}

function isChromeBrowser() {
  const userAgent = window.navigator.userAgent || '';
  return CHROME_PATTERN.test(userAgent)
    && !CHROME_EXCLUSION_PATTERN.test(userAgent);
}

function getBrowserName() {
  if (isSafariBrowser()) return 'safari';
  if (isChromeBrowser()) return 'chrome';
  return '';
}

function getBaseViewportSize() {
  return {
    // Do not use window.visualViewport here.
    // On mobile, visualViewport height changes when the keyboard opens,
    // which recalculates scale and pushes/squeezes the game canvas.
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

function isEditableElement(element) {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || element.isContentEditable;
}

function isMobileKeyboardLikelyOpen(deviceMode, browserName, viewport) {
  if (deviceMode !== 'mobile' || !shouldUseVisualViewport(browserName)) return false;

  const visualViewport = window.visualViewport;
  const baseViewport = getBaseViewportSize();
  const activeEditable = isEditableElement(document.activeElement);
  const visualHeight = Number(visualViewport?.height || viewport?.height || 0);
  const baseHeight = Number(baseViewport.height || 0);
  const keyboardConsumesViewport = baseHeight > 0 && visualHeight > 0 && baseHeight - visualHeight > 80;

  return activeEditable || keyboardConsumesViewport;
}

function getVisualViewportSize() {
  const visualViewport = window.visualViewport;
  const documentElement = document.documentElement;
  const fallbackViewport = getBaseViewportSize();

  return {
    // iOS Safari and iOS Chrome can report 100vh / innerHeight as the larger
    // layout viewport while the visible area is smaller because of the browser
    // chrome. visualViewport gives the real visible space, so the fixed game
    // frame scales against what the user can actually see.
    width: Math.floor(visualViewport?.width || fallbackViewport.width || documentElement.clientWidth),
    height: Math.floor(visualViewport?.height || documentElement.clientHeight || fallbackViewport.height),
  };
}

function shouldUseVisualViewport(browserName) {
  return browserName === 'safari' || browserName === 'chrome';
}

function getViewportSize(browserName) {
  return shouldUseVisualViewport(browserName) ? getVisualViewportSize() : getBaseViewportSize();
}

function applyViewportCssVariables(viewport, browserName) {
  const root = document.documentElement;

  if (browserName) {
    root.dataset.browser = browserName;
  } else {
    delete root.dataset.browser;
  }

  if (shouldUseVisualViewport(browserName)) {
    root.style.setProperty('--app-viewport-width', `${viewport.width}px`);
    root.style.setProperty('--app-viewport-height', `${viewport.height}px`);
    return;
  }

  root.style.removeProperty('--app-viewport-width');
  root.style.removeProperty('--app-viewport-height');
}

function computeLayout() {
  const deviceMode = getDeviceMode();
  const browserName = getBrowserName();
  const isSafari = browserName === 'safari';
  const measuredViewport = getViewportSize(browserName);
  const measuredOrientation = getViewportOrientation(measuredViewport);
  const keyboardOpen = isMobileKeyboardLikelyOpen(deviceMode, browserName, measuredViewport);

  let viewport = measuredViewport;
  let orientation = measuredOrientation;

  if (deviceMode === 'mobile' && keyboardOpen) {
    if (lastStableMobileViewport && lastStableMobileOrientation === measuredOrientation) {
      viewport = lastStableMobileViewport;
      orientation = lastStableMobileOrientation;
    } else {
      const baseViewport = getBaseViewportSize();
      viewport = baseViewport.width && baseViewport.height ? baseViewport : measuredViewport;
      orientation = getViewportOrientation(viewport);
    }
  } else if (deviceMode === 'mobile') {
    lastStableMobileViewport = measuredViewport;
    lastStableMobileOrientation = measuredOrientation;
  }

  const mode = getEffectiveLayoutMode(deviceMode, orientation);
  const resolution = getDesignResolution(mode, orientation);
  const scale = Math.min(viewport.width / resolution.width, viewport.height / resolution.height);

  return { mode, deviceMode, resolution, viewport, scale, orientation, isSafari, browserName, keyboardOpen };
}

export function useFixedViewport() {
  const [layout, setLayout] = useState(() => computeLayout());

  useEffect(() => {
    let animationFrame = 0;
    const delayedUpdates = new Set();

    const runUpdate = () => {
      const nextLayout = computeLayout();
      applyViewportCssVariables(nextLayout.viewport, nextLayout.browserName);
      setLayout(nextLayout);
    };

    const update = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        runUpdate();
      });
    };

    const updateAfterBrowserChromeSettles = () => {
      update();

      // iOS Chrome/Safari landscape updates visualViewport in phases while the
      // address/tool bars animate. Rechecking a few times prevents stale scale
      // values and keeps the 1280x720 landscape frame aligned.
      [80, 240, 520].forEach((delay) => {
        const timerId = window.setTimeout(() => {
          delayedUpdates.delete(timerId);
          update();
        }, delay);
        delayedUpdates.add(timerId);
      });
    };

    const visualViewport = window.visualViewport;

    const handleFocusChange = () => {
      update();
      const timerId = window.setTimeout(() => {
        delayedUpdates.delete(timerId);
        update();
      }, 180);
      delayedUpdates.add(timerId);
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', updateAfterBrowserChromeSettles);
    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);

    updateAfterBrowserChromeSettles();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      delayedUpdates.forEach((timerId) => window.clearTimeout(timerId));
      delayedUpdates.clear();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', updateAfterBrowserChromeSettles);
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--app-viewport-width');
      document.documentElement.style.removeProperty('--app-viewport-height');
      delete document.documentElement.dataset.browser;
    };
  }, []);

  return layout;
}
