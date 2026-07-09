import {
  ASSET_GROUPS,
  getAssetGroup,
  getAssetsForScreen,
} from '../config/assetsManifest.js';

export const CRITICAL_ASSETS = ASSET_GROUPS;

export function getCriticalAssets(screenName) {
  return getAssetGroup(screenName);
}

export function getPreloadAssetsForScreen(screenName) {
  return getAssetsForScreen(screenName);
}
