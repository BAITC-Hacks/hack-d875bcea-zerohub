// Regenerate the backend handoff examples directly from the demo's typed model.
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { demoConfig, simulate, demoAnalysis } = await server.ssrLoadModule(
    "/src/demo/engine.ts",
  );
  const decisions = [
    { initiative_id: "transport_bus_priority", district_id: "district_01" },
    { initiative_id: "greening_pocket_park", district_id: "district_02" },
    { initiative_id: "social_clinic_upgrade", district_id: "district_03" },
    { initiative_id: "safety_crossings", district_id: "district_01" },
    { initiative_id: "services_maintenance", district_id: "district_04" },
  ];
  const completeRequest = { dataset_version: "v1", decisions };
  const previewRequest = {
    dataset_version: "v1",
    decisions: decisions.slice(0, 3),
  };
  const scenario = {
    ...simulate(completeRequest),
    id: "example-scenario-001",
    created_at: "2026-09-23T00:00:00Z",
    decisions,
  };
  const fixtures = {
    "config-response.json": demoConfig,
    "preview-request.json": previewRequest,
    "preview-response.json": simulate(previewRequest),
    "scenario-request.json": completeRequest,
    "completed-scenario.json": scenario,
    "analysis-response.json": demoAnalysis(scenario),
  };
  await mkdir("contracts", { recursive: true });
  for (const [name, data] of Object.entries(fixtures)) {
    await writeFile(`contracts/${name}`, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`Wrote ${Object.keys(fixtures).length} contract examples.`);
} finally {
  await server.close();
}
