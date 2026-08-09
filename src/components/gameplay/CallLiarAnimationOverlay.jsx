export const CALL_LIAR_ANIMATION_DURATION_MS = 1380;
export const CALL_LIAR_ACTION_SUBMIT_MS = 320;

const CALL_LIAR_ASSET_BASE = `${import.meta.env.BASE_URL}call-liar/`;

const layers = {
  crater: `${CALL_LIAR_ASSET_BASE}layer1.png`,
  impactGlow: `${CALL_LIAR_ASSET_BASE}layer2.png`,
  speedLines: `${CALL_LIAR_ASSET_BASE}layer3.png`,
  debrisBack: `${CALL_LIAR_ASSET_BASE}layer4.png`,
  debrisFront: `${CALL_LIAR_ASSET_BASE}layer5.png`,
  diceLeft: `${CALL_LIAR_ASSET_BASE}layer6.png`,
  diceRight: `${CALL_LIAR_ASSET_BASE}layer7.png`,
  diceFront: `${CALL_LIAR_ASSET_BASE}layer8.png`,
  kaiText: `${CALL_LIAR_ASSET_BASE}layer9.png`,
  callLiarText: `${CALL_LIAR_ASSET_BASE}layer10.png`,
};

export default function CallLiarAnimationOverlay({ active = false, runId = 0 }) {
  return (
    <div
      className={`call-liar-animation-overlay ${active ? 'is-active' : ''}`}
      aria-hidden="true"
      data-run-id={runId}
    >
      <div key={runId} className="call-liar-animation-overlay__stage">
        <img className="call-liar-layer call-liar-layer--speed-lines" src={layers.speedLines} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--crater" src={layers.crater} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--impact-glow" src={layers.impactGlow} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--debris-back" src={layers.debrisBack} alt="" draggable="false" />

        <img className="call-liar-layer call-liar-layer--die call-liar-layer--die-left" src={layers.diceLeft} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--die call-liar-layer--die-right" src={layers.diceRight} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--die call-liar-layer--die-front" src={layers.diceFront} alt="" draggable="false" />

        <img className="call-liar-layer call-liar-layer--debris-front" src={layers.debrisFront} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--kai-text" src={layers.kaiText} alt="" draggable="false" />
        <img className="call-liar-layer call-liar-layer--call-text" src={layers.callLiarText} alt="" draggable="false" />
      </div>
    </div>
  );
}
