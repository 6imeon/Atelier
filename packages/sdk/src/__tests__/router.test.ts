import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRouter, RouterError, MODEL_CONFIG } from "../utils/router.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chatResponse(content: string) {
  return jsonResponse({ choices: [{ message: { content } }] });
}

describe("ModelRouter", () => {
  let router: ModelRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new ModelRouter({ apiKey: "test-key" });
  });

  it("throws without an API key", () => {
    const orig = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    expect(() => new ModelRouter({ apiKey: "" })).toThrow("OpenRouter API key required");
    process.env.OPENROUTER_API_KEY = orig;
  });

  it("routes to primary model for a given stage", async () => {
    mockFetch.mockResolvedValueOnce(chatResponse('{"result": true}'));
    await router.route("intent_parse", [{ role: "user", content: "test" }]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe(MODEL_CONFIG.intent_parse.primary);
  });

  it("falls back to secondary model on primary failure", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(chatResponse('{"fallback": true}'));

    const res = await router.route("intent_parse", [{ role: "user", content: "test" }]);
    expect(res.ok).toBe(true);

    const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondBody.model).toBe(MODEL_CONFIG.intent_parse.fallback);
  });

  it("throws RouterError when both models fail", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("error", { status: 503 }));

    await expect(
      router.route("intent_parse", [{ role: "user", content: "test" }])
    ).rejects.toThrow(RouterError);
  });

  it("respects max retry count", async () => {
    mockFetch.mockResolvedValue(new Response("error", { status: 500 }));

    await expect(
      router.route("intent_parse", [{ role: "user", content: "test" }], { retryCount: 3 })
    ).rejects.toThrow("Max retries exceeded");
  });

  describe("routeJSON", () => {
    it("parses JSON from model response", async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('{"name": "test", "count": 42}'));

      const result = await router.routeJSON("intent_parse", [{ role: "user", content: "test" }]);
      expect(result).toEqual({ name: "test", count: 42 });
    });

    it("strips markdown code fences from response", async () => {
      mockFetch.mockResolvedValueOnce(chatResponse('```json\n{"clean": true}\n```'));

      const result = await router.routeJSON("intent_parse", [{ role: "user", content: "test" }]);
      expect(result).toEqual({ clean: true });
    });

    it("throws on invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce(chatResponse("not json at all"));

      await expect(
        router.routeJSON("intent_parse", [{ role: "user", content: "test" }])
      ).rejects.toThrow('Failed to parse response from "intent_parse"');
    });
  });
});
