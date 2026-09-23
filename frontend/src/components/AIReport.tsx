import type { Analysis } from "../types/simulation";
import { Icon } from "./Icon";
export function AIReport({ report }: { report: Analysis }) {
  return (
    <section className="panel report">
      <div className="section-heading">
        <span className="section-icon">
          <Icon name="spark" />
        </span>
        <div>
          <h2>
            {report.source === "ai"
              ? "Your AI city advisor"
              : "Your scenario assessment"}
          </h2>
          <p className="small muted">
            {report.source === "ai"
              ? "AI explanation of the calculated scenario"
              : "Rule-based explanation · no AI model was called"}
          </p>
        </div>
      </div>
      <p className="report-summary">{report.summary}</p>
      <div className="report-columns">
        <div>
          <h3>What works well</h3>
          <ul className="report-list strengths">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Risks to consider</h3>
          <ul className="report-list risks">
            {report.risks.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      <details className="tradeoff report-tradeoffs">
        <summary>Trade-offs and possible consequences</summary>
        <ul>
          {report.tradeoffs.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <p className="small muted">
          Qualitative considerations; only effects in the model change the
          calculated score.
        </p>
      </details>
    </section>
  );
}
