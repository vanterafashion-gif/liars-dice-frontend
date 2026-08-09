export const FEI_ANIMATION_DURATION_MS = 1480;
export const FEI_ACTION_SUBMIT_MS = 430;

const FEI_ASSET_BASE = `${import.meta.env.BASE_URL}fei/`;

const layers = {
  platform: `${FEI_ASSET_BASE}layer1.png`,
  impactGlow: `${FEI_ASSET_BASE}layer2.png`,
  speedLines: `${FEI_ASSET_BASE}layer3.png`,
  debris: `${FEI_ASSET_BASE}layer4.png`,
  diceCup: `${FEI_ASSET_BASE}layer5.png`,
  zText: `${FEI_ASSET_BASE}layer6.png`,
  jokerOn: `${FEI_ASSET_BASE}layer7.png`,
  feiText: `${FEI_ASSET_BASE}layer8.png`,
  dice1: `${FEI_ASSET_BASE}layer9.png`,
  dice2: `${FEI_ASSET_BASE}layer10.png`,
  dice3: `${FEI_ASSET_BASE}layer11.png`,
  dice4: `${FEI_ASSET_BASE}layer12.png`,
};

export default function FeiAnimationOverlay({ active = false, runId = 0 }) {
  return (
    <div
      className={`fei-animation-overlay ${active ? 'is-active' : ''}`}
      aria-hidden="true"
      data-run-id={runId}
    >
      <div key={runId} className="fei-animation-overlay__stage">
        <img className="fei-layer fei-layer--speed-lines" src={layers.speedLines} alt="" draggable="false" />
        <img className="fei-layer fei-layer--impact-glow" src={layers.impactGlow} alt="" draggable="false" />
        <img className="fei-layer fei-layer--platform" src={layers.platform} alt="" draggable="false" />
        <img className="fei-layer fei-layer--debris" src={layers.debris} alt="" draggable="false" />

        <img className="fei-layer fei-layer--cup" src={layers.diceCup} alt="" draggable="false" />

        <img className="fei-layer fei-layer--die fei-layer--die-1" src={layers.dice1} alt="" draggable="false" />
        <img className="fei-layer fei-layer--die fei-layer--die-2" src={layers.dice2} alt="" draggable="false" />
        <img className="fei-layer fei-layer--die fei-layer--die-3" src={layers.dice3} alt="" draggable="false" />
        <img className="fei-layer fei-layer--die fei-layer--die-4" src={layers.dice4} alt="" draggable="false" />

        <img className="fei-layer fei-layer--z-text" src={layers.zText} alt="" draggable="false" />
        <img className="fei-layer fei-layer--joker-on" src={layers.jokerOn} alt="" draggable="false" />
        <img className="fei-layer fei-layer--fei-text" src={layers.feiText} alt="" draggable="false" />
      </div>
    </div>
  );
}
