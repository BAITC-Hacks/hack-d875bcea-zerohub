import type { z } from "zod";

const configuredMode = import.meta.env.VITE_DATA_MODE ?? "demo";
export const DATA_MODE = configuredMode === "api" ? "api" : "demo";
export const MODE_ERROR = ["api", "demo"].includes(configuredMode)
  ? null
  : "VITE_DATA_MODE must be demo or api. Fix your environment and restart Vite.";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);

function serverError(body: unknown, status: number) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = body.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
      return detail
        .map((d) => (typeof d?.msg === "string" ? d.msg : "Invalid request"))
        .join("; ");
  }
  return `The server returned HTTP ${status}. Please try again.`;
}

export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeout?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeout ?? 20000);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "The backend did not return JSON. Check VITE_API_BASE_URL and the /api proxy.",
      );
    }
    if (!response.ok) throw new Error(serverError(body, response.status));
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new Error(
        `Backend response does not match the agreed contract (${parsed.error.issues[0]?.path.join(".") || "response"}). See docs/API-CONTRACT.md.`,
      );
    return parsed.data;
  } catch (error) {
    if (timedOut)
      throw new Error(
        "The request timed out. Your decisions are still available; please retry.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the backend. Check that it is running and that its URL and CORS settings are correct.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
