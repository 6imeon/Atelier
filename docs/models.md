# AI Models — Pipeline Review & Recommendations

All models are routed through **OpenRouter** (`packages/sdk/src/utils/router.ts`).
Override any stage via env var: `CANVAS_MODEL_<STAGE>=<model_id>`.

---

## Current Pipeline

| Stage | Current Model | Fallback | Purpose |
|---|---|---|---|
| intent_parse | `deepseek/deepseek-chat-v3-0324` | `qwen/qwen3-235b-a22b` | Parse user prompt → intent, device type, requirements (JSON) |
| vision_interpret | `qwen/qwen-2.5-vl-72b-instruct` | `google/gemini-2.5-flash` | Analyse uploaded screenshots/images |
| layout_generate | `anthropic/claude-sonnet-4` | `deepseek/deepseek-chat-v3-0324` | Generate full HTML page — the main creative step |
| design_refine | `moonshotai/kimi-k2.5` | `deepseek/deepseek-chat-v3-0324` | Customise components to match design system |
| code_render | `deepseek/deepseek-chat-v3-0324` | `google/gemini-2.5-flash` | Clean up and render final HTML/CSS |
| design_extract | `deepseek/deepseek-chat-v3-0324` | `qwen/qwen3-235b-a22b` | Extract colours, fonts, tokens from crawled sites |

**Component generation script** uses `moonshotai/kimi-k2.5`.

---

## Model Catalogue (OpenRouter)

### Pricing & Specs

| Model | ID | Input $/M | Output $/M | Context | Max Output | Open Source |
|---|---|---|---|---|---|---|
| DeepSeek V3 | `deepseek/deepseek-chat-v3-0324` | $0.20 | $0.77 | 164K | — | Yes (MIT) |
| DeepSeek R1 | `deepseek/deepseek-r1` | $0.70 | $2.50 | 64K | 16K | Yes (MIT) |
| Kimi K2.5 | `moonshotai/kimi-k2.5` | $0.42 | $2.20 | 262K | 65K | Yes |
| Qwen 3 235B | `qwen/qwen3-235b-a22b` | $0.46 | $1.82 | 131K | 8K | Yes |
| Qwen 2.5 VL 72B | `qwen/qwen-2.5-vl-72b-instruct` | $0.80 | $0.80 | 32K | — | Yes |
| Qwen 2.5 Coder 32B | `qwen/qwen-2.5-coder-32b-instruct` | $0.66 | $1.00 | 32K | — | Yes (Apache 2.0) |
| Qwen3 Coder 480B | `qwen/qwen3-coder-480b-a35b` | ~$0.50 | ~$1.80 | 256K | — | Yes |
| Claude Sonnet 4 | `anthropic/claude-sonnet-4` | $3.00 | $15.00 | 200K | 64K | No |
| Claude 3.5 Haiku | `anthropic/claude-3.5-haiku` | $0.80 | $4.00 | 200K | 8K | No |
| Gemini 2.5 Flash | `google/gemini-2.5-flash` | $0.30 | $2.50 | 1M | 65K | No |
| Gemini 2.5 Pro | `google/gemini-2.5-pro` | $1.25 | $10.00 | 1M | 65K | No |
| GPT-4o | `openai/gpt-4o` | $2.50 | $10.00 | 128K | 16K | No |
| GPT-4.1 Mini | `openai/gpt-4.1-mini` | $0.40 | $1.60 | 1M | — | No |
| Llama 4 Maverick | `meta-llama/llama-4-maverick` | $0.15 | $0.60 | 1M | — | Yes |
| Llama 4 Scout | `meta-llama/llama-4-scout` | $0.08 | $0.30 | 328K | — | Yes |
| Mistral Large | `mistralai/mistral-large` | $2.00 | $6.00 | 128K | — | Yes |
| Codestral 2501 | `mistralai/codestral-2501` | $0.30 | $0.90 | 256K | — | Yes |

---

## Stage-by-Stage Analysis & Recommendations

### 1. Intent Parse
**What it does:** Takes the raw user prompt and returns structured JSON — intent type, device, requirements.
**Needs:** Fast, cheap, reliable JSON output. Low creativity. Small input/output.
**Current:** DeepSeek V3 — good fit, very cheap, supports JSON mode.

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| DeepSeek V3 | $0.20/$0.77 | Solid JSON, fast | **Keep — best value** |
| Llama 4 Scout | $0.08/$0.30 | Decent but less reliable JSON | Cheaper but riskier |
| GPT-4.1 Mini | $0.40/$1.60 | Excellent JSON mode | Overkill for this task |

**Recommendation:** Keep `deepseek/deepseek-chat-v3-0324`. It's the cheapest reliable option for structured JSON parsing. No change needed.

---

