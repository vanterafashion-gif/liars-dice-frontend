export const SLAM_ANIMATION_DURATION_MS = 1180;
export const SLAM_ACTION_SUBMIT_MS = 380;

const SLAM_ASSET_BASE = `${import.meta.env.BASE_URL}slam/`;

const layers = {
  tableClean: `${SLAM_ASSET_BASE}layer1.png`,
  tableCrack: `${SLAM_ASSET_BASE}layer2.png`,
  impactGlow: `${SLAM_ASSET_BASE}layer3.png`,
  handArm: `${SLAM_ASSET_BASE}layer4.png`,
  speedLines: `${SLAM_ASSET_BASE}layer5.png`,
  debrisBack: `${SLAM_ASSET_BASE}layer6.png`,
  debrisFront: `${SLAM_ASSET_BASE}layer7.png`,
  dice1: `${SLAM_ASSET_BASE}layer8.png`,
  dice2: `${SLAM_ASSET_BASE}layer9.png`,
  dice3: `${SLAM_ASSET_BASE}layer10.png`,
  dice4: `${SLAM_ASSET_BASE}layer11.png`,
  slamText: `${SLAM_ASSET_BASE}layer12.png`,
  kaiText: `${SLAM_ASSET_BASE}layer13.png`,
};

export default function SlamAnimationOverlay({ active = false, runId = 0 }) {
  return (
    <div
      className={`slam-animation-overlay ${active ? 'is-active' : ''}`}
      aria-hidden="true"
      data-run-id={runId}
    >
      <div key={runId} className="slam-animation-overlay__stage">
        <img className="slam-layer slam-layer--table-clean" src={layers.tableClean} alt="" draggable="false" />
        <img className="slam-layer slam-layer--table-crack" src={layers.tableCrack} alt="" draggable="false" />
        <img className="slam-layer slam-layer--impact-glow" src={layers.impactGlow} alt="" draggable="false" />
        <img className="slam-layer slam-layer--speed-lines" src={layers.speedLines} alt="" draggable="false" />
        <img className="slam-layer slam-layer--debris-back" src={layers.debrisBack} alt="" draggable="false" />
        <img className="slam-layer slam-layer--hand-arm" src={layers.handArm} alt="" draggable="false" />
        <img className="slam-layer slam-layer--dice slam-layer--dice-1" src={layers.dice1} alt="" draggable="false" />
        <img className="slam-layer slam-layer--dice slam-layer--dice-2" src={layers.dice2} alt="" draggable="false" />
        <img className="slam-layer slam-layer--dice slam-layer--dice-3" src={layers.dice3} alt="" draggable="false" />
        <img className="slam-layer slam-layer--dice slam-layer--dice-4" src={layers.dice4} alt="" draggable="false" />
        <img className="slam-layer slam-layer--debris-front" src={layers.debrisFront} alt="" draggable="false" />
        <img className="slam-layer slam-layer--kai-text" src={layers.kaiText} alt="" draggable="false" />
        <img className="slam-layer slam-layer--slam-text" src={layers.slamText} alt="" draggable="false" />
      </div>
    </div>
  );
}
