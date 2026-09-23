// UI-development fixture only. In API mode the backend is authoritative.
import rawConfig from "./config.json" with { type: "json" };
import {
  CATEGORIES,
  ConfigSchema,
  type Configuration,
  type Decision,
  type District,
  type Preview,
  type ScoreSnapshot,
  type ScenarioRequest,
  type Scenario,
  type Analysis,
  type Candidate,
} from "../types/simulation";
import {
  initiativeFor,
  totalCost,
  validateDecisions,
} from "../utils/decisions";
import { number, signed } from "../utils/format";

export const demoConfig = ConfigSchema.parse(rawConfig);

function score(districts: District[], config: Configuration): ScoreSnapshot {
  const scored = districts.map((d) => ({
    ...d,
    score: CATEGORIES.reduce(
      (sum, k) => sum + d.indicators[k] * config.indicator_weights[k],
      0,
    ),
  }));
  const population = scored.reduce((sum, d) => sum + d.population, 0);
  const city_average =
    scored.reduce((sum, d) => sum + d.score * d.population, 0) / population;
  const lowest_district = Math.min(...scored.map((d) => d.score));
  return {
    districts: scored,
    city_average,
    lowest_district,
    score:
      config.city_average_weight * city_average +
      config.lowest_district_weight * lowest_district,
  };
}

export function simulate(
  request: ScenarioRequest,
  config = demoConfig,
): Preview {
  if (request.dataset_version !== config.dataset_version)
    throw new Error("Dataset changed. Reload to start with the current data.");
  validateDecisions(config, request.decisions);
  // Accumulate effects, then clamp once: results must be independent of selection order.
  const districts = structuredClone(config.districts);
  for (const d of request.decisions) {
    const initiative = initiativeFor(config, d)!;
    const district = districts.find((x) => x.id === d.district_id)!;
    for (const k of CATEGORIES) district.indicators[k] += initiative.effects[k];
  }
  for (const d of districts)
    for (const k of CATEGORIES)
      d.indicators[k] = Math.max(0, Math.min(100, d.indicators[k]));
  const cost = totalCost(config, request.decisions);
  return {
    dataset_version: config.dataset_version,
    engine_version: config.engine_version,
    decision_count: request.decisions.length,
    complete: request.decisions.length === 5,
    initial_budget: config.initial_budget,
    total_cost: cost,
    remaining_budget: config.initial_budget - cost,
    baseline: score(config.districts, config),
    final: score(districts, config),
  };
}

export function recommend(scenario: Scenario): Candidate[] {
  const candidates: Candidate[] = [];
  for (const [index, previous] of scenario.decisions.entries()) {
    const original = initiativeFor(demoConfig, previous)!;
    for (const alternative of demoConfig.initiatives.filter(
      (i) => i.category === original.category,
    )) {
      for (const district_id of alternative.eligible_district_ids) {
        if (
          alternative.id === previous.initiative_id &&
          district_id === previous.district_id
        )
          continue;
        const decisions: Decision[] = scenario.decisions.map((d, i) =>
          i === index ? { initiative_id: alternative.id, district_id } : d,
        );
        if (totalCost(demoConfig, decisions) > demoConfig.initial_budget)
          continue;
        const result = simulate({
          dataset_version: demoConfig.dataset_version,
          decisions,
        });
        if (result.final.score <= scenario.final.score + 1e-8) continue;
        const district = demoConfig.districts.find(
          (d) => d.id === district_id,
        )!;
        candidates.push({
          candidate_id: `${index}:${alternative.id}:${district_id}`,
          title: `${alternative.name} in ${district.name}`,
          explanation: `Replace ${original.name} in ${demoConfig.districts.find((d) => d.id === previous.district_id)!.name}. This tested single-decision change improves your score by ${number(result.final.score - scenario.final.score)} points.`,
          decisions,
          total_cost: result.total_cost,
          score: result.final.score,
        });
      }
    }
  }
  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.total_cost - b.total_cost ||
        a.candidate_id.localeCompare(b.candidate_id),
    )
    .slice(0, 3);
}

export function demoAnalysis(scenario: Scenario): Analysis {
  const changes = scenario.final.districts
    .map((d) => ({
      district: d,
      gain:
        d.score - scenario.baseline.districts.find((b) => b.id === d.id)!.score,
    }))
    .sort((a, b) => b.gain - a.gain);
  const lowest = [...scenario.final.districts].sort(
    (a, b) => a.score - b.score,
  )[0];
  const untouched = changes
    .filter((d) => Math.abs(d.gain) < 1e-8)
    .map((d) => d.district.name);
  return {
    status: "completed",
    source: "rules",
    summary: `Your plan spends ${scenario.total_cost} of ${scenario.initial_budget} units and changes the quality of life score from ${number(scenario.baseline.score)} to ${number(scenario.final.score)}. This is a synthetic model result, not a forecast.`,
    strengths: [
      `${changes[0].district.name} has the largest district-score improvement (${signed(changes[0].gain)} points).`,
      `All five development areas have a decision, with ${scenario.remaining_budget} budget units remaining.`,
    ],
    risks: [
      `${lowest.name} remains the lowest-scoring district at ${number(lowest.score)}.`,
      untouched.length
        ? `${untouched.join(", ")} receive no net indicator improvement in this plan.`
        : "All districts show a net change; check whether the gains are distributed fairly.",
      "The model does not estimate implementation time or recurring operating costs.",
    ],
    tradeoffs: scenario.decisions.flatMap(
      (d) => initiativeFor(demoConfig, d)!.tradeoffs,
    ),
    recommendations: recommend(scenario),
  };
}
