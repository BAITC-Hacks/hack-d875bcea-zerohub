import {
  CATEGORY_LABELS,
  type Category,
  type District,
  type ScoredDistrict,
} from "../types/simulation";
import { number, people, signed } from "../utils/format";
export function DistrictCard({
  district,
  category,
  projected,
  selected,
  onSelect,
  disabled,
}: {
  district: District;
  category: Category;
  projected?: ScoredDistrict;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const before = district.indicators[category];
  const after = projected?.indicators[category];
  return (
    <button
      type="button"
      className={`district-card ${selected ? "selected" : ""}`}
      aria-label={`Target ${district.name}`}
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
    >
      <div className="spread">
        <strong>{district.name}</strong>
        <span className="district-dot" />
      </div>
      <span className="small muted">
        {people(district.population)} residents
      </span>
      <span className="district-metric">
        <b>{number(after ?? before, 0)}</b>
        <span>/100</span>
        {after !== undefined && after !== before && (
          <span className={after > before ? "positive" : "negative"}>
            {signed(after - before)}
          </span>
        )}
      </span>
      <span className="small muted">{CATEGORY_LABELS[category]} quality</span>
      <span className="mini-track">
        <span style={{ width: `${after ?? before}%` }} />
      </span>
    </button>
  );
}
