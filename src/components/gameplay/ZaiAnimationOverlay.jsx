export const ZAI_ANIMATION_DURATION_MS = 1500;
export const ZAI_ACTION_SUBMIT_MS = 400;

const ZAI_ASSET_BASE = `${import.meta.env.BASE_URL}zai/`;

const layers = {
  hand: `${ZAI_ASSET_BASE}layer1.png`,
  impactGlow: `${ZAI_ASSET_BASE}layer2.png`,
  speedLines: `${ZAI_ASSET_BASE}layer3.png`,
  debrisBack: `${ZAI_ASSET_BASE}layer4.png`,
  groundCrack: `${ZAI_ASSET_BASE}layer5.png`,
  debrisFront: `${ZAI_ASSET_BASE}layer6.png`,
  zaiKanji: `${ZAI_ASSET_BASE}layer7.png`,
  zaiText: `${ZAI_ASSET_BASE}layer8.png`,
  dice1: `${ZAI_ASSET_BASE}layer9.png`,
  dice2: `${ZAI_ASSET_BASE}layer10.png`,
  dice3: `${ZAI_ASSET_BASE}layer11.png`,
  dice4: `${ZAI_ASSET_BASE}layer12.png`,
  dice5: `${ZAI_ASSET_BASE}layer13.png`,
};

export default function ZaiAnimationOverlay({ active = false, runId = 0 }) {
  return (
    <div
      className={`zai-animation-overlay ${active ? 'is-active' : ''}`}
      aria-hidden="true"
      data-run-id={runId}
    >
      <div key={runId} className="zai-animation-overlay__stage">
        <img className="zai-layer zai-layer--speed-lines" src={layers.speedLines} alt="" draggable="false" />
        <img className="zai-layer zai-layer--impact-glow" src={layers.impactGlow} alt="" draggable="false" />
        <img className="zai-layer zai-layer--debris-back" src={layers.debrisBack} alt="" draggable="false" />
        <img className="zai-layer zai-layer--ground-crack" src={layers.groundCrack} alt="" draggable="false" />

        <img className="zai-layer zai-layer--hand" src={layers.hand} alt="" draggable="false" />

        <img className="zai-layer zai-layer--die zai-layer--die-1" src={layers.dice1} alt="" draggable="false" />
        <img className="zai-layer zai-layer--die zai-layer--die-2" src={layers.dice2} alt="" draggable="false" />
        <img className="zai-layer zai-layer--die zai-layer--die-3" src={layers.dice3} alt="" draggable="false" />
        <img className="zai-layer zai-layer--die zai-layer--die-4" src={layers.dice4} alt="" draggable="false" />
        <img className="zai-layer zai-layer--die zai-layer--die-5" src={layers.dice5} alt="" draggable="false" />

        <img className="zai-layer zai-layer--debris-front" src={layers.debrisFront} alt="" draggable="false" />
        <img className="zai-layer zai-layer--kanji" src={layers.zaiKanji} alt="" draggable="false" />
        <img className="zai-layer zai-layer--text" src={layers.zaiText} alt="" draggable="false" />
      </div>
    </div>
  );
}
