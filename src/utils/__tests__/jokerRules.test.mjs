import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_FEI_QUANTITY_STEP,
  getOfficialJokerCapabilities,
  shouldOfficialCountOnesAsWild,
  validateOfficialFeiSelection,
  validateOfficialZaiSelection,
} from '../jokerRules.js';

const currentBid = { quantity: 3, face: 3, jokerMode: 'zai', zai: true };

test('client accepts opening ZAI on faces 2-6 at the configured minimum', () => {
  const result = validateOfficialZaiSelection({ quantity: 3, face: 6, totalDice: 10, openingMinimum: 3 });
  assert.equal(result.valid, true);
});

test('client rejects explicit ZAI on face 1', () => {
  const result = validateOfficialZaiSelection({ quantity: 2, face: 1, totalDice: 10, openingMinimum: 2 });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'EXPLICIT_ZAI_ON_FACE_ONE');
});

test('client accepts same-claim and higher-claim ZAI', () => {
  const normalCurrent = { quantity: 4, face: 5 };
  assert.equal(validateOfficialZaiSelection({ currentBid: normalCurrent, quantity: 4, face: 5, totalDice: 10 }).valid, true);
  assert.equal(validateOfficialZaiSelection({ currentBid: normalCurrent, quantity: 4, face: 6, totalDice: 10 }).valid, true);
  assert.equal(validateOfficialZaiSelection({ currentBid: normalCurrent, quantity: 5, face: 2, totalDice: 10 }).valid, true);
});

test('client FEI allows any face from 1-6 and requires exactly +2 dice', () => {
  for (const face of [1, 2, 3, 4, 5, 6]) {
    const result = validateOfficialFeiSelection({
      currentBid,
      currentMode: 'zai',
      zaiActive: true,
      quantity: 3 + OFFICIAL_FEI_QUANTITY_STEP,
      face,
      totalDice: 10,
    });
    assert.equal(result.valid, true, `face ${face} should be legal`);
  }

  const plusOne = validateOfficialFeiSelection({ currentBid, currentMode: 'zai', zaiActive: true, quantity: 4, face: 6, totalDice: 10 });
  const plusThree = validateOfficialFeiSelection({ currentBid, currentMode: 'zai', zaiActive: true, quantity: 6, face: 1, totalDice: 10 });
  assert.equal(plusOne.code, 'FEI_QUANTITY_MISMATCH');
  assert.equal(plusThree.code, 'FEI_QUANTITY_MISMATCH');
});

test('client reports FEI unavailable when +2 exceeds total dice', () => {
  const caps = getOfficialJokerCapabilities({ currentBid: { quantity: 9, face: 4, jokerMode: 'zai', zai: true }, currentMode: 'zai', zaiActive: true, totalDice: 10 });
  assert.equal(caps.feiAvailable, false);
  assert.equal(caps.feiSameFaceRequired, false);
  assert.deepEqual(caps.feiAllowedFaces, [1, 2, 3, 4, 5, 6]);
});

test('client counting helper mirrors Joker ON/OFF state', () => {
  assert.equal(shouldOfficialCountOnesAsWild({ face: 4, currentMode: 'normal' }), true);
  assert.equal(shouldOfficialCountOnesAsWild({ face: 4, currentBid, currentMode: 'zai', zaiActive: true }), false);
  assert.equal(shouldOfficialCountOnesAsWild({ face: 4, currentMode: 'fei', feiActive: true }), true);
  assert.equal(shouldOfficialCountOnesAsWild({ face: 1, currentMode: 'normal' }), false);
});
