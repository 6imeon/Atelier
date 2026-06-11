import { describe, it, expect, vi } from "vitest";
import {
  parseRefinePasses,
  getRefinePasses,
  stagedRefineHtml,
  REFINE_PASS_ORDER,
  type RefinePass,
} from "../utils/staged-refine.js";

describe("parseRefinePasses", () => {
  it("returns [] when unset or empty", () => {
    expect(parseRefinePasses(undefined)).toEqual([]);
    expect(parseRefinePasses("")).toEqual([]);
    expect(parseRefinePasses("   ")).toEqual([]);
  });

  it("returns [] for explicit 'none'", () => {
    expect(parseRefinePasses("none")).toEqual([]);
    expect(parseRefinePasses("NONE")).toEqual([]);
  });

  it("expands 'all' to canonical order", () => {
    expect(parseRefinePasses("all")).toEqual(REFINE_PASS_ORDER);
  });

  it("parses a comma list in canonical order regardless of input order", () => {
    expect(parseRefinePasses("typography,font")).toEqual(["font", "typography"]);
    expect(parseRefinePasses("components, palette , states")).toEqual([
      "palette", "states", "components",
    ]);
  });

  it("drops unknown names and deduplicates", () => {
    expect(parseRefinePasses("font, font, bogus, typography")).toEqual([
      "font", "typography",
    ]);
  });
});

describe("getRefinePasses env flag", () => {
  it("defaults to [] when env is unset", () => {
    delete process.env.CANVAS_REFINE_PASSES;
    expect(getRefinePasses()).toEqual([]);
  });

  it("returns canonical order when set to 'all'", () => {
    process.env.CANVAS_REFINE_PASSES = "all";
    expect(getRefinePasses()).toEqual(REFINE_PASS_ORDER);
    delete process.env.CANVAS_REFINE_PASSES;
  });

  it("is subset-friendly and case-insensitive", () => {
    process.env.CANVAS_REFINE_PASSES = "Font,Palette";
    expect(getRefinePasses()).toEqual(["font", "palette"]);
    delete process.env.CANVAS_REFINE_PASSES;
  });
});

describe("stagedRefineHtml", () => {
  it("is a no-op when no passes are configured", async () => {
    const routerStub = { routeJSON: vi.fn() } as any;
    const out = await stagedRefineHtml("<!DOCTYPE html><html></html>", {
      passes: [],
      router: routerStub,
    });
    expect(out.html).toBe("<!DOCTYPE html><html></html>");
    expect(out.passesRun).toEqual([]);
    expect(routerStub.routeJSON).not.toHaveBeenCalled();
  });

  it("runs each configured pass and chains the output", async () => {
    const responses = [
      "<!DOCTYPE html><html>after-font</html>",
      "<!DOCTYPE html><html>after-palette</html>",
    ];
    const routerStub = {
      routeJSON: vi.fn(async () => ({ html: responses.shift()! })),
    } as any;
    const out = await stagedRefineHtml("<!DOCTYPE html><html>before</html>", {
      passes: ["font", "palette"],
      router: routerStub,
    });
    expect(routerStub.routeJSON).toHaveBeenCalledTimes(2);
    expect(out.passesRun).toEqual(["font", "palette"]);
    expect(out.html).toBe("<!DOCTYPE html><html>after-palette</html>");
    // Second call must see the first pass's output.
    const secondCallMessages = routerStub.routeJSON.mock.calls[1][1];
    expect(secondCallMessages[1].content).toBe("<!DOCTYPE html><html>after-font</html>");
  });

  it("keeps prior HTML when a pass returns a suspiciously short response", async () => {
    const longHtml = "<!DOCTYPE html><html>" + "x".repeat(3000) + "</html>";
    const routerStub = {
      routeJSON: vi.fn(async () => ({ html: "<html>oops</html>" })),
    } as any;
    const passes: RefinePass[] = ["font"];
    const out = await stagedRefineHtml(longHtml, { passes, router: routerStub });
    expect(out.html).toBe(longHtml);
    expect(out.passesRun).toEqual([]);
    expect(out.perPass[0].changed).toBe(false);
  });

  it("continues past a failed pass", async () => {
    const calls = [
      Promise.reject(new Error("network")),
      Promise.resolve({ html: "<!DOCTYPE html><html>after-palette</html>" }),
    ];
    const routerStub = {
      routeJSON: vi.fn(() => calls.shift()!),
    } as any;
    const out = await stagedRefineHtml("<!DOCTYPE html><html>before</html>", {
      passes: ["font", "palette"],
      router: routerStub,
    });
    expect(out.passesRun).toEqual(["palette"]);
    expect(out.html).toBe("<!DOCTYPE html><html>after-palette</html>");
  });
});
