# design-md

> Extract and generate a DESIGN.md design system specification from any source.

## Description

Generates a structured DESIGN.md file from a URL, existing screen, or manual input. The DESIGN.md format captures colors, typography, spacing, border radii, shadows, and reusable component patterns in a model-consumable markdown format that guides future screen generations for visual consistency.

## Usage

```
design-md extract --url https://example.com
design-md from-screen <screenId>
design-md merge <designA.md> <designB.md>
```

## Inputs

| Name     | Type   | Required | Description                                        |
|----------|--------|----------|----------------------------------------------------|
| action   | enum   | yes      | Action: extract, from-screen, merge, validate      |
| url      | string | no       | URL to extract design tokens from (for `extract`)  |
| screenId | string | no       | Screen ID to derive tokens from (for `from-screen`)|
| files    | string[]| no     | Paths to DESIGN.md files to merge (for `merge`)    |

## Output

A `DESIGN.md` file following the Atelier design system schema:

```markdown
# DESIGN.md

## Colors
- Primary: `#E8FF59`
- Secondary: `#59FFD2`
...

## Typography
- Heading: `Inter`
- Body: `Inter`
...

## Component Patterns
### Button
Primary action button
\`bg-yellow-300 text-black px-6 py-2 rounded-lg font-semibold\`
```

## Pipeline

1. **extract**: Fetch page HTML via the `design_extract` pipeline stage, parse into DesignSystem tokens, serialize via `toDesignMd()`
2. **from-screen**: Analyze an existing screen's HTML and designTokens to derive a consistent system
3. **merge**: Combine multiple DESIGN.md files, resolving conflicts by frequency and recency
4. **validate**: Check a DESIGN.md against the DesignSystem schema for completeness

## Scripts

- `scripts/extract.ts` — URL-based design extraction
- `scripts/from-screen.ts` — Screen-based token derivation
- `scripts/merge.ts` — Multi-file design system merging

## Resources

- `resources/design-system-schema.json` — JSON Schema for the DesignSystem interface
- `resources/default-tokens.json` — Fallback tokens for incomplete extractions

## Examples

See `examples/` for sample DESIGN.md outputs from various websites.
