# Person 4's demonstration and handoff

## Before presenting

Install the assembled release, run the automated checks, and start the application. Enable TeamAdvisor with the team's API key and verify a successful real AI assessment. Check that the report is labeled AI, and read its strengths, risks and trade-offs. Do not present the mocked-provider test application as a live model.

Record the source commit/release, dataset version, engine version, model and analysis version. Keep the model key private. The repo/ZIP, root README and a short recording should be available for submission.

## Three-minute demonstration

1. **Problem, about 20 seconds.** “City decisions compete for one budget. This simulator makes the trade-offs visible using the same starting conditions for everyone.” Explain that the districts and effects are synthetic.
2. **Budget and decisions, about 60 seconds.** Open the simulator. Show the 100-unit budget and all five areas. Select the distributed medium-cost plan below. Attempt a more expensive transport option and show that the budget constraint prevents overspending.
3. **Results, about 45 seconds.** Submit. Show the before/after score and district indicators. Explain that the score is calculated by code; AI explains its strengths, risks and possible consequences. Point to an actual trade-off from the displayed report.
4. **Alternative, about 35 seconds.** Refine the plan with a cheaper transport measure or a tested recommendation. Submit again and compare the plans. Explain why a different allocation changes the result.
5. **Reproducibility, about 20 seconds.** Show the README and verification record. Name the synthetic-data limitations and the next step of calibrating assumptions with city experts.

## Repeatable medium-cost plan

| Area | Initiative | District | Cost |
|---|---|---|---:|
| transport | Bus-priority lanes | District A | 20 |
| greening | Neighborhood pocket park | District B | 20 |
| social | Local clinic upgrade | District C | 20 |
| safety | Safer pedestrian crossings | District D | 20 |
| services | District maintenance crew | District E | 20 |

Total cost: **100**. Baseline: **47.1375**. Expected final score: **49.819**, displayed as **49.8**. This exact plan is `distributed_medium_cost` in `data/person3/evaluation_cases.json`.

If the live provider fails during the demo, explain the failure honestly. The calculated score and saved scenario remain valid. You may demonstrate explicitly labeled rule-based mode, but that does not substitute for showing the required live AI capability.
