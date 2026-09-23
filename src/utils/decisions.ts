import {
  CATEGORIES,
  type Category,
  type Configuration,
  type Decision,
} from "../types/simulation";

export function initiativeFor(config: Configuration, decision?: Decision) {
  return decision
    ? config.initiatives.find((i) => i.id === decision.initiative_id)
    : undefined;
}
export function decisionFor(
  config: Configuration,
  decisions: Decision[],
  category: Category,
) {
  return decisions.find((d) => initiativeFor(config, d)?.category === category);
}
export function totalCost(config: Configuration, decisions: Decision[]) {
  return decisions.reduce(
    (sum, d) => sum + (initiativeFor(config, d)?.cost ?? 0),
    0,
  );
}
export function replaceDecision(
  config: Configuration,
  decisions: Decision[],
  next: Decision,
): Decision[] {
  const initiative = initiativeFor(config, next);
  if (!initiative) throw new Error("Unknown initiative.");
  if (!initiative.eligible_district_ids.includes(next.district_id))
    throw new Error("This initiative is not available in that district.");
  const proposed = [
    ...decisions.filter(
      (d) => initiativeFor(config, d)?.category !== initiative.category,
    ),
    next,
  ];
  if (totalCost(config, proposed) > config.initial_budget)
    throw new Error(
      "This change exceeds your budget. Choose a lower-cost initiative.",
    );
  return CATEGORIES.flatMap((k) =>
    proposed.filter((d) => initiativeFor(config, d)?.category === k),
  );
}
export function validateDecisions(
  config: Configuration,
  decisions: Decision[],
  complete = false,
): void {
  if (decisions.length > 5 || (complete && decisions.length !== 5))
    throw new Error("Choose exactly one decision in all five categories.");
  const seen = new Set<Category>();
  for (const d of decisions) {
    const i = initiativeFor(config, d);
    if (!i || !config.districts.some((x) => x.id === d.district_id))
      throw new Error("Unknown initiative or district.");
    if (seen.has(i.category))
      throw new Error("Each category can have only one decision.");
    if (!i.eligible_district_ids.includes(d.district_id))
      throw new Error("Initiative is not eligible in that district.");
    seen.add(i.category);
  }
  if (totalCost(config, decisions) > config.initial_budget)
    throw new Error(
      "The budget cannot exceed 100% of the starting allocation.",
    );
}
