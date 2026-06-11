# Adding New Personas & Industries

Checklist for adding new personas or industries to Atelier. Follow every step — skipping one will cause silent mismatches or test failures.

---

## Adding a New Persona

### 1. Create the persona file

Create `scripts/personas/{persona-id}.md` following the exact format of existing personas (e.g. `noir-detective.md`):

```
# Persona: Display Name

**Name:** Designer Name
**Background:** ...

## Design Philosophy
## Visual Language (Layout, Typography, Color palette, Accent colors, Images, Borders & surfaces)
## What This Persona NEVER Does
## CSS Patterns
## Reference Brands
## Best For
```

The file is loaded dynamically — no code change needed for loading.

### 2. Add Aaker vector

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `PERSONA_AAKER_VECTORS` constant

Add a 5-dimension vector `[Sincerity, Excitement, Competence, Sophistication, Ruggedness]`, each value 0-1:

```ts
"my-persona": [0.5, 0.3, 0.7, 0.6, 0.2],
```

### 3. Add to industry persona maps

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `INDUSTRY_PERSONA_MAP`

Add the persona to any industries it's a strong fit for (each industry lists 3-4 personas ranked by strength):

```ts
healthcare: ["healthcare-modern", "corporate-precision", "warm-nude", "my-persona"],
```

**File:** `scripts/generate-industry-components.ts`
**Location:** `INDUSTRY_PERSONA_MAP`

Mirror the same mapping here. This file has its own copy used by the component generator.

### 4. Add to font affinity map (if applicable)

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `FONT_PERSONA_AFFINITY`

If the persona has a strong font identity, add it to the relevant font category:

```ts
"geometric-sans": ["swiss-international", "bauhaus-functional", ..., "my-persona"],
```

### 5. Update test count

**File:** `packages/sdk/src/__tests__/personas.test.ts`
**Location:** `"has vectors for all XX personas"` test

Update the expected count:

```ts
expect(Object.keys(PERSONA_AAKER_VECTORS).length).toBe(53); // was 52
```

### 6. Update documentation counts

**File:** `README.md`
Search for the old persona count (e.g. "42 design personas" or "52 personas") and update.

### 7. Run tests

```bash
cd packages/sdk && npx vitest run
```

### 8. Rebuild Docker

```bash
docker compose up -d --build
```

---

## Adding a New Industry

### 1. Add industry keywords

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `INDUSTRY_KEYWORDS`

Add single-word and multi-word keywords:

```ts
alcohol: ["alcohol", "wine", "winery", "brewery", "spirits", "whiskey",
           "craft beer", "single malt", "barrel aged"],
```

### 2. Add industry persona mapping

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `INDUSTRY_PERSONA_MAP`

Map to 3-4 best-fit personas (first = strongest):

```ts
alcohol: ["editorial-luxury", "art-deco-revival", "rustic-artisan", "noir-detective"],
```

### 3. Add Aaker vector for the industry

**File:** `packages/sdk/src/utils/personas.ts`
**Location:** `INDUSTRY_AAKER`

Add a 5-dimension Aaker profile for the industry:

```ts
alcohol: [0.3, 0.4, 0.4, 0.8, 0.4], // Sincerity, Excitement, Competence, Sophistication, Ruggedness
```

### 4. Add component specs

**File:** `scripts/generate-industry-components.ts`
**Location:** `COMPONENT_SPECS` array

Add 8-12 component specs covering these categories:
- `hero` (1-2 variants)
- `cards`
- `features` (1-2 variants)
- `stats`
- `carousel`
- `cta` (1-2 variants)
- `navbar`
- `footer`
- `gallery` (optional)

Each spec needs: `category`, `industry`, `name`, `description`, `style`.

### 5. Add industry persona mapping in component generator

**File:** `scripts/generate-industry-components.ts`
**Location:** `INDUSTRY_PERSONA_MAP`

This file has its own persona map used during component generation:

```ts
alcohol: ["editorial-luxury", "art-deco-revival", "noir-detective", "rustic-artisan"],
```

### 6. Generate components

```bash
npx tsx scripts/generate-industry-components.ts --industry my-industry
```

### 7. Run tests

```bash
cd packages/sdk && npx vitest run
```

### 8. Rebuild Docker

```bash
docker compose up -d --build
```

---

## Quick Reference: All Touchpoints

| What | File | Constant/Location |
|------|------|-------------------|
| Persona markdown files | `scripts/personas/*.md` | One file per persona |
| Aaker vectors (personas) | `packages/sdk/src/utils/personas.ts` | `PERSONA_AAKER_VECTORS` |
| Aaker vectors (industries) | `packages/sdk/src/utils/personas.ts` | `INDUSTRY_AAKER` |
| Industry keywords | `packages/sdk/src/utils/personas.ts` | `INDUSTRY_KEYWORDS` |
| Industry → persona map | `packages/sdk/src/utils/personas.ts` | `INDUSTRY_PERSONA_MAP` |
| Font → persona affinity | `packages/sdk/src/utils/personas.ts` | `FONT_PERSONA_AFFINITY` |
| Component specs | `scripts/generate-industry-components.ts` | `COMPONENT_SPECS` array |
| Component industry → persona | `scripts/generate-industry-components.ts` | `INDUSTRY_PERSONA_MAP` |
| Test persona count | `packages/sdk/src/__tests__/personas.test.ts` | `"has vectors for all XX personas"` |
| Documentation counts | `README.md` | Search for persona/industry counts |

---

## Verification Checklist

After any changes, verify:

- [ ] `npx vitest run` — all persona tests pass
- [ ] `npx tsx scripts/generate-industry-components.ts --list-industries` — new industry appears with correct persona
- [ ] `docker compose up -d --build` — container starts and loads all personas (check logs for loaded count)
- [ ] Test a generation with a URL from the new industry to confirm persona matching works
