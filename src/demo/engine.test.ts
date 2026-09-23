import { describe, expect, it } from "vitest";
import { demoAnalysis, demoConfig, recommend, simulate } from "./engine";
import {
  ConfigSchema,
  ScenarioSchema,
  type Decision,
} from "../types/simulation";
import {
  replaceDecision,
  totalCost,
  validateDecisions,
} from "../utils/decisions";

const medium: Decision[] = [
  { initiative_id: "transport_bus_priority", district_id: "district_01" },
  { initiative_id: "greening_pocket_park", district_id: "district_02" },
  { initiative_id: "social_clinic_upgrade", district_id: "district_03" },
  { initiative_id: "safety_crossings", district_id: "district_01" },
  { initiative_id: "services_maintenance", district_id: "district_04" },
];
const request = (decisions: Decision[]) => ({
  dataset_version: "v1",
  decisions,
});
const completeScenario = () =>
  ScenarioSchema.parse({
    ...simulate(request(medium)),
    id: "test",
    created_at: "2026-09-23T00:00:00Z",
    decisions: medium,
  });

describe("shared demo model and UI decision rules", () => {
  it("starts every new plan with 100 units and the independently calculated baseline", () => {
    const initial = simulate(request([]));
    expect(initial.remaining_budget).toBe(100);
    expect(initial.baseline.city_average).toBeCloseTo(15335 / 320, 8);
    expect(initial.baseline.lowest_district).toBe(44);
    expect(initial.final.score).toBeCloseTo(0.8 * (15335 / 320) + 0.2 * 44, 8);
    expect(initial.final).toEqual(initial.baseline);
  });
  it("accepts exactly 100, rejects overspending, and never mutates the baseline", () => {
    const initial = structuredClone(demoConfig);
    expect(simulate(request(medium)).remaining_budget).toBe(0);
    expect(() =>
      simulate(
        request([
          { initiative_id: "transport_junction", district_id: "district_01" },
          ...medium.slice(1),
        ]),
      ),
    ).toThrow(/budget/);
    expect(demoConfig).toEqual(initial);
  });
  it("releases the original cost before testing a replacement", () => {
    const changed = replaceDecision(demoConfig, medium, {
      initiative_id: "transport_bus_stops",
      district_id: "district_01",
    });
    expect(changed).toHaveLength(5);
    expect(totalCost(demoConfig, changed)).toBe(90);
    expect(simulate(request(changed)).final.score).not.toEqual(
      simulate(request(medium)).final.score,
    );
  });
  it("rejects duplicate categories, unknown IDs, incomplete submission and wrong dataset", () => {
    expect(() => validateDecisions(demoConfig, [medium[0], medium[0]])).toThrow(
      /category/,
    );
    expect(() =>
      validateDecisions(demoConfig, [
        { initiative_id: "invented", district_id: "district_01" },
      ]),
    ).toThrow(/Unknown/);
    expect(() =>
      validateDecisions(demoConfig, medium.slice(0, 4), true),
    ).toThrow(/five/);
    expect(() => simulate({ dataset_version: "other", decisions: [] })).toThrow(
      /Dataset/,
    );
  });
  it("calculates each preview afresh and is independent of decision order", () => {
    const one = simulate(request(medium));
    expect(simulate(request(medium))).toEqual(one);
    expect(simulate(request([...medium].reverse()))).toEqual(one);
  });
  it("clamps after adding all effects, so opposing effects do not depend on order", () => {
    const config = structuredClone(demoConfig);
    config.districts[0].indicators.transport = 95;
    config.initiatives.find(
      (i) => i.id === "greening_pocket_park",
    )!.effects.transport = -8;
    const ds = [medium[0], { ...medium[1], district_id: "district_01" }];
    expect(
      simulate(request(ds), config).final.districts[0].indicators.transport,
    ).toBe(99);
    expect(simulate(request(ds), config)).toEqual(
      simulate(request([...ds].reverse()), config),
    );
    config.districts[0].indicators.transport = 100;
    expect(
      simulate(request([medium[0]]), config).final.districts[0].indicators
        .transport,
    ).toBe(100);
  });
  it("returns affordable, valid, higher-scoring single-decision alternatives", () => {
    const scenario = completeScenario();
    const candidates = recommend(scenario);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      validateDecisions(demoConfig, c.decisions, true);
      expect(c.total_cost).toBeLessThanOrEqual(100);
      expect(c.score).toBeGreaterThan(scenario.final.score);
      expect(c.score).toBe(simulate(request(c.decisions)).final.score);
      expect(
        c.decisions.filter(
          (d, i) => JSON.stringify(d) !== JSON.stringify(scenario.decisions[i]),
        ),
      ).toHaveLength(1);
    }
    expect(demoAnalysis(scenario).source).toBe("rules");
  });
  it("rejects invalid model weights and district references from a backend", () => {
    const config = structuredClone(demoConfig);
    config.indicator_weights.transport = 0.9;
    expect(ConfigSchema.safeParse(config).success).toBe(false);
    config.indicator_weights.transport = 0.2;
    config.initiatives[0].eligible_district_ids = ["missing"];
    expect(ConfigSchema.safeParse(config).success).toBe(false);
  });
});
