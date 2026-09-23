from dataclasses import dataclass

from app.schemas import CATEGORIES
from app.services.ai_advisor import AnalysisContext

DISCLAIMER = "All effects are synthetic simulation assumptions, not an official Astana index or a real-world forecast."


@dataclass(frozen=True)
class Fact:
    value: str
    meaning: str


@dataclass(frozen=True)
class Evidence:
    facts: dict[str, Fact]
    candidates: dict[str, dict]

    def prompt_data(self) -> dict:
        return {
            "facts": {
                key: {"value": fact.value, "meaning": fact.meaning}
                for key, fact in self.facts.items()
            },
            "candidate_references": self.candidates,
        }


def build_evidence(context: AnalysisContext) -> Evidence:
    """Format facts from trusted backend results. Do not recalculate the official score."""
    scenario, config = context.scenario, context.configuration
    facts: dict[str, Fact] = {}
    candidates = {}

    def add(key, value, meaning):
        facts[key] = Fact(str(value), meaning)

    def points(key, value, meaning):
        add(key, f"{value:.1f}", meaning)

    add("project.title", "Akim for 5 Hours", "Project name")
    add(
        "budget.total",
        scenario.initial_budget,
        "Shared starting virtual budget, not real currency",
    )
    add(
        "budget.spent",
        scenario.total_cost,
        "Accepted total cost in virtual budget units",
    )
    add("budget.remaining", scenario.remaining_budget, "Unspent virtual budget units")
    add(
        "plan.decisions",
        len(scenario.decisions),
        "Number of decisions, one per development area",
    )
    points(
        "score.before", scenario.baseline.score, "Starting city Quality of Life Score"
    )
    points("score.after", scenario.final.score, "Final city Quality of Life Score")
    points(
        "score.change",
        scenario.final.score - scenario.baseline.score,
        "Signed city-score change in points, not a percentage",
    )
    for label, snapshot in (("before", scenario.baseline), ("after", scenario.final)):
        points(
            f"city.average.{label}",
            snapshot.city_average,
            "Population-weighted district score " + label,
        )
        points(
            f"city.lowest.{label}",
            snapshot.lowest_district,
            "Lowest district score " + label,
        )
    add(
        "model.formula",
        f"{config.city_average_weight * 100:g}% population-weighted district average plus {config.lowest_district_weight * 100:g}% lowest district score",
        "Actual city scoring formula",
    )
    add(
        "model.limitations",
        "Implementation time and recurring operating costs are not simulated.",
        "Explicit model limitation",
    )
    add("model.synthetic", DISCLAIMER, "Required interpretation of the synthetic model")
    initial = {district.id: district for district in scenario.baseline.districts}
    for index, district in enumerate(scenario.final.districts):
        prefix = f"district.d{index}"
        add(prefix + ".name", district.name, "District display name")
        points(
            prefix + ".before",
            initial[district.id].score,
            f"{district.name}: original district score",
        )
        points(
            prefix + ".after", district.score, f"{district.name}: final district score"
        )
        points(
            prefix + ".change",
            district.score - initial[district.id].score,
            f"{district.name}: signed district-score change in points",
        )
    population = sum(d.population for d in scenario.baseline.districts)
    for category in CATEGORIES:
        before = (
            sum(
                getattr(d.indicators, category) * d.population
                for d in scenario.baseline.districts
            )
            / population
        )
        after = (
            sum(
                getattr(d.indicators, category) * d.population
                for d in scenario.final.districts
            )
            / population
        )
        points(
            f"area.{category}.before",
            before,
            f"Citywide {category} quality before, weighted by population",
        )
        points(
            f"area.{category}.after",
            after,
            f"Citywide {category} quality after, weighted by population",
        )
        points(
            f"area.{category}.change",
            after - before,
            f"Signed citywide {category} quality change in points",
        )
    initiatives = {initiative.id: initiative for initiative in config.initiatives}
    districts = {district.id: district.name for district in config.districts}
    for decision in scenario.decisions:
        initiative = initiatives[decision.initiative_id]
        prefix = f"decision.{initiative.category}"
        add(
            prefix + ".name",
            initiative.name,
            "Chosen initiative in " + initiative.category,
        )
        add(
            prefix + ".district",
            districts[decision.district_id],
            "Target of " + initiative.name,
        )
        add(prefix + ".cost", initiative.cost, "Virtual cost of " + initiative.name)
        add(
            prefix + ".tradeoff",
            " ".join(initiative.tradeoffs),
            "Qualitative trade-offs of " + initiative.name,
        )
    for index, candidate in enumerate(context.candidates):
        prefix = f"candidate.c{index}"
        add(
            prefix + ".title",
            candidate.title,
            "Tested alternative initiative and target",
        )
        points(
            prefix + ".score",
            candidate.score,
            "Recalculated city score for this alternative",
        )
        points(
            prefix + ".gain",
            candidate.score - scenario.final.score,
            "Gain versus the current plan, in score points",
        )
        add(
            prefix + ".cost",
            candidate.total_cost,
            "Total plan cost after this replacement",
        )
        add(
            prefix + ".change",
            candidate.explanation,
            "Backend explanation of the single changed decision",
        )
        candidates[candidate.candidate_id] = {
            "prefix": prefix,
            "title": candidate.title,
        }
    return Evidence(facts=facts, candidates=candidates)
