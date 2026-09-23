import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Initiative,
} from "../types/simulation";
import { Icon } from "./Icon";
export function InitiativeCard({
  initiative,
  selected,
  affordable,
  eligible,
  disabled,
  onSelect,
}: {
  initiative: Initiative;
  selected: boolean;
  affordable: boolean;
  eligible: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`initiative-card ${selected ? "selected" : ""}`}>
      <div className="spread">
        <span className="initiative-symbol">
          <Icon name={initiative.category} size={24} />
        </span>
        <span className="cost-tag">
          {initiative.cost}
          <small> units</small>
        </span>
      </div>
      <h3>{initiative.name}</h3>
      <p className="muted small">{initiative.description}</p>
      <div className="effects" aria-label="Assumed indicator effects">
        {CATEGORIES.filter((k) => initiative.effects[k] !== 0).map((k) => (
          <span
            className={
              initiative.effects[k] > 0 ? "effect positive" : "effect negative"
            }
            key={k}
          >
            {initiative.effects[k] > 0 ? "+" : ""}
            {initiative.effects[k]} {CATEGORY_LABELS[k]}
          </span>
        ))}
      </div>
      <details className="tradeoff">
        <summary>Consider the trade-off</summary>
        <p>{initiative.tradeoffs.join(" ")}</p>
      </details>
      <button
        className={`button ${selected ? "selected-button" : "secondary"}`}
        disabled={disabled || !affordable || !eligible || selected}
        onClick={onSelect}
        aria-label={`${selected ? "Selected" : "Select"} ${initiative.name}`}
      >
        {selected ? (
          <>
            <Icon name="check" size={16} />
            Selected
          </>
        ) : !eligible ? (
          "Unavailable here"
        ) : !affordable ? (
          "Over budget"
        ) : (
          <>
            Select initiative
            <Icon name="arrow" size={16} />
          </>
        )}
      </button>
    </article>
  );
}
