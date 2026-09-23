import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Configuration,
} from "../types/simulation";
import { clearDraft, readDraft } from "../api/storage";
import { navigate } from "../hooks/useRoute";
import { Icon } from "../components/Icon";

export function WelcomePage({ config }: { config: Configuration }) {
  const hasDraft = readDraft(config).length > 0;
  return (
    <>
      <section className="welcome-hero">
        <div className="hero-copy">
          <div className="eyebrow hero-kicker">
            <span className="live-dot" />
            ASTANA INNOVATIONS · SPECIAL TRACK
          </div>
          <h1 tabIndex={-1}>
            A city. A budget.
            <br />
            <em>Five decisions.</em>
          </h1>
          <p className="hero-description">
            Step into the akim’s chair. Invest in the districts that need it
            most, balance competing priorities, and discover the city your
            decisions create.
          </p>
          <div className="hero-actions">
            <button
              className="button primary large"
              onClick={() => {
                clearDraft();
                navigate("/simulate");
              }}
            >
              Start a new scenario <Icon name="arrow" />
            </button>
            {hasDraft && (
              <a className="text-button" href="#/simulate">
                Resume your draft
              </a>
            )}
          </div>
          <p className="small muted">
            No account needed. Synthetic districts. Real trade-offs to explore.
          </p>
          <div className="hero-stats">
            <div>
              <strong>{config.initial_budget}</strong>
              <span>budget units</span>
            </div>
            <div>
              <strong>
                {String(config.districts.length).padStart(2, "0")}
              </strong>
              <span>city districts</span>
            </div>
            <div>
              <strong>05</strong>
              <span>decisions to make</span>
            </div>
          </div>
        </div>
        <div
          className="city-preview"
          aria-label="Schematic city illustration, not a geographic map"
        >
          <div className="spread">
            <span className="eyebrow">YOUR CITY, REIMAGINED</span>
            <Icon name="city" />
          </div>
          <div className="city-schematic" aria-hidden="true">
            <div className="river" />
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className={`city-block block-${n}`}>
                <i />
                <i />
                <i />
                <span>{String(n).padStart(2, "0")}</span>
              </div>
            ))}
            <div className="park park-one" />
            <div className="park park-two" />
            <div className="city-marker">
              <Icon name="city" size={23} />
            </div>
          </div>
          <div className="preview-caption">
            <span className="live-dot" />
            <span>
              A shared starting point.
              <br />
              <strong>A different future with every plan.</strong>
            </span>
          </div>
          <span className="schematic-label">
            ILLUSTRATIVE DISTRICTS · NOT A REAL MAP
          </span>
        </div>
      </section>
      <section className="welcome-bottom">
        <div>
          <span className="eyebrow">THE CHALLENGE</span>
          <h2>Make every unit count.</h2>
          <p className="muted">
            One initiative in each area. A single shared budget. See who
            benefits, where gaps remain, and what you could do differently.
          </p>
        </div>
        <div className="domain-grid">
          {CATEGORIES.map((k) => (
            <div className="domain-tile" key={k}>
              <Icon name={k} />
              <span>{CATEGORY_LABELS[k]}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="disclaimer">
        All data, costs and effects are synthetic. The score is a learning
        model, not an official Astana index or a forecast. “5 Hours” is the
        project title; the MVP does not impose a countdown.
      </div>
    </>
  );
}