### 2. Vision Interpret
**What it does:** Analyses uploaded screenshots — identifies layout, components, colours, content.
**Needs:** Strong multimodal/vision capabilities, good at describing UI structure.
**Current:** Qwen 2.5 VL 72B — purpose-built vision-language model.

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| Qwen 2.5 VL 72B | $0.80/$0.80 | Best open-source VL model, excels at UI/layout recognition | **Good** |
| Kimi K2.5 | $0.42/$2.20 | Native multimodal, trained on 15T vision+text tokens, excellent at UI | **Better quality, similar cost** |
| Gemini 2.5 Flash | $0.30/$2.50 | Good vision, 1M context | Good fallback |
| Llama 4 Maverick | $0.15/$0.60 | Native multimodal, early fusion | Cheap but unproven for UI analysis |

**Recommendation: Switch to `moonshotai/kimi-k2.5`**. Kimi K2.5 was specifically trained on mixed vision+text data (1.04T params) and is the strongest open-source model for screenshot-to-code workflows. It understands component hierarchies natively. Keep Qwen VL as fallback.

---

### 3. Layout Generate
**What it does:** The main creative step — generates full-page HTML/CSS from the plan. Largest output (~10-16K tokens).
**Needs:** Top-tier HTML/CSS quality, creative design, accurate instruction following, large output window.
**Current:** Claude Sonnet 4 — best instruction following, excellent HTML.

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| Claude Sonnet 4 | $3.00/$15.00 | Top-tier HTML, best instruction following (SWE-bench 72.7%) | **Best quality, expensive** |
| Kimi K2.5 | $0.42/$2.20 | Excellent frontend code (HumanEval 99%, SWE-bench 76.8%), 65K output | **Best open-source, 7x cheaper** |
| Gemini 2.5 Pro | $1.25/$10.00 | #1 LMArena, strong code, 65K output | Good but still expensive |
| DeepSeek V3 | $0.20/$0.77 | Good HTML but less creative/polished | Cheap fallback |

