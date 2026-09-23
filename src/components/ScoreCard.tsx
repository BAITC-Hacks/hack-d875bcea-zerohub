import { number, signed } from "../utils/format";
export function ScoreCard({
  score,
  baseline,
  label = "Projected quality of life",
  compact = false,
}: {
  score: number;
  baseline: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <section
      className={`score-card ${compact ? "compact" : ""}`}
      aria-label={label}
    >
      <span className="eyebrow">{label}</span>
      <div className="score-main">
        <strong data-testid="quality-score">{number(score)}</strong>
        <span>/100</span>
      </div>
      <div className="score-baseline">
        <span
          className={`delta ${score >= baseline ? "positive" : "negative"}`}
        >
          {signed(score - baseline)} pts
        </span>
        <span>from {number(baseline)} at the start</span>
      </div>
      {!compact && (
        <p>
          Astana Quality of Life Score
          <br />
          <span>Our synthetic simulation index</span>
        </p>
      )}
    </section>
  );
}
