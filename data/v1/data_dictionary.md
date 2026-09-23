# Synthetic dataset v1

The JSON data here is copied from the Person 1 frontend's contract fixture, then split into the three agreed files. It is synthetic, contains no personal data, and is not a description of real Astana districts.

| Field | Meaning |
| --- | --- |
| `districts[].id` | Stable district identifier referenced by decisions |
| `districts[].name` | Hypothetical display name (District A–F) |
| `population` | Synthetic population, used to weight the city average |
| `indicators.transport` | Transport quality, 0–100; higher is better |
| `indicators.greening` | Availability/quality of green space, 0–100 |
| `indicators.social` | Social infrastructure quality, 0–100 |
| `indicators.safety` | Public safety quality, 0–100 |
| `indicators.services` | City service quality, 0–100 |
| `initiatives[].cost` | Integer virtual budget units, not tenge or a cost forecast |
| `eligible_district_ids` | Districts where this initiative may be selected |
| `effects` | Assumed additive point changes in the target district; negative values allowed |
| `tradeoffs` | Qualitative considerations; no numeric effect unless included in `effects` |

Every user starts with 100 units. There are 15 initiatives (three per category), with costs of 10, 20, or 30 units. One initiative targets one district. Multiple categories may target the same district. Exactly one decision per category is required for a saved scenario.

Effects are accumulated against the original baseline and then clipped to 0–100. The simulation assumes effects appear immediately. It does not estimate construction timelines, real policy effectiveness, maintenance budgets or causal uncertainty.

The model weights the five indicators equally. The final score is 80% population-weighted district average + 20% lowest district score. Baseline: **47.1375**. Display rounding belongs to the frontend.

Person 3 may propose a revised dataset. Keep IDs aligned with frontend choices, run tests, and increment `dataset_version` when changing populations, indicators, costs, effects or weights. The server rejects changed content under an already registered dataset/engine version. Change `engine_version` and implementation together for an algorithm change; this code implements engine `1.0`.
