/**
 * Canonical client-side ZAI / FEI / Joker rules.
 *
 * These helpers mirror the official backend rules and are deliberately pure so
 * Gameplay, mock/tutorial mode, and future bot-facing UI cannot drift apart.
 */

export const OFFICIAL_FEI_QUANTITY_STEP = 2;
export const OFFICIAL_DICE_FACES = Object.freeze([1, 2, 3, 4, 5, 6]);
export const OFFICIAL_BID_FACE_ORDER = Object.freeze([2, 3, 4, 5, 6, 1]);

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function officialBidFaceRank(face) {
  const index = OFFICIAL_BID_FACE_ORDER.indexOf(asNumber(face, 0));
  return index >= 0 ? index : -1;
}

export function compareOfficialDiceClaim(current = {}, next = {}) {
  const currentQuantity = asNumber(current.quantity, 0);
  const nextQuantity = asNumber(next.quantity, 0);

  if (nextQuantity > currentQuantity) return 1;
  if (nextQuantity < currentQuantity) return -1;

  const currentRank = officialBidFaceRank(current.face);
  const nextRank = officialBidFaceRank(next.face);
  if (nextRank > currentRank) return 1;
  if (nextRank < currentRank) return -1;
  return 0;
}

export function normalizeOfficialJokerMode(source = {}) {
  const rawMode = String(
    source.jokerMode
      ?? source.currentJokerMode
      ?? source.wildMode
      ?? source.onesMode
      ?? '',
  ).trim().toLowerCase();

  if (
    source.fei === true
    || source.isFei === true
    || source.isFEI === true
    || source.feiActive === true
    || source.chai === true
    || source.isChai === true
    || source.chaiActive === true
    || ['fei', 'chai', 'joker_on', 'wild_on'].includes(rawMode)
  ) return 'fei';

  if (
    source.zai === true
    || source.isZai === true
    || source.zaiActive === true
    || source.zaiDeclared === true
    || source.zaiInherited === true
    || source.zaiTriggeredByFaceOne === true
    || Number(source.face) === 1
    || ['zai', 'zai_locked', 'ones_locked', 'joker_off', 'wild_off'].includes(rawMode)
  ) return 'zai';

  return 'normal';
}

export function isOfficialZaiState({
  currentBid = null,
  currentMode = 'normal',
  zaiActive = false,
  feiActive = false,
} = {}) {
  const normalizedMode = normalizeOfficialJokerMode({
    ...(currentBid || {}),
    jokerMode: currentMode,
    zaiActive,
    feiActive,
  });
  return normalizedMode === 'zai';
}

export function shouldOfficialCountOnesAsWild({
  face,
  currentBid = null,
  currentMode = 'normal',
  zaiActive = false,
  feiActive = false,
  wildDice = true,
} = {}) {
  const targetFace = Math.trunc(asNumber(face, 0));
  if (wildDice === false || targetFace === 1 || targetFace < 1 || targetFace > 6) return false;
  return !isOfficialZaiState({ currentBid, currentMode, zaiActive, feiActive });
}

function invalid(code, details = {}) {
  return { valid: false, code, ...details };
}

export function validateOfficialZaiSelection({
  currentBid = null,
  quantity,
  face,
  currentMode = 'normal',
  zaiActive = false,
  feiActive = false,
  faceOneTriggeredZaiThisRound = false,
  totalDice = 0,
  openingMinimum = 1,
  zaiEnabled = true,
} = {}) {
  const nextQuantity = Math.trunc(asNumber(quantity, 0));
  const nextFace = Math.trunc(asNumber(face, 0));
  const safeTotalDice = Math.max(0, Math.trunc(asNumber(totalDice, 0)));

  if (zaiEnabled === false) return invalid('ZAI_DISABLED');
  if (nextFace < 1 || nextFace > 6) return invalid('INVALID_FACE');
  if (nextQuantity < 1) return invalid('INVALID_QUANTITY');
  if (safeTotalDice > 0 && nextQuantity > safeTotalDice) return invalid('EXCEEDS_TOTAL_DICE');
  if (nextFace === 1) return invalid('EXPLICIT_ZAI_ON_FACE_ONE');
  if (faceOneTriggeredZaiThisRound === true) return invalid('ZAI_BLOCKED_AFTER_FACE_ONE');

  if (isOfficialZaiState({ currentBid, currentMode, zaiActive, feiActive })) {
    return invalid('ZAI_ALREADY_ACTIVE');
  }

  if (!currentBid) {
    const minimumQuantity = Math.max(1, Math.trunc(asNumber(openingMinimum, 1)));
    if (nextQuantity < minimumQuantity) {
      return invalid('OPENING_ZAI_TOO_LOW', { minimumQuantity, requiredFace: nextFace });
    }
    return { valid: true, code: 'VALID_OPENING_ZAI' };
  }

  if (compareOfficialDiceClaim(currentBid, { quantity: nextQuantity, face: nextFace }) < 0) {
    return invalid('ZAI_LOWER_THAN_CURRENT');
  }

  return { valid: true, code: 'VALID_ZAI' };
}

