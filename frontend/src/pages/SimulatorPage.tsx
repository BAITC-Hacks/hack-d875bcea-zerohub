import { useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  type Category,
  type Configuration,
} from "../types/simulation";
import { useScenario } from "../hooks/useScenario";
import { navigate } from "../hooks/useRoute";
import { decisionFor, initiativeFor } from "../utils/decisions";
import { BudgetBar } from "../components/BudgetBar";
import { CategoryTabs } from "../components/CategoryTabs";
import { DistrictCard } from "../components/DistrictCard";
import { DistrictSelector } from "../components/DistrictSelector";
import { InitiativeCard } from "../components/InitiativeCard";
import { DecisionSummary } from "../components/DecisionSummary";
import { ScoreCard } from "../components/ScoreCard";
import { Icon } from "../components/Icon";
import { storageAvailable } from "../api/storage";

export function SimulatorPage({ config }: { config: Configuration }) {
  const scenario = useScenario(config);
  const [active, setActive] = useState<Category>("transport");
  const [target, setTarget] = useState(
    () =>
      decisionFor(config, scenario.decisions, "transport")?.district_id ??
      config.districts[0].id,
  );
  const existing = decisionFor(config, scenario.decisions, active);
  const previousCost = initiativeFor(config, existing)?.cost ?? 0;
  const available = config.initial_budget - scenario.spent + previousCost;
  const pendingCategories = CATEGORIES.filter(
    (k) => !decisionFor(config, scenario.decisions, k),
  );
  const minimumToFinish = pendingCategories.reduce(
    (sum, k) =>
      sum +
      Math.min(
        ...config.initiatives
          .filter((i) => i.category === k)
          .map((i) => i.cost),
      ),
    0,
  );
  const setCategory = (category: Category) => {
    setActive(category);
    const selected = decisionFor(config, scenario.decisions, category);
    if (selected) setTarget(selected.district_id);
  };
  const setDistrict = (id: string) => {
    setTarget(id);
    if (
      existing &&
      initiativeFor(config, existing)?.eligible_district_ids.includes(id)
    )
      scenario.change({ ...existing, district_id: id });
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE SIMULATION</span>
          <h1 tabIndex={-1}>What will you change?</h1>
          <p className="muted">
            Choose a district and an initiative in each of the five areas.
          </p>
        </div>
        <span className="subtle-tag">
          Dataset {config.dataset_version} · Same start for everyone
        </span>
      </div>
      <div className="mobile-budget-strip" aria-live="polite">
        <span><strong>{config.initial_budget - scenario.spent}</strong> / {config.initial_budget} units remaining</span>
        <span>{scenario.decisions.length}/5 decisions</span>
      </div>
      <div className="simulator-layout">
        <div className="simulator-content">
          <CategoryTabs
            active={active}
            onChange={setCategory}
            config={config}
            decisions={scenario.decisions}
            disabled={scenario.submitting}
          />
          <section
            id="category-panel"
            role="tabpanel"
            aria-labelledby={`tab-${active}`}
            className="panel decision-panel"
          >
            <div className="section-heading spread">
              <div>
                <span className="eyebrow">
                  DECISION 0{CATEGORIES.indexOf(active) + 1} / 05
                </span>
                <h2>{CATEGORY_LABELS[active]}</h2>
                <p className="muted small">{CATEGORY_DESCRIPTIONS[active]}</p>
              </div>
              <DistrictSelector
                districts={config.districts}
                selected={target}
                onChange={setDistrict}
                disabled={scenario.submitting}
              />
            </div>
            <div className="district-grid">
              {config.districts.map((d) => (
                <DistrictCard
                  key={d.id}
                  district={d}
                  category={active}
                  selected={d.id === target}
                  projected={scenario.preview?.final.districts.find(
                    (x) => x.id === d.id,
                  )}
                  onSelect={() => setDistrict(d.id)}
                  disabled={scenario.submitting}
                />
              ))}
            </div>
            <div className="section-heading initiative-heading">
              <div>
                <h3>Choose your investment</h3>
                <p className="small muted">
                  Effects shown are assumed point changes in the target
                  district.
                </p>
              </div>
            </div>
            <div className="initiative-grid">
              {config.initiatives
                .filter((i) => i.category === active)
                .map((i) => (
                  <InitiativeCard
                    key={i.id}
                    initiative={i}
                    selected={
                      existing?.initiative_id === i.id &&
                      existing.district_id === target
                    }
                    affordable={i.cost <= available}
                    eligible={i.eligible_district_ids.includes(target)}
                    disabled={scenario.submitting}
                    onSelect={() =>
                      scenario.change({
                        initiative_id: i.id,
                        district_id: target,
                      })
                    }
                  />
                ))}
            </div>
            <div className="decision-panel-footer">
              <span className="small muted">
                You can revisit and replace any decision before submitting.
              </span>
              <button
                className="text-button"
                disabled={
                  scenario.submitting || CATEGORIES.indexOf(active) === 4
                }
                onClick={() =>
                  setCategory(CATEGORIES[CATEGORIES.indexOf(active) + 1])
                }
              >
                Next area <Icon name="arrow" size={16} />
              </button>
            </div>
          </section>
          <div className="disclaimer">
            Synthetic data · Higher indicators mean better conditions. Benefits
            are modeled immediately; implementation time and recurring costs are
            not simulated.
          </div>
        </div>
        <aside className="scenario-sidebar">
          <BudgetBar spent={scenario.spent} total={config.initial_budget} />
          <div className="panel plan-panel">
            <DecisionSummary
              config={config}
              decisions={scenario.decisions}
              onEdit={setCategory}
              onRemove={scenario.remove}
              disabled={scenario.submitting}
            />
            {minimumToFinish > config.initial_budget - scenario.spent && (
              <p className="notice warning">
                The remaining categories need at least {minimumToFinish} units.
                Replace an existing decision with a cheaper option to finish.
              </p>
            )}
            <div className="preview-region" aria-live="polite">
              {scenario.preview ? (
                <ScoreCard
                  score={scenario.preview.final.score}
                  baseline={scenario.preview.baseline.score}
                  compact
                />
              ) : scenario.previewError ? (
                <div className="notice error" role="alert">
                  {scenario.previewError}
                  <button
                    className="text-button"
                    onClick={scenario.retryPreview}
                  >
                    Retry preview
                  </button>
                </div>
              ) : (
                <div className="preview-loading">
                  <span className="spinner" />
                  Updating your preview…
                </div>
              )}
            </div>
            {scenario.error && (
              <div className="notice error" role="alert">
                {scenario.error}
              </div>
            )}
            {!storageAvailable && (
              <p className="notice warning">
                Browser storage is unavailable. Keep this tab open to retain
                your work.
              </p>
            )}
            <button
              className="button primary full"
              disabled={!scenario.canSubmit}
              onClick={async () => {
                const result = await scenario.submit();
                if (result)
                  navigate(`/results/${encodeURIComponent(result.id)}`);
              }}
            >
              {scenario.submitting ? (
                <>
                  <span className="spinner" />
                  Saving scenario…
                </>
              ) : (
                <>
                  See my city’s future
                  <Icon name="arrow" size={17} />
                </>
              )}
            </button>
            <p className="small muted centered">
              {scenario.decisions.length === 5
                ? "All five decisions selected"
                : `${5 - scenario.decisions.length} more ${5 - scenario.decisions.length === 1 ? "decision" : "decisions"} to complete your plan`}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
