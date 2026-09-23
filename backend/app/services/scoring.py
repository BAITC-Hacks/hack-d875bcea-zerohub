from app.schemas import CATEGORIES, Configuration, District, ScoredDistrict, ScoreSnapshot

ENGINE_VERSION = "1.0"


def calculate_score(districts: list[District], config: Configuration) -> ScoreSnapshot:
    scored = [
        ScoredDistrict(
            **district.model_dump(),
            score=max(
                0.0,
                min(
                    100.0,
                    sum(
                        getattr(district.indicators, category)
                        * getattr(config.indicator_weights, category)
                        for category in CATEGORIES
                    ),
                ),
            ),
        )
        for district in districts
    ]
    population = sum(district.population for district in scored)
    average = max(
        0.0,
        min(100.0, sum(district.score * district.population for district in scored) / population),
    )
    lowest = min(district.score for district in scored)
    # Tiny floating-point overshoot is possible with valid decimal weights.
    final = max(
        0.0,
        min(100.0, config.city_average_weight * average + config.lowest_district_weight * lowest),
    )
    return ScoreSnapshot(
        districts=scored, city_average=average, lowest_district=lowest, score=final
    )