export function validateOfficialFeiSelection({
  currentBid = null,
  quantity,
  face,
  currentMode = 'normal',
  zaiActive = false,
  feiActive = false,
  totalDice = 0,
  feiEnabled = true,
} = {}) {
  const nextQuantity = Math.trunc(asNumber(quantity, 0));
  const nextFace = Math.trunc(asNumber(face, 0));
  const safeTotalDice = Math.max(0, Math.trunc(asNumber(totalDice, 0)));
  const requiredQuantity = Math.trunc(asNumber(currentBid?.quantity, 0)) + OFFICIAL_FEI_QUANTITY_STEP;
  const details = {
    requiredQuantity,
    // Legacy alias retained for older UI consumers.
    minimumQuantity: requiredQuantity,
    allowedFaces: OFFICIAL_DICE_FACES,
  };

  if (feiEnabled === false) return invalid('FEI_DISABLED');
  if (!currentBid || !isOfficialZaiState({ currentBid, currentMode, zaiActive, feiActive })) {
    return invalid('FEI_REQUIRES_ZAI');
  }
  if (nextFace < 1 || nextFace > 6) return invalid('INVALID_FACE', details);
  if (safeTotalDice > 0 && requiredQuantity > safeTotalDice) {
    return invalid('FEI_UNAVAILABLE_MAX_DICE', details);
  }
  if (nextQuantity !== requiredQuantity) {
    return invalid('FEI_QUANTITY_MISMATCH', details);
  }
  if (safeTotalDice > 0 && nextQuantity > safeTotalDice) {
    return invalid('EXCEEDS_TOTAL_DICE', details);
  }

  return {
    valid: true,
    code: 'VALID_FEI',
    ...details,
  };
}

export function getOfficialSpecialActionMode({ currentBid = null, currentMode = 'normal' } = {}) {
  return currentBid && normalizeOfficialJokerMode({ ...(currentBid || {}), jokerMode: currentMode }) === 'zai'
    ? 'fei'
    : 'zai';
}

export function getOfficialDefaultBid({ currentBid = null, totalDice = 1, currentMode = 'normal' } = {}) {
  const safeTotalDice = Math.max(1, Math.trunc(asNumber(totalDice, 1)));
  if (!currentBid) return { quantity: 1, face: 1, source: 'opening_default' };

  const currentQuantity = Math.max(1, Math.trunc(asNumber(currentBid.quantity, 1)));
  const currentFace = Math.min(6, Math.max(1, Math.trunc(asNumber(currentBid.face, 1))));
  const specialMode = getOfficialSpecialActionMode({ currentBid, currentMode });
  const minimumFeiQuantity = currentQuantity + OFFICIAL_FEI_QUANTITY_STEP;

  if (specialMode === 'fei' && minimumFeiQuantity <= safeTotalDice) {
    return {
      quantity: minimumFeiQuantity,
      face: currentFace,
      source: 'suggested_legal_fei',
    };
  }

  const currentRank = officialBidFaceRank(currentFace);
  if (currentRank >= 0 && currentRank < OFFICIAL_BID_FACE_ORDER.length - 1) {
    return {
      quantity: currentQuantity,
      face: OFFICIAL_BID_FACE_ORDER[currentRank + 1],
      source: 'next_higher_face',
    };
  }

  return {
    quantity: Math.min(currentQuantity + 1, safeTotalDice),
    face: OFFICIAL_BID_FACE_ORDER[0],
    source: 'next_higher_quantity',
  };
}

export function getOfficialJokerCapabilities({
  currentBid = null,
  currentMode = 'normal',
  zaiActive = false,
  feiActive = false,
  faceOneTriggeredZaiThisRound = false,
  totalDice = 0,
  zaiEnabled = true,
  feiEnabled = true,
} = {}) {
  const zaiStateActive = isOfficialZaiState({ currentBid, currentMode, zaiActive, feiActive });
  const safeTotalDice = Math.max(0, Math.trunc(asNumber(totalDice, 0)));
  const feiRequiredQuantity = currentBid
    ? Math.trunc(asNumber(currentBid.quantity, 0)) + OFFICIAL_FEI_QUANTITY_STEP
    : null;
  const zaiAvailable = Boolean(
    zaiEnabled !== false
      && faceOneTriggeredZaiThisRound !== true
      && !zaiStateActive,
  );
  const feiRequiredToReopenJoker = Boolean(currentBid && zaiStateActive);
  const feiAvailable = Boolean(
    feiEnabled !== false
      && feiRequiredToReopenJoker
      && feiRequiredQuantity !== null
      && feiRequiredQuantity <= safeTotalDice,
  );

  return {
    zaiStateActive,
    zaiAvailable,
    canDeclareZai: zaiAvailable,
    zaiOpeningAllowed: Boolean(zaiAvailable && !currentBid),
    zaiSameBidAllowed: Boolean(zaiAvailable && currentBid),
    zaiHigherBidAllowed: zaiAvailable,
    zaiBlockedAfterFaceOne: faceOneTriggeredZaiThisRound === true,
    feiRequiredToReopenJoker,
    feiAvailable,
    canDeclareFei: feiAvailable,
    feiRequiredQuantity,
    // Legacy name retained; FEI now requires this exact quantity, not a minimum.
    feiMinQuantity: feiRequiredQuantity,
    feiFace: null,
    feiAllowedFaces: OFFICIAL_DICE_FACES,
    feiQuantityStep: OFFICIAL_FEI_QUANTITY_STEP,
    feiSameFaceRequired: false,
    feiExactQuantityRequired: true,
  };
}
