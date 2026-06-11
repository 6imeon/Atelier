/**
 * OpenRouter Multi-Model Router
 * Routes AI requests to the optimal model per pipeline stage with automatic fallback.
 */
import { z } from "zod";
import type { AnalyticsAdapter } from "../storage/interface.js";
import { NOOP_RUN, type PipelineRun } from "./logger.js";

export type PipelineStage = "intent_parse" | "vision_interpret" | "layout_generate" | "design_refine" | "code_render" | "design_extract" | "section_generate" | "section_classify" | "animation_brief";

export interface ModelConfig {
  primary: string;
  fallback: string;
  temperature: number;
  maxTokens: number;
  responseFormat?: { type: "json_object" };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [k: string]: any }>;
}

// Default model assignments — override per stage via CANVAS_MODEL_<STAGE> env vars
// e.g. CANVAS_MODEL_LAYOUT_GENERATE=anthropic/claude-opus-4
const DEFAULTS: Record<PipelineStage, ModelConfig> = {
  intent_parse:      { primary: "deepseek/deepseek-chat-v3-0324",  fallback: "qwen/qwen3-235b-a22b",           temperature: 0.1, maxTokens: 1000,  responseFormat: { type: "json_object" } },
  vision_interpret:  { primary: "moonshotai/kimi-k2.6",            fallback: "moonshotai/kimi-k2.5",            temperature: 0.3, maxTokens: 4000 },
  layout_generate:   { primary: "moonshotai/kimi-k2.6",            fallback: "moonshotai/kimi-k2.5",            temperature: 0.7, maxTokens: 16000 },
  design_refine:     { primary: "moonshotai/kimi-k2.6",            fallback: "moonshotai/kimi-k2.5",            temperature: 0.4, maxTokens: 16000 },
  code_render:       { primary: "deepseek/deepseek-chat-v3-0324",  fallback: "google/gemini-2.5-flash",         temperature: 0.1, maxTokens: 8000 },
  design_extract:    { primary: "deepseek/deepseek-chat-v3-0324",  fallback: "qwen/qwen3-235b-a22b",           temperature: 0.2, maxTokens: 4000 },
  section_generate:  { primary: "moonshotai/kimi-k2.6",            fallback: "moonshotai/kimi-k2.5",            temperature: 0.6, maxTokens: 24000 },
  section_classify:  { primary: "deepseek/deepseek-chat-v3-0324",  fallback: "qwen/qwen3-235b-a22b",           temperature: 0.1, maxTokens: 2000,  responseFormat: { type: "json_object" } },
  animation_brief:   { primary: "qwen/qwen3-vl-235b-a22b-instruct", fallback: "google/gemini-2.5-flash",       temperature: 0.3, maxTokens: 4000,  responseFormat: { type: "json_object" } },
};

function loadModelConfig(): Record<PipelineStage, ModelConfig> {
  const config = { ...DEFAULTS };
  for (const stage of Object.keys(config) as PipelineStage[]) {
    const modelKey = `CANVAS_MODEL_${stage.toUpperCase()}`;
    const modelOverride = process.env[modelKey];
    if (modelOverride) {
      config[stage] = { ...config[stage], primary: modelOverride };
    }
    // Phase 1.2 deferred: per-stage maxTokens override. Bump this when a
    // stage's default ceiling causes truncation retries in production.
    //   CANVAS_MAXTOKENS_SECTION_GENERATE=32000
    const tokensKey = `CANVAS_MAXTOKENS_${stage.toUpperCase()}`;
    const tokensOverride = process.env[tokensKey];
    if (tokensOverride) {
      const parsed = Number(tokensOverride);
      if (Number.isFinite(parsed) && parsed > 0) {
        config[stage] = { ...config[stage], maxTokens: parsed };
      }
    }
  }
  return config;
}

export const MODEL_CONFIG: Record<PipelineStage, ModelConfig> = loadModelConfig();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ROUTE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

export class ModelRouter {
  private apiKey: string;
  private appTitle: string;
  analytics: AnalyticsAdapter | null = null;

  constructor(opts: { apiKey?: string; appTitle?: string } = {}) {
    this.apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY ?? "";
    this.appTitle = opts.appTitle ?? "Atelier";
    if (!this.apiKey) throw new Error("OpenRouter API key required. Set OPENROUTER_API_KEY.");
  }

