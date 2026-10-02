import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fetchWithTimeout } from "../services/fetch-with-timeout";
import { checkBackendHealth } from "../services/backend-health";
import { HttpInspectionApi } from "../services/http-inspection-api";
import { InspectionApiError } from "../services/inspection-errors";
import { parseResult } from "../services/inspection-response";
import { handleStubHealth, handleStubRequest } from "../lib/dev-http-stub";
import { mockResult, mockVehicle } from "../lib/mock-data";
import { createMockFrame } from "../lib/mock-frames";
import { confidenceLevel } from "../lib/inspection-labels";
import {
  clearInspectionSession,
  sessionStorageKey,
} from "../lib/inspection-session";
const code = (expected: string) => (error: unknown) =>
  error instanceof InspectionApiError && error.code === expected;
const readResponse = async (response: Response) => {
  if (!response.ok)
    throw new InspectionApiError("NETWORK_ERROR", undefined, response.status);
  return response.json();
};
test("GET retry stops after two retries; POST, invalid response and non-transient 4xx are never replayed", async () => {
  for (const method of ["GET", "POST"]) {
    let calls = 0;
    await assert.rejects(
      fetchWithTimeout(
        "http://test",
        { method },
        {
          readResponse,
          retryDelayMs: 0,
          fetcher: async () => {
            calls++;
            return new Response("private", { status: 503 });
          },
        },
      ),
      code("NETWORK_ERROR"),
    );
    assert.equal(calls, method === "GET" ? 3 : 1);
  }
  for (const status of [400, 404, 409, 422]) {
    let calls = 0;
    await assert.rejects(
      fetchWithTimeout(
        "http://test",
        {},
        {
          readResponse,
          retryDelayMs: 0,
          fetcher: async () => {
            calls++;
            return new Response("", { status });
          },
        },
      ),
    );
    assert.equal(calls, 1);
  }
  let calls = 0;
  const api = new HttpInspectionApi("http://test", 10, async () => {
    calls++;
    return new Response("bad JSON");
  });
  await assert.rejects(api.getInspectionStatus("id"), code("INVALID_RESPONSE"));
  assert.equal(calls, 1);
});
test("retry succeeds on a transient read and abort during backoff prevents another request", async () => {
  let calls = 0;
  assert.deepEqual(
    await fetchWithTimeout(
      "http://test",
      {},
      {
        readResponse,
        retryDelayMs: 0,
        fetcher: async () =>
          ++calls < 3
            ? new Response("", { status: 500 })
            : Response.json({ status: "ok" }),
      },
    ),
    { status: "ok" },
  );
  const controller = new AbortController();
  calls = 0;
  const pending = fetchWithTimeout(
    "http://test",
    { signal: controller.signal },
    {
      readResponse,
      retryDelayMs: 100,
      fetcher: async () => {
        calls++;
        setTimeout(() => controller.abort(), 5);
        return new Response("", { status: 503 });
      },
    },
  );
  await assert.rejects(pending, code("ABORTED"));
  assert.equal(calls, 1);
});
test("timeout covers a stalled response body, not just response headers", async () => {
  const pending = fetchWithTimeout(
    "http://test",
    {},
    {
      readResponse,
      timeoutMs: 10,
      retries: 0,
      fetcher: async (_url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"status":'));
              init?.signal?.addEventListener(
                "abort",
                () => controller.error(new DOMException("", "AbortError")),
                { once: true },
              );
            },
          }),
        ),
    },
  );
  await assert.rejects(pending, code("TIMEOUT"));
});
test("health is read-only, recognizes missing/malformed contracts and safe connection failures", async () => {
  const paths: string[] = [];
  assert.equal(
    await checkBackendHealth("https://backend.test/prefix", {
      fetcher: async (input) => {
        paths.push(String(input));
        return Response.json({ status: "ok" });
      },
    }),
    "reachable",
  );
  assert.deepEqual(paths, ["https://backend.test/prefix/health"]);
  for (const response of [
    new Response("", { status: 404 }),
    Response.json({ status: "bad" }),
    new Response("bad-json"),
  ])
    assert.equal(
      await checkBackendHealth("http://test", {
        fetcher: async () => response,
      }),
      "unknown",
    );
  assert.equal(
    await checkBackendHealth("http://test", {
      fetcher: async () => new Response("private", { status: 503 }),
    }),
    "unreachable",
  );
  const signal = AbortSignal.abort();
  assert.equal(
    await checkBackendHealth("http://test", {
      signal,
      fetcher: async () => {
        throw new Error("should not fetch");
      },
    }),
    "unknown",
  );
});
test("invalid frames never issue HTTP; JPEG, PNG and WebP preserve bytes and one metadata field", async () => {
  let calls = 0;
  const frame = createMockFrame(0, 500);
  const api = new HttpInspectionApi("http://test", 100, async (_url, init) => {
    calls++;
    const form = init?.body as FormData;
    assert.equal(form.getAll("frames").length, 1);
    assert.equal(form.getAll("metadata").length, 1);
    assert.equal((form.get("frames") as File).size, 4);
    assert.equal(new Headers(init?.headers).has("Content-Type"), false);
    return Response.json({ accepted: 1 });
  });
  for (const invalid of [
    [],
    [frame],
    [{ ...frame, blob: new Blob([], { type: "image/jpeg" }) }],
    [{ ...frame, blob: new Blob(["bad"], { type: "image/svg+xml" }) }],
  ])
    await assert.rejects(
      api.uploadInspectionFrames("id", invalid),
      code("INVALID_FRAMES"),
    );
  assert.equal(calls, 0);
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    await api.uploadInspectionFrames("id", [
      { ...frame, blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type }) },
    ]);
  assert.equal(calls, 3);
});
test("multiple results, unknown backend labels and sample wire JSON remain compatible", () => {
  const damages = [
    mockResult.damages[0],
    {
      ...mockResult.damages[0],
      id: "d2",
      part: "future_part",
      damageType: "future_mark",
      confidence: 0.54,
    },
  ];
  const result = parseResult(
    { ...mockResult, damages, missingAreas: ["roof_v2"] },
    mockResult.inspectionId,
  );
  assert.equal(result.damages.length, 2);
  assert.equal(result.damages[1].part, "unknown");
  assert.equal(result.damages[1].rawPart, "future_part");
  assert.equal(result.damages[1].rawDamageType, "future_mark");
  assert.deepEqual(result.missingAreas, ["unknown"]);
  for (const file of [
    "result-potential-damage.json",
    "result-no-damage.json",
  ]) {
    const sample = JSON.parse(readFileSync(`docs/examples/${file}`, "utf8"));
    parseResult(sample, sample.inspectionId, {
      vehicle: mockVehicle,
      createdAt: "2026-10-02T00:00:00Z",
    });
  }
  for (const confidence of [-1, 1.1, NaN, Infinity])
    assert.throws(
      () =>
        parseResult(
          { ...mockResult, damages: [{ ...damages[0], confidence }] },
          mockResult.inspectionId,
        ),
      code("INVALID_RESPONSE"),
    );
  assert.equal(confidenceLevel(0.85), "高信心度");
  assert.equal(confidenceLevel(0.65), "中信心度");
  assert.equal(confidenceLevel(0.649), "低信心度");
});
test("session reset removes only the inspection key and tolerates unavailable storage", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map([
    [sessionStorageKey, "inspection"],
    ["unrelated-key", "keep"],
  ]);
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: { removeItem: (key: string) => values.delete(key) },
    },
  });
  try {
    clearInspectionSession();
    assert.equal(values.has(sessionStorageKey), false);
    assert.equal(values.get("unrelated-key"), "keep");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get sessionStorage() {
          throw new Error("blocked");
        },
      },
    });
    assert.doesNotThrow(clearInspectionSession);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("development health contract is exact and all stub handlers stay unavailable in production", async () => {
  const original = process.env.NODE_ENV;
  try {
    Object.assign(process.env, { NODE_ENV: "development" });
    assert.deepEqual(
      await handleStubHealth(new Request("http://test/api/dev/health")).json(),
      { status: "ok", service: "ai-vehicle-inspection-dev-stub" },
    );
    assert.equal(
      handleStubHealth(new Request("http://test/api/dev/health?failure=503"))
        .status,
      503,
    );
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(
      handleStubHealth(new Request("http://test/api/dev/health")).status,
      404,
    );
    assert.equal(
      (
        await handleStubRequest(
          new Request("http://test/api/dev/api/v1/inspections"),
          [],
        )
      ).status,
      404,
    );
  } finally {
    if (original === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: original });
  }
});
