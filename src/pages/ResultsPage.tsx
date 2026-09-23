import { useEffect, useState } from "react";
import type {
  Analysis,
  Candidate,
  Configuration,
  Scenario,
} from "../types/simulation";
import { analyzeScenario, getScenario } from "../api/scenarios";
import { saveDraft, storageAvailable } from "../api/storage";
import { navigate } from "../hooks/useRoute";
import { errorMessage, number, signed } from "../utils/format";
import { validateDecisions } from "../utils/decisions";
import { ScoreCard } from "../components/ScoreCard";
import {
  IndicatorComparison,
  averageIndicators,
} from "../components/IndicatorComparison";
import { DecisionSummary } from "../components/DecisionSummary";
import { AIReport } from "../components/AIReport";
import { RecommendationCard } from "../components/RecommendationCard";
import { Icon } from "../components/Icon";

export function ResultsPage({
  id,
  config,
}: {
  id: string;
  config: Configuration;
}) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [error, setError] = useState("");
  const [loadRetry, setLoadRetry] = useState(0);
  const [report, setReport] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisRetry, setAnalysisRetry] = useState(0);
  const [applyError, setApplyError] = useState("");
  const [district, setDistrict] = useState("city");

  useEffect(() => {
    const controller = new AbortController();
    setScenario(null);
    setError("");
    setReport(null);
    setDistrict("city");
    getScenario(id, controller.signal)
      .then((s) => {
        if (!controller.signal.aborted) setScenario(s);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [id, loadRetry]);
  useEffect(() => {
    if (!scenario) return;
    const controller = new AbortController();
    setReport(null);
    setAnalysisError("");
    analyzeScenario(scenario, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) setReport(r);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setAnalysisError(errorMessage(e));
      });
    return () => controller.abort();
  }, [scenario, analysisRetry]);

  if (error)
    return (
      <section className="empty-state">
        <h1 tabIndex={-1}>We couldn’t load this scenario.</h1>
        <p role="alert">{error}</p>
        <button
          className="button secondary"
          onClick={() => setLoadRetry((n) => n + 1)}
        >
          Try again
        </button>
        <a className="text-button" href="#/simulate">
          Back to simulator
        </a>
      </section>
    );
  if (!scenario)
    return (
      <div className="page-loading" role="status">
        <span className="spinner" />
        Loading your city’s future…
      </div>
    );
  const compatible =
    scenario.dataset_version === config.dataset_version &&
    scenario.engine_version === config.engine_version;
  const before =
    district === "city"
      ? averageIndicators(scenario.baseline)
      : scenario.baseline.districts.find((d) => d.id === district)!.indicators;
  const after =
    district === "city"
      ? averageIndicators(scenario.final)
      : scenario.final.districts.find((d) => d.id === district)!.indicators;
  const apply = (candidate?: Candidate) => {
    try {
      if (!compatible)
        throw new Error(
          "This result uses an older model. Start a new scenario with the current data.",
        );
      const decisions = candidate?.decisions ?? scenario.decisions;
      validateDecisions(config, decisions, true);
      saveDraft(config, decisions);
      navigate("/simulate");
    } catch (e) {
      setApplyError(errorMessage(e));
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SCENARIO, EXPLAINED</span>
          <h1 tabIndex={-1}>Here’s the city you shaped.</h1>
          <p className="muted">
            Five decisions. A measurable difference. A few things to consider.
          </p>
        </div>
        <div className="inline-actions">
          <a className="button secondary" href="#/compare">
            <Icon name="compare" size={17} />
            Compare plans
          </a>
          <button
            className="button primary"
            onClick={() => apply()}
            disabled={!compatible}
          >
            Refine this plan <Icon name="arrow" size={17} />
          </button>
        </div>
      </div>
      {!storageAvailable && (
        <p className="notice warning">
          This browser could not store the result. It is available for this
          session only.
        </p>
      )}
      {applyError && (
        <p className="notice error" role="alert">
          {applyError}
        </p>
      )}
      {!compatible && (
        <p className="notice warning">
          Archived model: {scenario.dataset_version} / {scenario.engine_version}
          . Your original calculated result is preserved; editing requires the
          current model.
        </p>
      )}
      <section className="result-overview">
        <ScoreCard
          score={scenario.final.score}
          baseline={scenario.baseline.score}
          label="Your final quality of life score"
        />
        <div className="result-stat">
          <span className="eyebrow">BUDGET USED</span>
          <strong>
            {scenario.total_cost}
            <small> / {scenario.initial_budget}</small>
          </strong>
          <p>{scenario.remaining_budget} units unspent</p>
        </div>
        <div className="result-stat">
          <span className="eyebrow">CITY AVERAGE</span>
          <strong>{number(scenario.final.city_average)}</strong>
          <p className="positive">
            {signed(
              scenario.final.city_average - scenario.baseline.city_average,
            )}{" "}
            points from baseline
          </p>
        </div>
        <div className="result-stat">
          <span className="eyebrow">LOWEST DISTRICT</span>
          <strong>{number(scenario.final.lowest_district)}</strong>
          <p>
            {signed(
              scenario.final.lowest_district -
                scenario.baseline.lowest_district,
            )}{" "}
            points from baseline
          </p>
        </div>
      </section>
      <div className="results-grid">
        <section className="panel">
          <div className="section-heading spread">
            <div>
              <h2>See what changed</h2>
              <p className="small muted">
                Indicator quality, on a scale of 0–100
              </p>
            </div>
            <label className="field">
              View indicators
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="city">City average</option>
                {scenario.final.districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <IndicatorComparison before={before} after={after} />
          <p className="small muted">
            City averages are weighted by district population.
          </p>
        </section>
        <section className="panel">
          <h2>Every district matters</h2>
          <p className="small muted">
            District scores before and after your decisions.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>District</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {scenario.final.districts.map((d) => {
                  const initial = scenario.baseline.districts.find(
                    (b) => b.id === d.id,
                  )!.score;
                  return (
                    <tr key={d.id}>
                      <th scope="row">{d.name}</th>
                      <td>{number(initial)}</td>
                      <td>
                        <b>{number(d.score)}</b>
                      </td>
                      <td
                        className={d.score >= initial ? "positive" : "negative"}
                      >
                        {signed(d.score - initial)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {compatible && (
            <details className="method-details">
              <summary>How is the final score calculated?</summary>
              <p className="small">
                Each district combines the five indicator weights (
                {Object.entries(config.indicator_weights)
                  .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
                  .join(", ")}
                ). The city score is{" "}
                {Math.round(config.city_average_weight * 100)}%
                population-weighted district average +{" "}
                {Math.round(config.lowest_district_weight * 100)}% lowest
                district score. Only display values are rounded.
              </p>
            </details>
          )}
        </section>
      </div>
      {report ? (
        <AIReport report={report} />
      ) : (
        <section className="panel analysis-status" aria-live="polite">
          <Icon name="spark" />
          <div>
            <h2>
              {analysisError
                ? "Analysis is temporarily unavailable"
                : "Preparing your scenario assessment…"}
            </h2>
            <p className="muted small">
              {analysisError ||
                "Your calculated score and district results are already available above."}
            </p>
          </div>
          {analysisError ? (
            <button
              className="button secondary"
              onClick={() => setAnalysisRetry((n) => n + 1)}
            >
              Retry analysis
            </button>
          ) : (
            <span className="spinner" />
          )}
        </section>
      )}
      {report && compatible && (
        <section className="recommendations-section">
          <div className="section-heading">
            <div>
              <h2>Could your budget go further?</h2>
              <p className="small muted">
                Best tested single-decision changes. Other combinations may
                perform better.
              </p>
            </div>
          </div>
          {report.recommendations.length ? (
            <div className="recommendation-grid">
              {report.recommendations.map((c) => (
                <RecommendationCard
                  key={c.candidate_id}
                  candidate={c}
                  baselineScore={scenario.final.score}
                  onApply={() => apply(c)}
                />
              ))}
            </div>
          ) : (
            <div className="panel">
              <p className="muted">
                No higher-scoring affordable single-decision changes were
                returned for this plan.
              </p>
            </div>
          )}
        </section>
      )}
      {compatible && (
        <details className="panel saved-decisions">
          <summary>Review your five decisions</summary>
          <DecisionSummary config={config} decisions={scenario.decisions} />
        </details>
      )}
      <div className="disclaimer">
        Synthetic model · Dataset {scenario.dataset_version} · Engine{" "}
        {scenario.engine_version} ·{" "}
        {new Date(scenario.created_at).toLocaleString()}
        <br />
        This score is not an official Astana index or a prediction of real-world
        outcomes.
      </div>
    </>
  );
}
