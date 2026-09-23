import { z } from "zod";

export const CATEGORIES = [
  "transport",
  "greening",
  "social",
  "safety",
  "services",
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;
export const CATEGORY_LABELS: Record<Category, string> = {
  transport: "Transport",
  greening: "Greening",
  social: "Social infrastructure",
  safety: "Safety",
  services: "City services",
};
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  transport: "Make everyday journeys easier.",
  greening: "Bring nature closer to residents.",
  social: "Improve access to essential support.",
  safety: "Make public spaces safer for everyone.",
  services: "Keep the everyday city running.",
};
const finite = z.number().finite();
const point = finite.min(0).max(100);
const indicatorShape = {
  transport: point,
  greening: point,
  social: point,
  safety: point,
  services: point,
};
export const IndicatorsSchema = z.object(indicatorShape);
export type Indicators = z.infer<typeof IndicatorsSchema>;
const EffectsSchema = z.object({
  transport: finite,
  greening: finite,
  social: finite,
  safety: finite,
  services: finite,
});
export const DistrictSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  population: finite.int().positive(),
  indicators: IndicatorsSchema,
});
export type District = z.infer<typeof DistrictSchema>;
export const InitiativeSchema = z.object({
  id: z.string().min(1),
  category: CategorySchema,
  name: z.string().min(1),
  description: z.string(),
  cost: finite.int().nonnegative(),
  eligible_district_ids: z.array(z.string()).min(1),
  effects: EffectsSchema,
  tradeoffs: z.array(z.string()),
});
export type Initiative = z.infer<typeof InitiativeSchema>;
export const ConfigSchema = z
  .object({
    dataset_version: z.string(),
    engine_version: z.string(),
    initial_budget: finite.int().positive(),
    required_decisions: z.literal(5),
    indicator_weights: EffectsSchema,
    city_average_weight: finite.min(0).max(1),
    lowest_district_weight: finite.min(0).max(1),
    districts: z.array(DistrictSchema).min(1),
    initiatives: z.array(InitiativeSchema).min(5),
  })
  .superRefine((c, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      CATEGORIES.some((k) => c.indicator_weights[k] < 0) ||
      Math.abs(CATEGORIES.reduce((s, k) => s + c.indicator_weights[k], 0) - 1) >
        1e-8
    )
      bad("Indicator weights must be nonnegative and sum to 1.");
    if (Math.abs(c.city_average_weight + c.lowest_district_weight - 1) > 1e-8)
      bad("City score weights must sum to 1.");
    if (new Set(c.districts.map((d) => d.id)).size !== c.districts.length)
      bad("Duplicate district IDs.");
    if (new Set(c.initiatives.map((i) => i.id)).size !== c.initiatives.length)
      bad("Duplicate initiative IDs.");
    if (CATEGORIES.some((k) => !c.initiatives.some((i) => i.category === k)))
      bad("Each category needs an initiative.");
    if (
      c.initiatives.some((i) =>
        i.eligible_district_ids.some(
          (id) => !c.districts.some((d) => d.id === id),
        ),
      )
    )
      bad("An initiative references an unknown district.");
  });
export type Configuration = z.infer<typeof ConfigSchema>;
export const DecisionSchema = z.object({
  initiative_id: z.string(),
  district_id: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;
export const ScenarioRequestSchema = z.object({
  dataset_version: z.string(),
  decisions: z.array(DecisionSchema).max(5),
});
export type ScenarioRequest = z.infer<typeof ScenarioRequestSchema>;
export const ScoredDistrictSchema = DistrictSchema.extend({ score: point });
export type ScoredDistrict = z.infer<typeof ScoredDistrictSchema>;
const ScoreSnapshotSchema = z.object({
  districts: z.array(ScoredDistrictSchema).min(1),
  city_average: point,
  lowest_district: point,
  score: point,
});
export type ScoreSnapshot = z.infer<typeof ScoreSnapshotSchema>;
export const PreviewSchema = z.object({
  dataset_version: z.string(),
  engine_version: z.string(),
  decision_count: finite.int().min(0).max(5),
  complete: z.boolean(),
  initial_budget: finite.int().positive(),
  total_cost: finite.int().nonnegative(),
  remaining_budget: finite.int().nonnegative(),
  baseline: ScoreSnapshotSchema,
  final: ScoreSnapshotSchema,
});
export type Preview = z.infer<typeof PreviewSchema>;
export const ScenarioSchema = PreviewSchema.extend({
  id: z.string().min(1),
  created_at: z.string(),
  decisions: z.array(DecisionSchema).length(5),
  complete: z.literal(true),
  decision_count: z.literal(5),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
export const CandidateSchema = z.object({
  candidate_id: z.string(),
  title: z.string(),
  explanation: z.string(),
  decisions: z.array(DecisionSchema).length(5),
  total_cost: finite.int().nonnegative(),
  score: point,
});
export type Candidate = z.infer<typeof CandidateSchema>;
export const AnalysisSchema = z.object({
  status: z.literal("completed"),
  source: z.enum(["ai", "rules"]),
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  tradeoffs: z.array(z.string()),
  recommendations: z.array(CandidateSchema),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
