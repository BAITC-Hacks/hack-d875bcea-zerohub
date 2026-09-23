# Verification record

Verified on 2026-09-23 with Node.js 24.19.0 and npm 11.9.0.

| Check | Result |
| --- | --- |
| Clean installation using the committed lockfile (`npm ci --ignore-scripts`) | Passed |
| TypeScript and production bundle (`npm run build`) | Passed |
| Unit tests (`npm test`) | 8 passed |
| Chromium browser scenarios | All 5 passed; one test interceptor was corrected and its test rerun |
| Desktop overview, simulator and results visual inspection | Passed |
| Mobile layout at 375px width after spacing adjustment | No horizontal overflow; checked visually |

Browser checks cover the complete demo journey, budget controls, cheaper replacements, saved drafts and results, comparison, keyboard tabs, explicit backend errors, AI-service failure, and stale asynchronous previews.

Browser API responses were intercepted using the documented contract. These checks do not certify Person 2's real backend or Person 3's live AI implementation. The production Docker recipe has not been executed here.

The browser-download CDN was unavailable in this environment, so the checks used a separately provisioned Chromium binary through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. That binary is not part of the deliverable. On your machine, the usual `npx playwright install chromium` setup is documented in the README.

Vite emitted non-fatal comments about dependency purity annotations in Zod. The build completed successfully.
