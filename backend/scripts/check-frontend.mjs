/** Real HTTP + browser integration against the unchanged Person 1 frontend.
 * Usage (from backend/): node scripts/check-frontend.mjs ../../akim-person-1/frontend
 * Activate the backend Python venv first, or set AKIM_TEST_PYTHON.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const backend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontend = resolve(process.argv[2] || "../frontend");
const requireFrontend = createRequire(join(frontend, "package.json"));
const { createServer } = await import(
  pathToFileURL(requireFrontend.resolve("vite"))
);
const { chromium } = requireFrontend("playwright");
await mkdir(join(backend, "test-output"), { recursive: true });
const temporary = await mkdtemp(join(backend, "test-output", "integration-"));
const port = 8001;
const base = `http://127.0.0.1:${port}/api`;
const python = process.env.AKIM_TEST_PYTHON || "python";
let logs = "";
let server;
let browser;
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: backend,
    env: {
      ...process.env,
      AKIM_DATABASE_PATH: join(temporary, "test.sqlite3"),
      AKIM_DATA_DIR: resolve(backend, "../data/v1"),
      AKIM_ADVISOR_FACTORY: "app.services.ai_advisor:RuleBasedAdvisor",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.on("data", (data) => {
  logs += data;
});
child.stderr.on("data", (data) => {
  logs += data;
});
let launchError;
child.on("error", (error) => {
  launchError = error;
});

async function request(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return response.json();
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    if (child.exitCode !== null) throw new Error(`Backend exited. ${logs}`);
    // Do not send writes to an unrelated server if the selected port was already occupied.
    if (!logs.includes(`Uvicorn running on http://127.0.0.1:${port}`)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    try {
      await request("/health");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert(ready, `Backend did not start. ${logs}`);
  process.env.VITE_DATA_MODE = "api";
  process.env.VITE_API_BASE_URL = "/api";
  server = await createServer({
    root: frontend,
    server: {
      host: "127.0.0.1",
      port: 5182,
      strictPort: true,
      proxy: {
        "/api": { target: `http://127.0.0.1:${port}`, changeOrigin: true },
      },
    },
  });
  await server.listen();
  const schemas = await server.ssrLoadModule("/src/types/simulation.ts");
  schemas.ConfigSchema.parse(await request("/config"));
  const partial = JSON.parse(
    await readFile(
      join(backend, "tests/fixtures/preview-request.json"),
      "utf8",
    ),
  );
  schemas.PreviewSchema.parse(await request("/preview", "POST", partial));
  const body = JSON.parse(
    await readFile(
      join(backend, "tests/fixtures/scenario-request.json"),
      "utf8",
    ),
  );
  const saved = schemas.ScenarioSchema.parse(
    await request("/scenarios", "POST", body),
  );
  assert.deepEqual(await request(`/scenarios/${saved.id}`), saved);
  const report = schemas.AnalysisSchema.parse(
    await request(`/scenarios/${saved.id}/analysis`, "POST"),
  );
  assert.equal(report.source, "rules");

  browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5182/#/simulate");
  for (const [category, name, district] of [
    ["Transport", "Bus-priority lanes", "district_01"],
    ["Greening", "Neighborhood pocket park", "district_02"],
    ["Social infrastructure", "Local clinic upgrade", "district_03"],
    ["Safety", "Safer pedestrian crossings", "district_01"],
    ["City services", "District maintenance crew", "district_04"],
  ]) {
    await page.getByRole("tab", { name: category }).click();
    await page.getByRole("combobox").selectOption(district);
    await page
      .getByRole("button", { name: `Select ${name}`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "See my city’s future" }).click();
  await page
    .getByText("Rule-based explanation · no AI model was called")
    .waitFor();
  const displayed = new Intl.NumberFormat("en", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(saved.final.score);
  assert.equal(
    await page.getByTestId("quality-score").textContent(),
    displayed,
  );
  await page.reload();
  await page
    .getByText("Rule-based explanation · no AI model was called")
    .waitFor();
  assert.equal(
    await page.getByTestId("quality-score").textContent(),
    displayed,
  );
  await page.getByRole("button", { name: "Refine this plan" }).click();
  await page
    .getByRole("button", { name: "Select Better bus stops", exact: true })
    .click();
  await page.getByRole("button", { name: "See my city’s future" }).click();
  await page
    .getByText("Rule-based explanation · no AI model was called")
    .waitFor();
  assert.notEqual(
    await page.getByTestId("quality-score").textContent(),
    displayed,
  );
  await page.getByRole("link", { name: "Compare plans", exact: true }).click();
  await page
    .getByRole("heading", { name: "The numbers, side by side" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: all live responses match the frontend Zod schemas.");
  console.log(
    "PASS: real browser completes, reloads, refines and compares scenarios against FastAPI + SQLite.",
  );
} finally {
  await browser?.close();
  await server?.close();
  if (child.exitCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  if (child.exitCode !== null)
    await rm(temporary, { recursive: true, force: true });
}
