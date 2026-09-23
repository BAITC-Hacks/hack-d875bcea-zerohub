import { useState } from "react";
import { readHistory } from "../api/storage";
import { number, signed } from "../utils/format";
import {
  IndicatorComparison,
  averageIndicators,
} from "../components/IndicatorComparison";
import { Icon } from "../components/Icon";

export function ComparePage() {
  const [history] = useState(readHistory);
  const [leftId, setLeftId] = useState(history[1]?.id ?? history[0]?.id ?? "");
  const [rightId, setRightId] = useState(history[0]?.id ?? "");
  const left = history.find((s) => s.id === leftId);
  const compatible = history.filter(
    (s) =>
      s.dataset_version === left?.dataset_version &&
      s.engine_version === left?.engine_version &&
      s.initial_budget === left?.initial_budget,
  );
  const right = compatible.find((s) => s.id === rightId);
  const label = (id: string) => {
    const s = history.find((x) => x.id === id)!;
    return `Plan ${history.length - history.indexOf(s)} · ${number(s.final.score)} pts · ${s.total_cost} units`;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPLORE THE TRADE-OFFS</span>
          <h1 tabIndex={-1}>Different plans. Different futures.</h1>
          <p className="muted">
            Compare up to 20 recent results saved in this browser.
          </p>
        </div>
        <a className="button primary" href="#/simulate">
          Build another plan <Icon name="arrow" size={17} />
        </a>
      </div>
      {history.length < 2 || !left ? (
        <section className="empty-state panel">
          <Icon name="compare" size={40} />
          <h2>Your next plan makes a comparison.</h2>
          <p className="muted">
            Complete two scenarios, then return here to see their differences.
          </p>
          <a className="button secondary" href="#/simulate">
            Open simulator
          </a>
        </section>
      ) : (
        <>
          <div className="compare-selectors panel">
            <label className="field">
              Plan A
              <select
                value={leftId}
                onChange={(e) => {
                  setLeftId(e.target.value);
                  const next = history.find((s) => s.id === e.target.value)!;
                  const alternative = history.find(
                    (s) =>
                      s.id !== next.id &&
                      s.dataset_version === next.dataset_version &&
                      s.engine_version === next.engine_version &&
                      s.initial_budget === next.initial_budget,
                  );
                  setRightId(alternative?.id ?? "");
                }}
              >
                {history.map((s) => (
                  <option key={s.id} value={s.id}>
                    {label(s.id)}
                  </option>
                ))}
              </select>
            </label>
            <Icon name="compare" />
            <label className="field">
              Plan B
              <select
                value={right?.id ?? ""}
                onChange={(e) => setRightId(e.target.value)}
              >
                <option value="" disabled>
                  Select a comparable plan
                </option>
                {compatible
                  .filter((s) => s.id !== leftId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {label(s.id)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {right && right.id !== left.id ? (
            <div className="results-grid">
              <section className="panel">
                <h2>The numbers, side by side</h2>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Plan A</th>
                        <th>Plan B</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>Quality of Life Score</th>
                        <td>{number(left.final.score)}</td>
                        <td>
                          <b>{number(right.final.score)}</b>
                        </td>
                      </tr>
                      <tr>
                        <th>Gain from baseline</th>
                        <td>
                          {signed(left.final.score - left.baseline.score)}
                        </td>
                        <td>
                          {signed(right.final.score - right.baseline.score)}
                        </td>
                      </tr>
                      <tr>
                        <th>Budget used</th>
                        <td>{left.total_cost}</td>
                        <td>{right.total_cost}</td>
                      </tr>
                      <tr>
                        <th>City average</th>
                        <td>{number(left.final.city_average)}</td>
                        <td>{number(right.final.city_average)}</td>
                      </tr>
                      <tr>
                        <th>Lowest district</th>
                        <td>{number(left.final.lowest_district)}</td>
                        <td>{number(right.final.lowest_district)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="inline-actions">
                  <a
                    className="text-button"
                    href={`#/results/${encodeURIComponent(left.id)}`}
                  >
                    Open Plan A <Icon name="arrow" size={15} />
                  </a>
                  <a
                    className="text-button"
                    href={`#/results/${encodeURIComponent(right.id)}`}
                  >
                    Open Plan B <Icon name="arrow" size={15} />
                  </a>
                </div>
                <p className="small muted">
                  Same dataset ({left.dataset_version}), model (
                  {left.engine_version}) and starting budget (
                  {left.initial_budget}).
                </p>
              </section>
              <section className="panel">
                <h2>Where the gains go</h2>
                <p className="small muted">
                  Population-weighted city indicators. Changes show B minus A.
                </p>
                <IndicatorComparison
                  before={averageIndicators(left.final)}
                  after={averageIndicators(right.final)}
                  beforeLabel="Plan A"
                  afterLabel="Plan B"
                />
              </section>
            </div>
          ) : (
            <p className="notice warning">
              Choose another result using the same dataset, model version and
              starting budget.
            </p>
          )}
        </>
      )}
      <div className="disclaimer">
        This is a local scenario comparison, not a shared team leaderboard. Team
        rankings require a backend feature.
      </div>
    </>
  );
}
