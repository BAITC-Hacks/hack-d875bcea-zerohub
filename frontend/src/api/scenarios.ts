import {
  AnalysisSchema,
  ConfigSchema,
  PreviewSchema,
  ScenarioSchema,
  type Configuration,
  type ScenarioRequest,
  type Scenario,
} from "../types/simulation";
import { DATA_MODE, MODE_ERROR, request } from "./client";
import { cacheScenario, readHistory } from "./storage";

// Dynamic import keeps the local scoring fixture outside the live request path.
const demo = () => import("../demo/engine");
export async function getConfiguration(
  signal?: AbortSignal,
): Promise<Configuration> {
  if (MODE_ERROR) throw new Error(MODE_ERROR);
  if (DATA_MODE === "api") return request("/config", ConfigSchema, { signal });
  const { demoConfig } = await demo();
  signal?.throwIfAborted();
  return structuredClone(demoConfig);
}
export async function previewScenario(
  body: ScenarioRequest,
  signal?: AbortSignal,
) {
  if (DATA_MODE === "api")
    return request("/preview", PreviewSchema, { method: "POST", body, signal });
  const { simulate } = await demo();
  signal?.throwIfAborted();
  return simulate(body);
}
export async function createScenario(body: ScenarioRequest): Promise<Scenario> {
  let result: Scenario;
  if (DATA_MODE === "api")
    result = await request("/scenarios", ScenarioSchema, {
      method: "POST",
      body,
    });
  else {
    const { simulate } = await demo();
    if (body.decisions.length !== 5)
      throw new Error(
        "Choose one decision in every category before submitting.",
      );
    result = ScenarioSchema.parse({
      ...simulate(body),
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      decisions: body.decisions,
    });
  }
  cacheScenario(result);
  return result;
}
export async function getScenario(id: string, signal?: AbortSignal) {
  if (DATA_MODE === "api") {
    const result = await request(
      `/scenarios/${encodeURIComponent(id)}`,
      ScenarioSchema,
      { signal },
    );
    cacheScenario(result);
    return result;
  }
  signal?.throwIfAborted();
  const result = readHistory().find((s) => s.id === id);
  if (!result)
    throw new Error(
      "This scenario is not saved in this browser. Create a new scenario to continue.",
    );
  return result;
}
export async function analyzeScenario(
  scenario: Scenario,
  signal?: AbortSignal,
) {
  if (DATA_MODE === "api")
    return request(
      `/scenarios/${encodeURIComponent(scenario.id)}/analysis`,
      AnalysisSchema,
      { method: "POST", signal, timeout: 60000 },
    );
  const { demoAnalysis } = await demo();
  signal?.throwIfAborted();
  return demoAnalysis(scenario);
}