  async route(stage: PipelineStage, messages: ChatMessage[], opts: { stream?: boolean; useFallback?: boolean; retryCount?: number; signal?: AbortSignal; logger?: PipelineRun; timeoutMs?: number } = {}): Promise<Response> {
    const log = opts.logger || NOOP_RUN;
    const config = MODEL_CONFIG[stage];
    const model = opts.useFallback ? config.fallback : config.primary;
    const retryCount = opts.retryCount ?? 0;
    if (retryCount > 2) throw new RouterError(`Max retries exceeded for "${stage}"`, 500);

    const body: Record<string, unknown> = {
      model, messages, temperature: config.temperature, max_tokens: config.maxTokens, stream: opts.stream ?? false,
    };
    if (config.responseFormat) body.response_format = config.responseFormat;
    // Provider routing — skip unreliable providers
    if (model.includes("kimi")) {
      body.provider = { ignore: ["Inceptron", "Io Net"] };
      body.top_p = 0.95;
      // Disable thinking mode — direct code generation is faster and avoids empty responses
      body.reasoning = { effort: "none" };
    }

    // Timeout abort controller
    const effectiveTimeout = opts.timeoutMs ?? ROUTE_TIMEOUT_MS;
    const timeoutController = new AbortController();
    const externalSignal = opts.signal;
    if (externalSignal) {
      externalSignal.addEventListener("abort", () => timeoutController.abort(externalSignal.reason));
    }
    const timeout = setTimeout(() => {
      log.warn(`${stage} timed out after ${effectiveTimeout / 60000}min (model: ${model})`);
      timeoutController.abort(`Timeout: ${stage} exceeded ${effectiveTimeout / 60000} minutes`);
    }, effectiveTimeout);

    // Heartbeat log every 30s so we know it's alive
    const startTime = Date.now();
    const heartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      log.debug(`${stage}: waiting for ${model}... (${elapsed}s)`);
    }, HEARTBEAT_INTERVAL_MS);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}`, "X-Title": this.appTitle, "HTTP-Referer": "https://atelier.build" },
        body: JSON.stringify(body), signal: timeoutController.signal,
      });
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const provider = res.headers.get("x-served-by") || res.headers.get("x-provider") || "";
      log.debug(`${stage} response in ${elapsed}s${provider ? ` (${provider})` : ""}`);
      if (!res.ok && !opts.useFallback) {
        log.warn(`${model} -> ${res.status}, falling back to ${config.fallback}`);
        return this.route(stage, messages, { ...opts, useFallback: true, retryCount: retryCount + 1 });
      }
      if (!res.ok) throw new RouterError(`Both models failed for "${stage}": ${model} returned ${res.status}`, res.status);
      return res;
    } catch (err) {
      if (err instanceof RouterError) throw err;
      if (!opts.useFallback) {
        const reason = err instanceof Error ? err.message : String(err);
        log.warn(`${model} error: ${reason}, falling back to ${config.fallback}`);
        return this.route(stage, messages, { ...opts, useFallback: true, retryCount: retryCount + 1 });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
    }
  }

  async routeJSON<T = unknown>(stage: PipelineStage, messages: ChatMessage[], schema?: z.ZodType<T>, opts?: { useFallback?: boolean; logger?: PipelineRun; timeoutMs?: number }): Promise<T> {
    const log = opts?.logger || NOOP_RUN;
    const _routeStart = Date.now();
    const config = MODEL_CONFIG[stage];
    const useFallback = opts?.useFallback ?? false;
    const model = useFallback ? config.fallback : config.primary;
    log.debug(`${stage}: ${model}, ${config.maxTokens} maxTokens, ${Math.round(JSON.stringify(messages).length / 1000)}K prompt`);

    const BODY_READ_TIMEOUT_MS = 9 * 60 * 1000; // 9 minutes — Kimi at ~60 tps needs headroom for 16K-token responses
    let data: any;

    const attemptRead = async (response: Response): Promise<any> => {
      const bodyTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Response body read timed out after ${BODY_READ_TIMEOUT_MS / 1000}s`)), BODY_READ_TIMEOUT_MS)
      );
      log.debug(`reading response body for "${stage}"...`);
      return Promise.race([response.json(), bodyTimeout]);
    };

    const _logError = (_errorType?: string) => {
      if (!this.analytics) return;
      this.analytics.logGeneration({
        pipeline: stage, model,
        prompt: { systemLength: 0, userLength: JSON.stringify(messages).length },
        response: { htmlLength: 0, truncated: false },
        performance: { durationMs: Date.now() - _routeStart, retries: useFallback ? 1 : 0, fallbackUsed: useFallback },
        quality: { validHtml: false },
      }).catch(() => {});
    };

    const res = await this.route(stage, messages, { stream: false, useFallback, timeoutMs: opts?.timeoutMs });
    try {
      data = await attemptRead(res);
    } catch (firstErr) {
      // Retry once on the same model after a brief delay (connection drop, not model failure)
      if (!useFallback) {
        log.warn(`Body read failed for "${stage}" (${model}): ${firstErr instanceof Error ? firstErr.message : firstErr} — retrying in 3s`);
        await new Promise(r => setTimeout(r, 3000));
        try {
          const retryRes = await this.route(stage, messages, { stream: false, useFallback });
          data = await attemptRead(retryRes);
          log.debug(`Retry succeeded for "${stage}" (${model})`);
        } catch (retryErr) {
          _logError("body_read_timeout");
          log.error(`Retry also failed for "${stage}" (${model}), falling back to ${config.fallback}`);
          return this.routeJSON<T>(stage, messages, schema, { useFallback: true });
        }
      } else {
        _logError("body_read_failed");
        throw new RouterError(`Failed to read API response for "${stage}"`, 502);
      }
    }

    // Detect OpenRouter error responses (200 status but error in body)
    if (data.error) {
      _logError("api_error");
      const errMsg = typeof data.error === "string" ? data.error : (data.error.message || JSON.stringify(data.error));
      log.error(`API error for "${stage}" (${model}): ${errMsg}`);
      if (!useFallback) {
        log.warn(`Retrying "${stage}" with fallback ${config.fallback}`);
        return this.routeJSON<T>(stage, messages, schema, { useFallback: true });
      }
      throw new RouterError(`API error for "${stage}": ${errMsg}`, 502);
    }

    // Log response metadata
    const usage = data.usage;
    const finishReason = data.choices?.[0]?.finish_reason;
    const responseModel = data.model || "";
    log.debug(`finish: ${finishReason}${responseModel ? ` | ${responseModel}` : ""}${usage ? ` | tokens: ${usage.prompt_tokens}+${usage.completion_tokens}=${usage.total_tokens}` : ""}`);
    if (finishReason === "length") log.warn(`TRUNCATED — model hit maxTokens (${config.maxTokens}) for "${stage}"`);

    const text = data.choices?.[0]?.message?.content ?? "";
    log.debug(`raw response: ${text.length} chars`);

    // Empty response — Kimi sometimes uses all tokens on reasoning with no visible output
    // Retry same model once before falling back (may succeed on second attempt)
    if (!text.trim() && !useFallback) {
      const completionTokens = usage?.completion_tokens || 0;
      if (completionTokens > 0) {
        log.warn(`Empty content despite ${completionTokens} completion tokens from ${model} (reasoning) — retrying`);
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryRes2 = await this.route(stage, messages, { stream: false, useFallback: false });
          const retryData = await Promise.race([retryRes2.json(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 6 * 60 * 1000))]);
          const retryText = retryData.choices?.[0]?.message?.content ?? "";
          if (retryText.trim()) {
            log.info(`Retry produced ${retryText.length} chars from ${model}`);
            // Replace data/text and continue with the retry result
            data = retryData;
          } else {
            log.warn(`Retry also empty from ${model}, falling back to ${config.fallback}`);
            return this.routeJSON<T>(stage, messages, schema, { useFallback: true });
          }
        } catch {
          log.warn(`Retry failed for ${model}, falling back to ${config.fallback}`);
          return this.routeJSON<T>(stage, messages, schema, { useFallback: true });
        }
      } else {
        log.warn(`Empty response from ${model}, retrying with fallback ${config.fallback}`);
        return this.routeJSON<T>(stage, messages, schema, { useFallback: true });
      }
    }
    // Re-derive text from data (may have been replaced by retry above)
    const finalText = data.choices?.[0]?.message?.content ?? "";
    if (!finalText.trim() && useFallback) {
      log.error(`Both models returned empty responses for "${stage}"`);
      throw new RouterError(`Both models returned empty responses for "${stage}"`, 502);
    }

    let clean = finalText.replace(/```json\n?|```\s*$/g, "").replace(/```html\n?|```\s*$/g, "").trim();

    // Strip leading prose/reasoning before HTML (e.g. "The user wants...\n\n<section>...")
    // Detect the first HTML tag — full document or section-level
    const firstTagMatch = clean.match(/<(?:!DOCTYPE|html|section|nav|header|footer|div|article|main)\b/i);
    if (firstTagMatch && firstTagMatch.index && firstTagMatch.index > 0 && !clean.startsWith("{")) {
      log.debug(`stripped ${firstTagMatch.index} chars of leading prose before HTML`);
      clean = clean.slice(firstTagMatch.index).trim();
    }
    // Strip trailing prose after </html> or last closing section tag
    const closingHtmlIdx = clean.lastIndexOf("</html>");
    if (closingHtmlIdx > 0 && closingHtmlIdx + 7 < clean.length) {
      log.debug(`stripped ${clean.length - closingHtmlIdx - 7} chars of trailing prose after </html>`);
      clean = clean.slice(0, closingHtmlIdx + 7);
    }

    let parsed: unknown;

    // If the response looks like raw HTML, wrap it
    if (clean.startsWith("<") && !clean.startsWith("{") && /^<(?:!DOCTYPE|html|div|section|nav|header|footer|main|article|aside)\b/i.test(clean)) {
      log.debug(`detected raw HTML (${clean.length} chars)`);
      parsed = { html: clean };
    } else {
      try {
        parsed = JSON.parse(clean);
        const htmlLen = (parsed as any)?.html?.length;
        log.debug(`parsed JSON OK${htmlLen ? `, html: ${htmlLen} chars` : ""}`);
      } catch {
        log.warn(`JSON parse failed, attempting HTML recovery...`);
        // Try to extract HTML from truncated JSON
        const htmlMatch = clean.match(/"html"\s*:\s*"([\s\S]+)/);
        if (htmlMatch) {
          let html = htmlMatch[1];
          const lastCloseTag = html.lastIndexOf(">");
          if (lastCloseTag > 0) html = html.slice(0, lastCloseTag + 1);
          html = html.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(/\\t/g, "\t");
          log.warn(`Recovered truncated HTML from "${stage}" (${html.length} chars)`);
          parsed = { html };
        } else {
          log.error(`Cannot parse response: ${clean.slice(0, 200)}`);
          throw new RouterError(`Failed to parse response from "${stage}": ${clean.slice(0, 200)}`);
        }
      }
    }

    // Validate HTML quality
    const html = (parsed as any)?.html;
    if (html) {
      const sectionCount = (html.match(/<section/gi) || []).length;
      const divCount = (html.match(/<div/gi) || []).length;
      const hasTailwind = html.includes("tailwindcss");
      const hasDoctype = html.includes("<!DOCTYPE");
      log.debug(`HTML: ${html.length} chars, ${sectionCount} sections, ${divCount} divs, tailwind: ${hasTailwind}`);
      if (html.length < 500) log.warn(`HTML suspiciously short (${html.length} chars)`);
      if (finishReason === "length" && html.length > 100) {
        log.warn(`TRUNCATED — patching unclosed tags`);
        // Close unclosed tags by tracking the open/close stack
        const openTags: string[] = [];
        const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
        const selfClosing = new Set(["img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "embed", "track", "wbr"]);
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
          const fullTag = match[0];
          const tagName = match[1].toLowerCase();
          if (selfClosing.has(tagName) || fullTag.endsWith("/>")) continue;
          if (fullTag.startsWith("</")) {
            // Closing tag — pop from stack
            const idx = openTags.lastIndexOf(tagName);
            if (idx >= 0) openTags.splice(idx, 1);
          } else {
            openTags.push(tagName);
          }
        }
        if (openTags.length > 0) {
          const closingTags = openTags.reverse().map(t => `</${t}>`).join("\n");
          log.warn(`Patched ${openTags.length} unclosed tags: ${openTags.join(", ")}`);
          (parsed as any).html = html + "\n" + closingTags;
        }
      }
    }

    // ─── Analytics: log generation ───
    if (this.analytics) {
      const endTime = Date.now();
      const promptLength = JSON.stringify(messages).length;
      const sysMsg = messages.find(m => m.role === "system");
      const userMsg = messages.find(m => m.role === "user");
      this.analytics.logGeneration({
        pipeline: stage,
        model,
        prompt: {
          systemLength: typeof sysMsg?.content === "string" ? sysMsg.content.length : 0,
          userLength: typeof userMsg?.content === "string" ? userMsg.content.length : promptLength,
        },
        response: {
          htmlLength: html?.length ?? 0,
          sectionsCount: html ? (html.match(/<section/gi) || []).length : undefined,
          hasAnimations: html ? /gsap|scrolltrigger|animate/i.test(html) : undefined,
          truncated: finishReason === "length",
        },
        performance: {
          durationMs: endTime - _routeStart,
          tokensIn: usage?.prompt_tokens,
          tokensOut: usage?.completion_tokens,
          retries: useFallback ? 1 : 0,
          fallbackUsed: useFallback,
        },
        quality: {
          validHtml: html ? html.includes("<") && html.includes(">") : undefined,
        },
      }).catch(err => log.debug(`analytics log failed: ${err instanceof Error ? err.message : err}`));
    }

    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) throw new RouterError(`Schema validation failed for "${stage}": ${result.error.issues.map(i => i.message).join(", ")}`);
      return result.data;
    }
    return parsed as T;
  }

  async *routeStream(stage: PipelineStage, messages: ChatMessage[]): AsyncGenerator<string> {
    const res = await this.route(stage, messages, { stream: true });
    if (!res.body) throw new RouterError("No response body for stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;
        try { const c = JSON.parse(payload); const t = c.choices?.[0]?.delta?.content; if (t) yield t; } catch {}
      }
    }
  }
}

export class RouterError extends Error {
  code: number;
  constructor(message: string, code: number = 500) { super(message); this.name = "RouterError"; this.code = code; }
}

let _router: ModelRouter | null = null;
export function getRouter(opts?: { apiKey?: string }): ModelRouter {
  if (!_router) _router = new ModelRouter(opts);
  return _router;
}
