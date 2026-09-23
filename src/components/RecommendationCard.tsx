import type { Candidate } from "../types/simulation";
import { number, signed } from "../utils/format";
import { Icon } from "./Icon";
export function RecommendationCard({
  candidate,
  baselineScore,
  onApply,
}: {
  candidate: Candidate;
  baselineScore: number;
  onApply: () => void;
}) {
  return (
    <article className="recommendation-card">
      <div className="spread">
        <span className="eyebrow">TESTED ALTERNATIVE</span>
        <span className="delta positive">
          {signed(candidate.score - baselineScore)} pts
        </span>
      </div>
      <h3>{candidate.title}</h3>
      <p className="small muted">{candidate.explanation}</p>
      <div className="spread small">
        <span>
          Score <b>{number(candidate.score)}</b> · Budget{" "}
          <b>{candidate.total_cost}</b>
        </span>
        <button className="text-button" onClick={onApply}>
          Try this plan <Icon name="arrow" size={15} />
        </button>
      </div>
    </article>
  );
}