**Recommendation: Switch to `moonshotai/kimi-k2.5`**.
Kimi K2.5 actually scores *higher* than Claude Sonnet 4 on SWE-bench (76.8% vs 72.7%) and HumanEval (99.0%). It has a 65K output window (vs Claude's 64K). It's specifically known for generating production-ready HTML/React from visual inputs. At **~7x cheaper per output token**, this is the highest-impact change. Keep Claude Sonnet 4 as fallback for when quality really matters.

---

### 4. Design Refine
**What it does:** Customises components to match a target design system — adjusts CSS, colours, typography, spacing.
**Needs:** Strong CSS/design sensibility, accurate colour/font application, creative styling.
**Current:** Kimi K2.5 (recently switched from DeepSeek V3).

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| Kimi K2.5 | $0.42/$2.20 | Best open-source for frontend/design tasks | **Keep — ideal for this stage** |
| DeepSeek V3 | $0.20/$0.77 | Decent but less design-aware | Good fallback |
| Qwen 2.5 Coder 32B | $0.66/$1.00 | Code-focused but less creative | Not ideal for design |

**Recommendation:** Keep `moonshotai/kimi-k2.5`. This is its strongest use case.

---

### 5. Code Render
**What it does:** Final cleanup pass — ensures valid HTML, clean CSS, removes artifacts, optimises.
**Needs:** Precise, deterministic code transformation. Low creativity. Fast.
**Current:** DeepSeek V3.

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| DeepSeek V3 | $0.20/$0.77 | Good code cleanup, very cheap | **Keep** |
| Codestral 2501 | $0.30/$0.90 | Specialized code model, 256K context | Slightly better at code, similar cost |
| Qwen 2.5 Coder 32B | $0.66/$1.00 | Code-specialized | More expensive, marginal benefit |

**Recommendation:** Keep `deepseek/deepseek-chat-v3-0324`. This is a low-creativity cleanup step — DeepSeek V3 at $0.20/M input is the right tool. Alternatively, `mistralai/codestral-2501` could be slightly better for pure code tasks at similar cost.

---

### 6. Design Extract
**What it does:** Parses crawled HTML/CSS to extract colours, fonts, spacing as structured JSON tokens.
**Needs:** Reliable JSON output, good at parsing CSS, analytical (not creative).
**Current:** DeepSeek V3.

| Option | Cost (in+out) | Quality | Verdict |
|---|---|---|---|
| DeepSeek V3 | $0.20/$0.77 | Reliable JSON, good CSS parsing | **Keep — best value** |
| Qwen 3 235B | $0.46/$1.82 | Good fallback | Already used as fallback |

**Recommendation:** Keep `deepseek/deepseek-chat-v3-0324`. This is an extraction/parsing task — design creativity isn't needed.

---

## Recommended Changes Summary

| Stage | Current | Recommended | Reason | Cost Impact |
|---|---|---|---|---|
| intent_parse | DeepSeek V3 | **No change** | Already optimal | — |
| vision_interpret | Qwen 2.5 VL 72B | **Kimi K2.5** | Better UI understanding, native multimodal, open-source | Similar |
| layout_generate | Claude Sonnet 4 | **Kimi K2.5** | Higher SWE-bench, excellent HTML, 7x cheaper, open-source | **~85% savings** |
| design_refine | Kimi K2.5 | **No change** | Already optimal | — |
| code_render | DeepSeek V3 | **No change** | Already optimal | — |
| design_extract | DeepSeek V3 | **No change** | Already optimal | — |

### Proposed Config
```
intent_parse:     deepseek/deepseek-chat-v3-0324    fallback: qwen/qwen3-235b-a22b
vision_interpret: moonshotai/kimi-k2.5               fallback: qwen/qwen-2.5-vl-72b-instruct
layout_generate:  moonshotai/kimi-k2.5               fallback: anthropic/claude-sonnet-4
design_refine:    moonshotai/kimi-k2.5               fallback: deepseek/deepseek-chat-v3-0324
code_render:      deepseek/deepseek-chat-v3-0324     fallback: google/gemini-2.5-flash
design_extract:   deepseek/deepseek-chat-v3-0324     fallback: qwen/qwen3-235b-a22b
```

### Estimated Cost Per Generation (5-page redesign)

| Pipeline | Current Cost | Proposed Cost |
|---|---|---|
| Intent parse (1 call, ~1K out) | ~$0.001 | ~$0.001 |
| Vision interpret (1 call, ~2K out) | ~$0.003 | ~$0.005 |
| Layout generate (5 calls, ~12K out each) | ~$0.90 | ~$0.13 |
| Design refine (5 calls, ~8K out each) | ~$0.09 | ~$0.09 |
| Code render (5 calls, ~6K out each) | ~$0.02 | ~$0.02 |
| Design extract (1 call, ~2K out) | ~$0.002 | ~$0.002 |
| **Total per redesign** | **~$1.02** | **~$0.25** |

**~75% cost reduction** with equal or better quality by switching layout_generate and vision_interpret to Kimi K2.5.

---

## Models to Watch

| Model | Why |
|---|---|
| `qwen/qwen3-coder-480b-a35b` | Alibaba's latest agentic code model. 480B MoE, 256K context. Purpose-built for repo-scale code. Could replace code_render. |
| `minimax/minimax-m2.5` | 80.2% SWE-bench verified at budget pricing. Worth testing for layout_generate. |
| Devstral 2 | 123B agentic coding model with multi-file orchestration. Free on OpenRouter. |
| Llama 4 Maverick | Native multimodal, 1M context, $0.15/$0.60. If quality improves, could be cheapest option for multiple stages. |

---

## Kimi K2.5 Prompting Research

Sources: [Moonshot AI docs](https://platform.moonshot.ai/docs/guide/prompt-best-practice), [Kimi K2.5 Quickstart](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart), [Prompting Guide](https://www.promptingguide.ai/models/kimi-k2.5)

### Key Findings

1. **Temperature & Top-P**: Add `top_p: 0.95` to all Kimi calls. Thinking mode should use `temperature: 1.0`.

2. **Disable Thinking Mode**: Add `reasoning: { effort: "none" }` for code generation. OpenRouter docs: *"turn off reasoning mode for the best and fastest performance"*. Eliminates the "6000 reasoning tokens, 0 content tokens" problem.

3. **Simplify System Prompts**: Moonshot says *"no need to specify tools in System Prompt — may interfere with autonomous decision-making"*. Kimi K2.5 is purpose-built for frontend generation. Less rules = less overhead = more HTML output.

4. **Use XML Delimiters**: Structure prompts with `<design-brief>`, `<brand-tokens>`, `<source-content>`, `<original-html>` tags.

5. **Trust the Model**: Kimi K2.5 generates *"fully functional, visually appealing interactive UIs directly from natural language, with precise control over complex effects"*. Give creative briefs, not micro-managed CSS rules.

### Expected Impact
- No more empty responses (thinking mode disabled)
- Faster generation, lower cost (~50% token savings from no hidden reasoning)
- Better output quality (all tokens go to HTML/JS)

---

## Open-Source Priority

The project prioritises open-source/open-weight models where quality is on par or better:

| Model | Open Source | Currently Used |
|---|---|---|
| Kimi K2.5 | Yes | design_refine, component generation |
| DeepSeek V3 | Yes (MIT) | intent_parse, code_render, design_extract |
| Qwen 3 235B | Yes | Fallback for 3 stages |
| Qwen 2.5 VL 72B | Yes | vision_interpret |
| Gemini 2.5 Flash | **No** | Fallback for 2 stages |
| Claude Sonnet 4 | **No** | layout_generate |

With the proposed changes, **only 2 fallback slots use proprietary models** (Claude Sonnet 4 as layout fallback, Gemini Flash as code_render/vision fallback). All primary models would be open-source.
