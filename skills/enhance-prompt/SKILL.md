# enhance-prompt

> Refine a rough UI description into a detailed, model-ready generation prompt.

## Description

Takes a brief or vague user prompt (e.g. "a settings page") and expands it into a structured, detailed prompt that produces higher-quality UI generations. The enhanced prompt includes layout intent, component breakdown, styling guidance, and responsive behavior hints.

## Usage

```
enhance-prompt "a settings page"
enhance-prompt "dashboard with charts" --device MOBILE --style minimal
```

## Inputs

| Name     | Type   | Required | Description                                     |
|----------|--------|----------|-------------------------------------------------|
| prompt   | string | yes      | The raw user prompt to enhance                  |
| device   | enum   | no       | Target device: MOBILE, DESKTOP, TABLET, AGNOSTIC (default: DESKTOP) |
| style    | string | no       | Optional style hint (e.g. "minimal", "brutalist", "corporate") |

## Output

```json
{
  "original": "a settings page",
  "enhanced": "A desktop settings page with a left sidebar navigation...",
  "components": ["sidebar", "form-section", "toggle-switch", "avatar-upload"],
  "layoutHint": "sidebar-detail",
  "confidence": 0.92
}
```

## Pipeline

1. Parse the raw prompt for intent, app type, and implied components
2. Expand with layout patterns, component specifics, and Tailwind styling cues
3. Add device-specific responsive considerations
4. Return structured prompt with extracted metadata

## Scripts

- `scripts/enhance.ts` — Core prompt enhancement logic using the `intent_parse` pipeline stage

## Resources

- `resources/layout-patterns.json` — Common layout archetypes (sidebar-detail, dashboard-grid, feed, etc.)
- `resources/component-hints.json` — Component expansion mappings

## Examples

See `examples/` for sample input/output pairs.
