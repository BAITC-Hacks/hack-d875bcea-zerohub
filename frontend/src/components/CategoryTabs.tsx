import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Configuration,
  type Decision,
} from "../types/simulation";
import { decisionFor } from "../utils/decisions";
import { Icon } from "./Icon";
export function CategoryTabs({
  active,
  onChange,
  config,
  decisions,
  disabled,
}: {
  active: Category;
  onChange: (c: Category) => void;
  config: Configuration;
  decisions: Decision[];
  disabled: boolean;
}) {
  return (
    <div
      className="category-tabs"
      role="tablist"
      aria-label="Decision categories"
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const index = CATEGORIES.indexOf(active);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? 4
              : (index + (e.key === "ArrowRight" ? 1 : -1) + 5) % 5;
        onChange(CATEGORIES[next]);
        document.getElementById(`tab-${CATEGORIES[next]}`)?.focus();
      }}
    >
      {CATEGORIES.map((category, i) => (
        <button
          key={category}
          id={`tab-${category}`}
          role="tab"
          aria-selected={active === category}
          aria-controls="category-panel"
          tabIndex={active === category ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(category)}
          className={`category-tab ${active === category ? "active" : ""}`}
        >
          <span className="tab-icon">
            <Icon name={category} />
          </span>
          <span>{CATEGORY_LABELS[category]}</span>
          <span
            className={`tab-index ${decisionFor(config, decisions, category) ? "done" : ""}`}
          >
            {decisionFor(config, decisions, category) ? (
              <Icon name="check" size={13} />
            ) : (
              `0${i + 1}`
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
