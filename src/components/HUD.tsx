/**
 * HUD overlay showing SCORE, LEVEL, and BEST.
 * Shown during gameplay, hidden otherwise.
 */
export default function HUD({
  score = 0,
  level = 1,
  best = 0,
  visible = true,
}: {
  score?: number;
  level?: number;
  best?: number;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="hud">
      <div className="hud-block">
        <span className="label">SCORE</span>
        <span className="val">{score}</span>
      </div>
      <div className="hud-block" style={{ textAlign: 'center' }}>
        <span className="label">LEVEL</span>
        <span className="val">{level}</span>
      </div>
      <div className="hud-block" style={{ textAlign: 'right' }}>
        <span className="label">BEST</span>
        <span className="val">{best}</span>
      </div>
    </div>
  );
}
