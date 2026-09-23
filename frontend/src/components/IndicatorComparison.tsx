import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Indicators,
  type ScoreSnapshot,
} from "../types/simulation";
import { number, signed } from "../utils/format";
export function averageIndicators(snapshot: ScoreSnapshot): Indicators {
  const population = snapshot.districts.reduce(
    (sum, d) => sum + d.population,
    0,
  );
  return Object.fromEntries(
    CATEGORIES.map((k) => [
      k,
      snapshot.districts.reduce(
        (sum, d) => sum + d.indicators[k] * d.population,
        0,
      ) / population,
    ]),
  ) as Indicators;
}
export function IndicatorComparison({
  before,
  after,
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  before: Indicators;
  after: Indicators;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  return (
    <div className="indicator-comparison">
      <div className="chart-legend">
        <span>
          <i className="before-swatch" />
          {beforeLabel}
        </span>
        <span>
          <i className="after-swatch" />
          {afterLabel}
        </span>
      </div>
      {CATEGORIES.map((k) => (
        <div className="indicator-row" key={k}>
          <div className="spread small">
            <strong>{CATEGORY_LABELS[k]}</strong>
            <span className={after[k] >= before[k] ? "positive" : "negative"}>
              {signed(after[k] - before[k])}
            </span>
          </div>
          <div className="bar-pair">
            <progress
              max={100}
              value={before[k]}
              aria-label={`${CATEGORY_LABELS[k]} ${beforeLabel}: ${number(before[k])}`}
            />
            <span>{number(before[k])}</span>
          </div>
          <div className="bar-pair after">
            <progress
              max={100}
              value={after[k]}
              aria-label={`${CATEGORY_LABELS[k]} ${afterLabel}: ${number(after[k])}`}
            />
            <span>{number(after[k])}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
