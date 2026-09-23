import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Configuration,
  type Decision,
} from "../types/simulation";
import { decisionFor, initiativeFor } from "../utils/decisions";
import { Icon } from "./Icon";
export function DecisionSummary({
  config,
  decisions,
  onEdit,
  onRemove,
  disabled,
}: {
  config: Configuration;
  decisions: Decision[];
  onEdit?: (c: Category) => void;
  onRemove?: (c: Category) => void;
  disabled?: boolean;
}) {
  return (
    <section className="decision-summary">
      <div className="spread">
        <h3>Your five decisions</h3>
        <span className="count-tag">{decisions.length}/5</span>
      </div>
      <ol>
        {CATEGORIES.map((category) => {
          const decision = decisionFor(config, decisions, category);
          const initiative = initiativeFor(config, decision);
          return (
            <li key={category}>
              <span className={`decision-icon ${decision ? "filled" : ""}`}>
                <Icon name={category} size={16} />
              </span>
              <div className="decision-copy">
                <span className="small muted">{CATEGORY_LABELS[category]}</span>
                {initiative ? (
                  <>
                    <strong>{initiative.name}</strong>
                    <span className="small muted">
                      {
                        config.districts.find(
                          (d) => d.id === decision?.district_id,
                        )?.name
                      }{" "}
                      · {initiative.cost} units
                    </span>
                  </>
                ) : onEdit ? (
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => onEdit(category)}
                  >
                    Choose an initiative
                  </button>
                ) : (
                  <strong>Not selected</strong>
                )}
              </div>
              {decision && onRemove && (
                <button
                  className="icon-button"
                  aria-label={`Remove ${CATEGORY_LABELS[category]} decision`}
                  disabled={disabled}
                  onClick={() => onRemove(category)}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
