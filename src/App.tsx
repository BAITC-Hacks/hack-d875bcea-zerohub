import { useEffect, useState } from "react";
import type { Configuration } from "./types/simulation";
import { DATA_MODE } from "./api/client";
import { getConfiguration } from "./api/scenarios";
import { useRoute } from "./hooks/useRoute";
import { errorMessage } from "./utils/format";
import { Icon } from "./components/Icon";
import { WelcomePage } from "./pages/WelcomePage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { ResultsPage } from "./pages/ResultsPage";
import { ComparePage } from "./pages/ComparePage";

export default function App() {
  const route = useRoute();
  const [config, setConfig] = useState<Configuration | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    getConfiguration(controller.signal)
      .then((c) => {
        if (!controller.signal.aborted) setConfig(c);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    document.title = `${route === "/" ? "City Lab" : route.startsWith("/results/") ? "Your results" : route === "/compare" ? "Compare plans" : "Simulator"} · Akim for 5 Hours`;
  }, [route]);
  let resultId = "";
  if (route.startsWith("/results/")) {
    try {
      resultId = decodeURIComponent(route.slice(9));
    } catch {
      /* render not found */
    }
  }
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#/" className="brand" aria-label="Akim for 5 Hours home">
            <span className="brand-mark">
              <Icon name="city" size={24} />
            </span>
            <span>
              Akim<span className="brand-subtitle">FOR 5 HOURS</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#/" aria-current={route === "/" ? "page" : undefined}>
              Overview
            </a>
            <a
              href="#/simulate"
              aria-current={route === "/simulate" ? "page" : undefined}
            >
              Simulator
            </a>
            <a
              href="#/compare"
              aria-current={route === "/compare" ? "page" : undefined}
            >
              Compare
            </a>
          </nav>
          <span className={`mode-badge ${DATA_MODE}`}>
            <span className="live-dot" />
            {DATA_MODE === "demo"
              ? "Demo · synthetic data"
              : config
                ? "Connected · synthetic data"
                : "Backend mode"}
          </span>
        </div>
      </header>
      <main id="main" className="main-container" tabIndex={-1}>
        {error ? (
          <section className="empty-state">
            <h1 tabIndex={-1}>Let’s reconnect your city.</h1>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => setRetry((n) => n + 1)}
            >
              Retry connection
            </button>
          </section>
        ) : !config ? (
          <div className="page-loading" role="status">
            <span className="spinner" />
            Loading your city…
          </div>
        ) : route === "/" ? (
          <WelcomePage config={config} />
        ) : route === "/simulate" ? (
          <SimulatorPage config={config} />
        ) : resultId ? (
          <ResultsPage key={resultId} id={resultId} config={config} />
        ) : route === "/compare" ? (
          <ComparePage />
        ) : (
          <section className="empty-state">
            <h1 tabIndex={-1}>This page doesn’t exist.</h1>
            <a className="button primary" href="#/">
              Back to overview
            </a>
          </section>
        )}
      </main>
      <footer className="site-footer">
        <span>
          Akim for 5 Hours <span className="footer-divider">/</span> City
          management, made tangible.
        </span>
        <span>Synthetic data · Transparent scoring</span>
      </footer>
    </div>
  );
}
