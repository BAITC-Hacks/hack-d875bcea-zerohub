import { z } from "zod";
import {
  ScenarioSchema,
  ScenarioRequestSchema,
  type Scenario,
  type Configuration,
  type Decision,
} from "../types/simulation";
import { DATA_MODE } from "./client";
import { validateDecisions } from "../utils/decisions";

const HISTORY_KEY = `akim:${DATA_MODE}:history:v1`;
const DRAFT_KEY = `akim:${DATA_MODE}:draft:v1`;
let memory: Scenario[] | undefined;
let memoryDraft: unknown = undefined;
export let storageAvailable = true;
function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageAvailable = false;
  }
}
export function readHistory(): Scenario[] {
  if (memory) return memory;
  const result = z.array(ScenarioSchema).safeParse(read(HISTORY_KEY));
  memory = result.success ? result.data : [];
  return memory;
}
export function cacheScenario(scenario: Scenario) {
  memory = [
    scenario,
    ...readHistory().filter((s) => s.id !== scenario.id),
  ].slice(0, 20);
  write(HISTORY_KEY, memory);
}
export function readDraft(config: Configuration): Decision[] {
  const data = ScenarioRequestSchema.safeParse(
    memoryDraft === undefined ? read(DRAFT_KEY) : memoryDraft,
  );
  if (!data.success || data.data.dataset_version !== config.dataset_version)
    return [];
  try {
    validateDecisions(config, data.data.decisions);
    return data.data.decisions;
  } catch {
    return [];
  }
}
export function saveDraft(config: Configuration, decisions: Decision[]) {
  memoryDraft = { dataset_version: config.dataset_version, decisions };
  write(DRAFT_KEY, memoryDraft);
}
export function clearDraft() {
  memoryDraft = null;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage is optional */
  }
}
