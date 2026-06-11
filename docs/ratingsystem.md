# Atelier — Rating System & Quality Feedback Loop

## 1. Overview

This document covers how Atelier currently rates and reuses generated assets, proposes a human-in-the-loop rating system, and draws on industry practices and academic research to design the best approach.

**Goal:** Build a closed-loop quality system where:
1. Every generated page, section, and component receives an automated quality score
2. Users can rate outputs at both page-level and section-level
3. Ratings accumulate into a mean quality score per asset type
4. Higher-rated assets are preferentially reused in future generations
5. The system improves over time without manual curation

---

## 2. Current State — What Exists Today

### 2.1 Automated Scoring: UICrit

**File:** `packages/sdk/src/utils/design-critique.ts`

UICrit runs a rule-based critique pass on every generated page, producing a 0-10 score:

```
Score = 10 - (critical_issues * 3) - (warning_issues * 1) - (info_issues * 0.3)
```

**Dimensions checked:**
| Category | Rules |
|----------|-------|
| CRO | CTA placement, hero section presence, social proof |
| Visual Hierarchy | H1 tags, heading structure |
| Accessibility | Image alt text, contrast |
| Layout | Max-width constraints, empty sections |
| Animation Safety | `toggleActions: 'reverse'` prevention |

**Limitation:** UICrit is purely rule-based. It catches structural issues but cannot evaluate aesthetics, brand fidelity, or content quality.

### 2.2 Section Templates (RALF)

**Files:** `packages/sdk/src/storage/interface.ts`, `packages/sdk/src/utils/section-parser.ts`

Generated sections are saved as templates for few-shot prompting in future generations:

```typescript
interface SectionTemplate {
  type: string;           // "hero", "features", "testimonials", etc.
  industry?: string;      // "saas", "fintech", etc.
  html: string;           // Full section HTML (capped at 8K chars)
  qualityScore: number;   // 1-10, starts at 3, adjusted by feedback
  timesReused: number;    // Popularity counter
  features: { hasAnimation, hasCta, hasImage, columnCount, tailwindClasses };
}
```

**Selection:** Templates are retrieved sorted by `qualityScore DESC, timesReused DESC` — quality first, then popularity.

**Deduplication:** If a template with the same `type + htmlLength` already exists, `timesReused` is incremented instead of inserting a duplicate.

### 2.3 Layout Examples (RALF)

**File:** `packages/sdk/src/models/section-generator.ts` (lines 902-926)

After each page generation, the section sequence is saved:

```typescript
interface LayoutExample {
  industry: string;        // "fintech", "saas", "ecommerce"
  pageType: string;        // "homepage", "pricing", "about"
  sectionSequence: string[]; // ["nav", "hero", "features", "testimonials", "footer"]
  sectionCount: number;
  qualityScore: number;    // Default 3, adjustable
}
```

Layout examples are used as context in redesign prompts: *"Here are section sequences from successful redesigns..."*

### 2.4 Component Usage Tracking

**File:** `packages/sdk/src/models/component.ts`

Components have `quality` (1-5) and `usageCount` fields. Selection prioritizes:
1. `source === "hand-crafted:premium"` (score +10)
2. Higher `quality` rating
3. Animation/interactivity tags
4. `adaptability === "fluid"` > `"flexible"` > `"rigid"`

`recordUsage(componentId)` increments the counter each time a component is selected for a prompt.

### 2.5 User Feedback (Partially Implemented)

**File:** `packages/api-server/src/routes/analytics.ts`

A `POST /api/feedback` endpoint exists that accepts:

```typescript
interface UserFeedback {
  action: "kept" | "deleted" | "edited" | "exported" | "variant_created";
  explicitRating?: number | null;
  editDelta?: { sectionsModified?: number; htmlDiffSize?: number };
  timeToAction?: number;
}
```

**Score adjustment** (MongoDB `adjustTemplateScores`):

| Action | Score Delta |
|--------|------------|
| `exported` | +1.0 |
| `kept` | +0.5 |
| `variant_created` | +0.3 |
| `edited` | +0.2 |
| `deleted` | -0.5 |

**Gap:** The frontend does not currently surface any rating UI. `explicitRating` is always null. The feedback endpoint is called for implicit actions only.

### 2.6 Generation Logs

**File:** `packages/sdk/src/utils/router.ts` (lines 328-351)

Every AI call logs:
- Pipeline stage, model, prompt size
- Response size, truncation status
- Duration, token usage, retries
- `quality.userRating` (always null — never set)

Stored in MongoDB `generation_logs` with 90-day TTL.

---

## 3. Industry Research — How Others Do It

### 3.1 Implicit Feedback (Industry Standard)

Every major platform relies primarily on **implicit signals** over explicit ratings:

| Platform | Implicit Signals | Explicit Rating |
|----------|-----------------|-----------------|
| **GitHub Copilot** | Accept/reject, partial acceptance, 30s persistence check, edit distance | Thumbs up/down on Chat |
| **Vercel v0** | Accept/regenerate/edit, fork count on shared components | Thumbs up/down (binary) |
| **Midjourney** | Upscale/regenerate choices | ELO pairwise comparison system |
| **Figma AI** | Keep/undo/delete, modification extent | None |
| **Adobe Firefly** | Download/regenerate | Thumbs up/down |
| **Builder.io** | Code acceptance, edit distance, visual diff vs Figma source | None |
| **Framer AI** | Publish/regenerate/delete, remix count | None |

**Key insight from Copilot:** They track whether accepted code **persists** after 30 seconds, 2 minutes, and 5 minutes. Code that gets immediately deleted after acceptance is treated as low-quality. This "persistence metric" is more reliable than the initial accept/reject signal.

### 3.2 Midjourney's ELO System (Best in Class)

Midjourney runs the most sophisticated public rating system for generative AI:

- Users visit `midjourney.com/rank` and are shown **two images** side by side
- They pick which is better (pairwise comparison)
- Each image accumulates an **ELO score** (same algorithm as chess rankings)
- Users earn free GPU time for participating (incentive mechanism)
- High-ELO images feed into **DPO (Direct Preference Optimization)** training
- Low-ELO images are used as dispreferred examples

**Why ELO works:** It produces a reliable quality ranking from noisy, sparse human judgments. A single image only needs ~10-20 comparisons to get a stable rating.

**Why Midjourney keeps it single-dimensional:** They found that asking users to rate on multiple dimensions (composition, color, realism) produced noisy, unreliable data. A simple "which is better" comparison yields much cleaner signal.

### 3.3 Component-Level ELO Rating — An Unoccupied Niche

**No major platform implements component/section-level ratings.** All existing systems rate at the whole-output level (full image, full page, full code suggestion). This is a significant opportunity for Atelier.

The closest analog is Copilot's **partial acceptance tracking** — where a user accepts a multi-line suggestion but then deletes some lines, implicitly rating sub-parts of the output.

**Why Atelier is uniquely positioned for section-level ELO:**

Atelier already generates pages **section-by-section** (Path C in designflows.md). Each section is independently generated, has its own type/role metadata, and is stored as a reusable template. This means we have the natural unit of comparison — two hero sections, two footer sections — that other platforms lack.

Midjourney compares whole images. Copilot compares whole suggestions. **Atelier can compare sections of the same type**, which is far more actionable — a "better hero" can be reused in future hero generation, while a "better whole page" is too entangled to decompose.

### 3.4 Where Section ELO Fits — Dedicated `/rank` Page (Midjourney Model)

ELO comparisons live on a **dedicated `/rank` page**, fully separated from the generation/editing flow.

**Why not embed comparisons in the editor:**
- Users in the editor are in **build mode** — they want to iterate fast, not judge alternatives
- Interrupting the creative flow with comparison modals adds friction to the core experience
- Users making quick choices mid-generation produce lower-quality preference data than users who deliberately sit down to compare
- Midjourney validated this: their `/rank` page is completely separate from `/imagine`

**How it works:**

The `/rank` page is an optional, standalone experience accessible from the project library sidebar or account page. Users are shown two sections of the same type and pick the better one:

```
┌─ /rank ─────────────────────────────────────────────────┐
│                                                          │
│  Help improve future designs                    [3/10]  │
│                                                          │
│  Which testimonials section is better?                  │
│                                                          │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │                     │  │                     │      │
│  │  "Working with      │  │  ★★★★★             │      │
│  │   Acme Corp was..." │  │  "The team at..."   │      │
│  │                     │  │                     │      │
│  │  — CEO, BigCo       │  │  Photo + name grid  │      │
│  │                     │  │                     │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                          │
│   [ ◀ Left is better ]   [ Right is better ▶ ]         │
│   [         Can't decide / Both bad          ]          │
│                                                          │
│  ───────────────────────────────────────────────        │
│  Your ratings: 3 today | Lifetime: 47                   │
│  Top section types needing votes: footer, stats         │
└──────────────────────────────────────────────────────────┘
```

**The generation flow stays untouched** — variants replace the whole page as they do now. Implicit signals (export, edit, delete, regenerate) passively feed the composite score. ELO is the dedicated, high-quality signal that lives in its own space.

**Pair selection strategy (Active Learning):** Show pairs where the current ELO model is most uncertain — i.e., templates with similar ELO scores or few comparisons. This maximizes information gain per comparison (30-50% more efficient than random pairing per the active learning literature).

### 3.5 Multi-Dimensional Rating

No major platform exposes multi-dimensional ratings to users. Adobe uses multi-dimensional evaluation internally (prompt adherence, aesthetics, technical quality, safety) but only for model evaluation, not user-facing.

**Consensus:** Multi-dimensional ratings cause user fatigue and noisy data in production. Use them internally for automated evaluation only; keep user-facing ratings simple.

---

## 4. Academic Research

### 4.1 UICrit — Automated Design Critique

**Reference:** "UICrit: Enhancing Automated Design Evaluation with a UICritique Dataset" — Google Research, UIST 2024

- Trained on 11,344 professional design critiques
- Evaluates designs across dimensions: layout, typography, color, spacing, alignment, hierarchy, consistency
- Produces natural-language critiques, not numeric scores
- **Key finding:** Automated critiques correlate with professional human critiques at r=0.72

**Relevance to Atelier:** Our existing UICrit is rule-based (fast, deterministic). The Google approach uses an LLM trained on professional critiques — more nuanced but requires an AI call. A hybrid approach (rules for speed, AI for depth) is optimal.

### 4.2 Pairwise Comparison & Bradley-Terry Model

**Reference:** Bradley & Terry (1952), widely used in modern ML evaluation

The Bradley-Terry model estimates the probability that item A beats item B:

```
P(A > B) = score_A / (score_A + score_B)
```

This is the mathematical foundation of ELO ratings. For sparse ratings (few comparisons per item), the **Wilson score interval** provides a lower-bound estimate that is conservative — it won't over-rank items with few but positive ratings.

```
Wilson lower bound = (p + z²/2n - z√(p(1-p)/n + z²/4n²)) / (1 + z²/n)
```

Where `p` = positive ratio, `n` = total ratings, `z` = confidence (1.96 for 95%).

**Why this matters:** When a section template has only 2 ratings, both positive, the Wilson score correctly ranks it lower than a template with 50 ratings, 45 positive. Raw averages would rank them equally.

### 4.3 Multi-Armed Bandit for Component Selection

**Reference:** Thompson Sampling (1933), contextual bandits literature

When selecting components/templates for a prompt, the system faces an explore/exploit tradeoff:
- **Exploit:** Always use the highest-rated template → converges to a local optimum
- **Explore:** Sometimes try lower-rated or unrated templates → discovers better options

Thompson Sampling solves this by sampling from the posterior distribution of each template's quality. Templates with uncertain ratings (few data points) have wide distributions and get explored more often.

```
For each template:
  sample ~ Beta(positive_count + 1, negative_count + 1)
  select the template with highest sample
```

This naturally explores new templates while preferring proven ones.

### 4.4 Composite Quality Scores

**Approach:** Combine automated metrics with human ratings using a weighted sum:

```
composite_score = w_auto * automated_score + w_human * human_score + w_implicit * implicit_score
```

Where:
- `automated_score` = UICrit score (0-10), normalized
- `human_score` = explicit user rating (Wilson lower bound), normalized
- `implicit_score` = derived from actions (export=1.0, kept=0.7, edited=0.5, deleted=0.0)

**Weights should adapt:** When human ratings are sparse, lean on automated scores. As ratings accumulate, shift weight toward human judgments. A simple approach:

```
w_human = min(1.0, rating_count / 10)  // Ramps to full weight after 10 ratings
w_auto = 1.0 - w_human * 0.5           // Never fully drops automated score
```

---

## 5. Proposed Rating System

### 5.1 Architecture

```
                    ┌─────────────────────────────────────┐
                    │          Rating System               │
                    │                                     │
  ┌──────────┐     │  ┌───────────┐   ┌──────────────┐  │
  │ Generate │────►│  │ Auto-Score │   │ Human Rating  │  │
  │  Page    │     │  │ (UICrit)   │   │ (UI overlay)  │  │
  └──────────┘     │  └─────┬─────┘   └──────┬───────┘  │
                    │        │                 │          │
                    │        ▼                 ▼          │
                    │  ┌──────────────────────────────┐   │
                    │  │    Composite Score Engine     │   │
                    │  │  auto + human + implicit      │   │
                    │  └──────────────┬───────────────┘   │
                    │                 │                    │
                    │     ┌───────────┼───────────┐       │
                    │     ▼           ▼           ▼       │
                    │  Section    Layout      Component   │
                    │  Templates  Examples    Library     │
                    │  (RALF)    (RALF)      (quality)   │
                    └─────────────────────────────────────┘
                                  │
                                  ▼
                          Future Generations
                          (higher-rated assets
                           selected first)
```

### 5.2 Rating Levels

| Level | What is rated | Who rates | Storage |
|-------|--------------|-----------|---------|
| **Page** | Overall generated page | User (1-5 stars) + UICrit (0-10) | `generation_logs.quality` |
| **Section** | Individual section within a page | User (thumbs up/down) + UICrit rules | `section_templates.qualityScore` |
| **Component** | Library component used in generation | Implicit (usage count, acceptance) | `components.quality` |
| **Layout** | Section sequence pattern | Derived from page rating | `layout_examples.qualityScore` |

### 5.3 User-Facing Rating UI

#### Page-Level Rating

After generation completes, show a non-intrusive rating prompt in the editor:

```
┌─────────────────────────────────────────┐
│  How did this redesign turn out?        │
│                                         │
│  ☆ ☆ ☆ ☆ ☆          [Skip]            │
│                                         │
│  Your ratings improve future designs.   │
└─────────────────────────────────────────┘
```

- 1-5 stars (not 1-10 — research shows 5-point scales are more reliable)
- Appears once per generation, dismissable
- Also triggered on export (positive implicit signal)
- Displayed in the TopBar or as a floating toast after the page renders

#### Section-Level Rating

Each section in the "Why" overlay gets a thumbs up/down:

```
┌──────────────────────────────────────────────┐
│  Hero Section                                │
│  Persona: bold-modern | Source: library      │
│  CRO: single-cta-above-fold                 │
│                                              │
│  ──────────────────────────────────          │
│  Was this section good?  👍  👎              │
└──────────────────────────────────────────────┘
```

- Binary (thumbs up/down) to minimize friction
- Accessible from the existing "Why" overlay panel
- Each vote maps to: thumbs up = +1 positive, thumbs down = +1 negative
- Section type + industry + vote stored for per-type quality tracking

### 5.4 Implicit Signal Collection

Expand the existing feedback system to capture more signals automatically:

| Signal | When | Quality Inference | Weight |
|--------|------|-------------------|--------|
| **Export** | User downloads HTML | Strong positive | 1.0 |
| **Kept > 5 min** | Touch interval fires | Moderate positive | 0.5 |
| **Section edited** | Section-level edit endpoint hit | Weak positive (user invested effort) | 0.3 |
| **Variant requested** | Variant endpoint hit | Neutral-negative (wanted different) | 0.0 |
| **Regenerated** | Same prompt re-submitted | Negative | -0.3 |
| **Project deleted** | Project deletion | Negative | -0.5 |
| **Time-to-first-edit** | Time between render and first edit | Short = needs work, long = good | Scaled |
| **Section persistence** | Is the section still in the page 5 min later? | Persistent = good | 0.5 per section |

### 5.5 Composite Score Calculation

```typescript
interface CompositeScore {
  automated: number;    // UICrit score (0-10), always available
  humanExplicit: number; // Wilson lower bound of star ratings (0-1)
  humanImplicit: number; // Weighted action score (0-1)
  composite: number;    // Final blended score (0-10)
  confidence: number;   // How reliable is this score? (0-1)
  ratingCount: number;  // Total explicit + implicit signals
}

function computeCompositeScore(
  autoScore: number,          // UICrit 0-10
  explicitRatings: number[],  // Array of 1-5 star ratings
  implicitActions: Array<{ action: string; weight: number }>,
): CompositeScore {
  // Automated component (always available)
  const automated = autoScore;

  // Explicit human ratings — Wilson lower bound
  const totalExplicit = explicitRatings.length;
  const positiveExplicit = explicitRatings.filter(r => r >= 4).length;
  const humanExplicit = totalExplicit > 0
    ? wilsonLowerBound(positiveExplicit, totalExplicit)
    : 0.5; // neutral prior

  // Implicit signal aggregation
  const totalImplicit = implicitActions.length;
  const implicitSum = implicitActions.reduce((s, a) => s + a.weight, 0);
  const humanImplicit = totalImplicit > 0
    ? Math.max(0, Math.min(1, (implicitSum / totalImplicit + 0.5)))
    : 0.5; // neutral prior

  // Confidence: ramps with data
  const ratingCount = totalExplicit + totalImplicit;
  const confidence = Math.min(1.0, ratingCount / 20);

  // Blend: shift from auto → human as confidence grows
  const wAuto = 1.0 - confidence * 0.6;   // 1.0 → 0.4
  const wExplicit = confidence * 0.4;       // 0.0 → 0.4
  const wImplicit = confidence * 0.2;       // 0.0 → 0.2

  const composite = (
    wAuto * (automated / 10) +
    wExplicit * humanExplicit +
    wImplicit * humanImplicit
  ) * 10; // Scale back to 0-10

  return { automated, humanExplicit, humanImplicit, composite, confidence, ratingCount };
}
```

### 5.6 Component/Template Selection with Exploration

Replace the current `qualityScore DESC` sort with Thompson Sampling:

```typescript
function selectTemplate(
  candidates: SectionTemplate[],
): SectionTemplate {
  let bestSample = -Infinity;
  let bestTemplate: SectionTemplate | null = null;

  for (const t of candidates) {
    // Beta distribution parameters from rating data
    const alpha = t.positiveRatings + 1;  // +1 = uniform prior
    const beta = t.negativeRatings + 1;

    // Sample from Beta(alpha, beta)
    const sample = betaSample(alpha, beta);

    if (sample > bestSample) {
      bestSample = sample;
      bestTemplate = t;
    }
  }

  return bestTemplate!;
}
```

This naturally:
- Prefers templates with many positive ratings (exploit)
- Occasionally tries templates with few ratings (explore)
- Stops exploring templates with many negative ratings

### 5.7 Section ELO System

#### Algorithm

Each section template gets an ELO rating. When two sections are compared (pairwise), both ratings update:

```typescript
const K = 32; // K-factor: how much a single match moves ratings
              // Higher = faster convergence, more volatile
              // Midjourney uses K≈4 (stable). We use K=32 (faster learning with fewer users)

interface EloRating {
  rating: number;      // Starts at 1500
  matches: number;     // Total pairwise comparisons
  wins: number;        // Times picked as winner
  sigma: number;       // Uncertainty (TrueSkill-style, starts high)
}

function updateElo(
  winner: EloRating,
  loser: EloRating,
): { winner: EloRating; loser: EloRating } {
  const expectedWin = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
  const expectedLose = 1 - expectedWin;

  // Adaptive K: new templates (few matches) move faster
  const kWinner = winner.matches < 10 ? K * 2 : K;
  const kLoser = loser.matches < 10 ? K * 2 : K;

  winner.rating += kWinner * (1 - expectedWin);
  loser.rating += kLoser * (0 - expectedLose);
  winner.matches++;
  loser.matches++;
  winner.wins++;

  // Reduce uncertainty with each match
  winner.sigma = Math.max(50, winner.sigma * 0.95);
  loser.sigma = Math.max(50, loser.sigma * 0.95);

  return { winner, loser };
}

// For "can't decide / both fine" — slight boost to both (they're competitive)
function updateEloDraw(a: EloRating, b: EloRating): void {
  const expected = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400));
  a.rating += (K / 2) * (0.5 - expected);
  b.rating += (K / 2) * (0.5 - (1 - expected));
  a.matches++;
  b.matches++;
}
```

#### ELO Per Section Type

ELO ratings are scoped by section type. A hero template only competes against other hero templates:

```
hero templates:      [1620, 1580, 1540, 1500, 1490, 1410, ...]
nav templates:       [1550, 1520, 1500, 1480, ...]
footer templates:    [1530, 1500, 1470, ...]
features templates:  [1600, 1560, 1500, 1440, ...]
testimonials:        [1510, 1500, 1490, ...]
```

This means a brilliant hero (ELO 1620) doesn't inflate the ranking of an unrelated footer. Each section type has its own competitive pool.

#### Active Learning: Smart Pair Selection

When showing a comparison (Surface 4), don't pick randomly. Use uncertainty-weighted selection:

```typescript
function selectPairForComparison(
  templates: SectionTemplate[],
  sectionType: string,
): [SectionTemplate, SectionTemplate] {
  // Filter to same type
  const pool = templates.filter(t => t.type === sectionType);
  if (pool.length < 2) throw new Error("Need at least 2 templates");

  // Strategy: pick the template with highest uncertainty (fewest matches)
  // paired against a template with similar ELO (most informative comparison)
  pool.sort((a, b) => a.elo.matches - b.elo.matches);
  const uncertain = pool[0]; // Fewest matches = most uncertain

  // Find the template closest in ELO to the uncertain one (excluding itself)
  const others = pool.filter(t => t !== uncertain);
  others.sort((a, b) =>
    Math.abs(a.elo.rating - uncertain.elo.rating) -
    Math.abs(b.elo.rating - uncertain.elo.rating)
  );
  const opponent = others[0]; // Closest ELO = hardest comparison = most info

  // Randomize left/right to avoid position bias
  return Math.random() < 0.5
    ? [uncertain, opponent]
    : [opponent, uncertain];
}
```

**Why this works:** Comparing two templates with very different ELOs (1600 vs 1200) is a waste — the outcome is obvious. Comparing templates with similar ELOs and high uncertainty maximizes information per human judgment.

#### How ELO Feeds Into Generation

ELO ratings integrate with the existing template selection in two ways:

**1. Few-shot example selection (section-generator.ts):**
```typescript
// Current: getSectionTemplates() sorts by qualityScore DESC
// New: sort by ELO rating DESC, with Thompson Sampling for exploration

async getSectionTemplates(type: string, industry?: string, limit = 2): Promise<SectionTemplate[]> {
  const candidates = await this.sectionTemplates
    .find({ type, ...(industry ? { industry } : {}) })
    .sort({ "elo.rating": -1 })
    .limit(limit * 3) // Fetch extra for Thompson Sampling
    .toArray();

  // Thompson Sampling: sample from each template's rating distribution
  // and pick the top `limit` by sampled value
  return thompsonSelect(candidates, limit);
}
```

**2. Component library ranking (component.ts):**
```typescript
// Components that won ELO comparisons get a boost in selectForPrompt()
candidates.sort((a, b) => {
  const eloA = a.elo?.rating ?? 1500;
  const eloB = b.elo?.rating ?? 1500;
  const premiumScore = (c) => c.source === "hand-crafted:premium" ? 10 : 0;
  return (premiumScore(b) - premiumScore(a)) || (eloB - eloA) || (b.quality - a.quality);
});
```

#### Convergence & Stability

Based on Chatbot Arena research (LMSYS, ICML 2024):
- ~20 comparisons per template produces a rough ranking
- ~50 comparisons per template produces a stable ranking (bootstrap CI < 50 ELO points)
- With K=32 and adaptive K for new templates, Atelier needs fewer comparisons than Midjourney's K=4

**Cold start:** New templates start at ELO 1500 with high sigma (uncertainty). The adaptive K factor (K*2 for <10 matches) means new templates move quickly to their true ranking. Thompson Sampling ensures they get compared often enough.

**Rating decay:** Templates that haven't been compared in 60+ days get their sigma increased (uncertainty grows), making them eligible for re-evaluation. This prevents stale templates from holding high rankings.

---

## 6. Data Model Changes

### 6.1 New Fields on Existing Types

```typescript
// SectionTemplate — add rating tracking
interface SectionTemplate {
  // ... existing fields ...
  positiveRatings: number;   // NEW: count of thumbs-up
  negativeRatings: number;   // NEW: count of thumbs-down
  compositeScore: number;    // NEW: blended auto+human score (0-10)
  lastRatedAt?: string;      // NEW: for staleness detection
  elo: {                     // NEW: ELO rating for pairwise comparison
    rating: number;          // Starts at 1500
    matches: number;         // Total pairwise comparisons
    wins: number;            // Times picked as winner
    sigma: number;           // Uncertainty (starts at 350, decreases)
  };
}

// LayoutExample — add rating tracking
interface LayoutExample {
  // ... existing fields ...
  pageRatings: number[];     // NEW: array of 1-5 star page ratings
  compositeScore: number;    // NEW: blended score (0-10)
}

// GenerationLog — add section-level tracking
interface GenerationLog {
  // ... existing fields ...
  quality: {
    // ... existing fields ...
    pageRating?: number;         // NEW: 1-5 star page rating
    sectionRatings?: Array<{     // NEW: per-section thumbs
      sectionIndex: number;
      sectionType: string;
      vote: "up" | "down";
    }>;
  };
}

// UIComponentData — add rating fields
interface UIComponentData {
  // ... existing fields ...
  positiveSelections: number;  // NEW: times kept in final output
  negativeSelections: number;  // NEW: times removed/replaced
  compositeScore: number;      // NEW: blended quality score
  elo: {                       // NEW: ELO from pairwise comparison
    rating: number;
    matches: number;
    wins: number;
    sigma: number;
  };
}
```

### 6.2 New API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects/:pid/screens/:sid/rate` | Submit page-level star rating (1-5) |
| POST | `/api/projects/:pid/screens/:sid/rate-section` | Submit section-level thumbs up/down |
| POST | `/api/elo/compare` | Submit pairwise comparison result (winner/loser/draw) |
| GET | `/api/elo/pair/:sectionType` | Get next pair to compare (active learning selection) |
| GET | `/api/elo/leaderboard/:sectionType` | Top-rated templates by ELO for a section type |
| GET | `/api/analytics/quality-summary` | Dashboard: avg scores by type, industry |

### 6.3 New MongoDB Indexes

```javascript
// On section_templates
{ "compositeScore": -1, "type": 1 }
{ "positiveRatings": -1, "negativeRatings": 1 }
{ "elo.rating": -1, "type": 1 }           // ELO leaderboard per type
{ "elo.matches": 1, "elo.sigma": -1 }     // Active learning: find uncertain templates

// On layout_examples
{ "compositeScore": -1, "industry": 1, "pageType": 1 }

// On generation_logs
{ "quality.pageRating": 1, "createdAt": -1 }

// New collection: elo_matches (audit trail of all comparisons)
{ "sectionType": 1, "createdAt": -1 }
{ "winnerId": 1 }
{ "loserId": 1 }
```

---

## 7. Frontend Implementation

### 7.1 Page Rating Component

```
┌── PageRatingBar.tsx ─────────────────────┐
│                                          │
│  Appears as a slim bar below TopBar      │
│  after generation completes.             │
│                                          │
│  [★ ★ ★ ★ ☆]  "Great layout"   [Done]  │
│                                          │
│  Auto-dismisses after 30s if ignored.    │
│  Reappears on export with "Rate before   │
│  downloading?" prompt.                   │
└──────────────────────────────────────────┘
```

### 7.2 Section Rating in Why Overlay

The existing "Why" overlay already shows metadata per section. Add thumbs up/down buttons:

```
┌── Section Why Overlay ───────────────────┐
│  Hero Section                            │
│  Type: hero | Persona: bold-modern       │
│  Component: hero-gradient-01 (library)   │
│  CRO: single-cta-above-fold             │
│                                          │
│           [👍 12]    [👎 2]              │
│                                          │
│  These votes improve future hero         │
│  sections for similar brands.            │
└──────────────────────────────────────────┘
```

### 7.3 Rank Page — Section ELO (Dedicated)

Accessible from the project library sidebar or account page. Modeled after Midjourney's `/rank`:

```
┌── /rate ──────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌ Sidebar ────┐  ┌ Main ───────────────────────────────────────┐│
│  │             │  │                                              ││
│  │  Section    │  │  Which testimonials section is better?       ││
│  │  Types:     │  │                                              ││
│  │             │  │  ┌──────────────┐  ┌──────────────┐         ││
│  │  hero (3)   │  │  │              │  │              │         ││
│  │  nav  (7)   │  │  │  Section A   │  │  Section B   │         ││
│  │  features   │  │  │              │  │              │         ││
│  │  stats      │  │  └──────────────┘  └──────────────┘         ││
│  │  footer (5) │  │                                              ││
│  │  --------   │  │  [ ◀ A ]   [ Skip ]   [ B ▶ ]              ││
│  │  Your stats │  │                                              ││
│  │  47 rated   │  │  ── Leaderboard ─────────────────────────   ││
│  │  ★ top 10%  │  │  #1  hero-gradient   ELO 1620  (42 wins)   ││
│  │             │  │  #2  hero-cinematic   ELO 1580  (38 wins)   ││
│  └─────────────┘  │  #3  hero-minimal     ELO 1540  (29 wins)   ││
│                    │  #4  hero-split       ELO 1490  (15 wins)   ││
│                    └─────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

**Sidebar:** Shows section types with a badge count of "comparisons needed" (types with high uncertainty). Users can focus on types they care about.

**Leaderboard:** Live ELO rankings per section type. Shows the top templates that will be used in future generations. Gives users a sense that their votes have real impact.

### 7.4 Analytics Dashboard (Future)

A simple quality dashboard in the project library or account page:

```
┌── Quality Overview ──────────────────────┐
│                                          │
│  Average Page Rating:  ★★★★☆ (4.1)      │
│  Best Section Type:    Hero (4.6)        │
│  Worst Section Type:   Footer (3.2)      │
│  Templates in Library: 847               │
│  Most Reused:          nav-sticky-01     │
│                                          │
│  Rating Trend (30d):   ↑ +0.3           │
└──────────────────────────────────────────┘
```

---

## 8. Quality Feedback Loop — How It All Connects

```
1. USER PROMPT
       │
       ▼
2. PLAN SECTIONS
       │ ← Layout examples sorted by compositeScore DESC
       ▼
3. SELECT COMPONENTS
       │ ← Components selected via Thompson Sampling (explore/exploit)
       ▼
4. GENERATE SECTIONS
       │ ← Section templates as few-shot examples (compositeScore DESC)
       ▼
5. ASSEMBLE + UICrit
       │ → autoScore saved to generation_log
       ▼
6. RENDER IN EDITOR
       │
       ▼
7. USER INTERACTS
       │
       ├── Rates page (1-5 stars) ──────► pageRating saved
       ├── Rates sections (thumbs) ─────► sectionRatings saved
       ├── Exports ─────────────────────► implicit +1.0
       ├── Edits section ───────────────► implicit +0.3
       ├── Regenerates ─────────────────► implicit -0.3
       └── Deletes project ─────────────► implicit -0.5
       │
       ▼
8. COMPOSITE SCORE UPDATE
       │ → section_templates.compositeScore recalculated
       │ → layout_examples.compositeScore recalculated
       │ → component.compositeScore recalculated
       ▼
9. NEXT GENERATION USES HIGHER-RATED ASSETS
```

---

## 9. Implementation Plan

### Phase 1: Backend Scoring Infrastructure *(Done 2026-04-08)*
1. [x] Add `positiveRatings`, `negativeRatings`, `compositeScore` fields to `SectionTemplate`, `LayoutExample`, and `UIComponentData` interfaces
2. [x] Create `computeCompositeScore()` + `quickCompositeScore()` utility functions (`packages/sdk/src/utils/rating.ts`)
3. [x] Add `POST /api/projects/:pid/screens/:sid/rate` (1-5 stars) and `POST /api/projects/:pid/screens/:sid/rate-section` (thumbs up/down) endpoints
4. [x] Update `adjustTemplateScores()` to recalculate composite scores (Wilson lower bound)
5. [x] Migrate template selection from `qualityScore DESC` to `compositeScore DESC` (MongoDB sorts + indexes)
6. [x] Add `rateSectionTemplate()` method to `AnalyticsAdapter` + `MongoAnalytics`
7. [x] Add `sectionRatings` field to `UserFeedback` interface
8. [x] Existing `/api/feedback` endpoint now processes section-level votes
9. [x] All three packages compile clean (`npx tsc --noEmit`)

### Phase 2: Frontend Rating UI (Stars + Thumbs) *(Done 2026-04-08)*
10. [x] Create `PageRatingBar.tsx` — floating star rating bar shown after generation completes, auto-hides after 30s
11. [x] Add thumbs up/down buttons to Why overlay popover (iframe `postMessage` → parent → API)
12. [x] Wire up `apiRatePage()` and `apiRateSection()` fire-and-forget helpers in `utils/feedback.ts`
13. [x] Implicit signals already wired: export (+1.0), edited (+0.2), variant_created (+0.3), deleted (-0.5)
14. [x] Add `PageRatingBar` to editor view in `App.tsx`
15. [x] Section vote listener in `ScreenCard.tsx` forwards iframe votes to API

### Phase 3: ELO Backend + `/rank` Page *(Done 2026-04-08)*
10. [x] Add `EloRating` interface + `elo` field to `SectionTemplate` and `UIComponentData` (`packages/sdk/src/storage/interface.ts`, `packages/sdk/src/models/component.ts`)
11. [x] Create `updateElo()`, `updateEloDraw()`, `selectPairForComparison()`, `eloLeaderboard()`, `DEFAULT_ELO` in `packages/sdk/src/utils/rating.ts`
12. [x] Add `GET /api/elo/pair/:sectionType`, `POST /api/elo/compare`, `GET /api/elo/leaderboard/:sectionType`, `GET /api/elo/section-types` endpoints
13. [x] Add `elo_matches` MongoDB collection with indexes (`sectionType + createdAt`, `winnerId`)
14. [x] Add `submitEloComparison()`, `getEloPair()`, `getEloLeaderboard()`, `getSectionTypes()` to `AnalyticsAdapter` + `MongoAnalytics`
15. [x] Create `/rank` route in `App.tsx` + `RankPage.tsx` — section type sidebar, side-by-side iframe previews, keyboard shortcuts (A/D/Space, arrows)
16. [x] ELO leaderboard per section type shown below comparison area
17. [x] Active learning pair selection: fewest-matches template paired against closest-ELO opponent
18. [x] "Rank Sections" link added to ProjectLibrary user dropdown
19. [x] All three packages compile clean (`npx tsc --noEmit`)

### Phase 4: Intelligent Selection *(Done 2026-04-08)*
17. [x] Implement Thompson Sampling (`betaSample()`, `gammaSample()`, `thompsonSelect()`) in `packages/sdk/src/utils/rating.ts`
18. [x] `wilsonLowerBound()` exported for sparse binary rating ranking
19. [x] `getSectionTemplates()` now fetches 3x candidates and selects via Thompson Sampling (explore/exploit)
20. [x] `selectForPrompt()` sorts components by ELO > compositeScore > quality
21. [x] Confidence-weighted blending already in `computeCompositeScore()` (Phase 1) — auto weight shifts 1.0→0.4 as human data grows
22. [x] `decayStaleElo()` function + `applyEloDecay()` MongoDB method — sigma increases 1.5x for templates not compared in 60+ days
23. [x] `POST /api/analytics/elo-decay` endpoint to trigger decay manually or via cron
24. [x] All three packages compile clean

### Phase 5: Analytics & Monitoring *(Done 2026-04-08)*
25. [x] `QualitySummary` + `RatingTrend` interfaces added to `packages/sdk/src/storage/interface.ts`
26. [x] `getQualitySummary()` — avg composite score, avg page rating, best/worst section types, totals, 7d trend delta
27. [x] `getRatingTrends(days)` — daily feedback count, ELO match count, avg composite + ELO (up to 90 days)
28. [x] Quality regression detection via `ratingTrend7d` field in summary (negative = regression)
29. [x] Comparison volume per section type via `getSectionTypes()` (Phase 3) — shows count per type
30. [x] `GET /api/analytics/quality` — full quality summary endpoint
31. [x] `GET /api/analytics/trends?days=30` — daily trend data endpoint
32. [x] `POST /api/analytics/elo-decay` — trigger stale ELO decay

---

## 10. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page rating scale | 1-5 stars | Research shows 5-point scales are more reliable than 10-point. Matches user expectations. |
| Section rating scale | Binary (thumbs) + ELO (pairwise) | Thumbs for quick feedback; ELO for high-quality ranking data when showing alternatives. |
| ELO K-factor | 32 (adaptive: 64 for <10 matches) | Higher than Midjourney's K=4. Fewer users = need faster convergence. Adaptive K helps cold start. |
| ELO starting rating | 1500 | Standard ELO convention. All templates start equal, diverge with comparisons. |
| ELO scope | Per section type | Hero vs hero, footer vs footer. Cross-type comparison is meaningless. |
| Default quality score | 3/10 | Neutral prior. New templates start here and move up/down with feedback. |
| Score blending | Weighted sum with adaptive weights | Simple, interpretable. Weights shift from automated → human as data accumulates. |
| Template selection | Thompson Sampling over ELO | ELO provides the quality signal. Thompson Sampling adds exploration of uncertain templates. |
| Rating persistence | MongoDB with 90-day TTL on logs, permanent on templates + ELO | Ratings and ELO on templates persist forever; raw logs expire. Match history in `elo_matches` kept permanently. |
| Multi-dimensional rating | Internal only (UICrit) | User-facing multi-dimensional ratings cause fatigue (Midjourney finding). Keep it simple for users. |
| ELO comparison surface | Dedicated `/rank` page only | Keep generation flow clean. Users in "build mode" produce lower-quality preference data than users in "judge mode". Midjourney validated this separation. |
| Active learning | Uncertainty-weighted pair selection | Show close-ELO pairs with few matches. 30-50% more efficient than random pairing. |

---

## 11. Research References

### Industry Systems
- **Midjourney ELO Ranking** — Pairwise comparison system at `midjourney.com/rank`. Users compare two images, each accumulates an ELO score. High-ELO images feed into DPO training. Users earn free GPU time for participating.
- **GitHub Copilot Persistence Metric** — Tracks whether accepted code persists 30s/2m/5m later. More reliable than initial accept/reject signal.
- **Vercel v0** — Thumbs up/down on generated components. Curated "blocks" from popular generations. No public quality scoring.
- **Builder.io Visual Diff** — Pixel-level fidelity comparison between Figma source and generated output as automated quality metric.

### Academic Foundations

**Quality Assessment:**
- **UICrit** (Chiang, Xie, Duan, Hartmann et al., UIST 2024) — Automated design critique from 11,344 professional critiques. Evaluates layout, typography, color, spacing, alignment, hierarchy, consistency. Natural-language critiques correlate with human critiques at r=0.72.
- **Predicting Web Page Aesthetics** (Michailidou, Harper, Bechhofer, 2008, ACM Trans. Web) — Visual complexity and colorfulness are the two strongest predictors of perceived web aesthetics. Regression on pixel-level features predicts 1-7 aesthetic scores.
- **Design2Code** (Si, Zhang, Yang, Liu, Yang, ICML 2024) — Benchmarked multimodal LLMs on design-to-code. Introduced composite fidelity scoring: CLIP visual similarity + DOM tree edit distance + text content accuracy. CLIP-based similarity correlated best with human judgments (r=0.65).
- **Learning Visual Importance** (Bylinskii et al., UIST 2017) — CNN trained on eye-tracking data predicts per-element visual importance (0-1). Gap between intended importance and predicted saliency serves as a design quality metric.

**Rating Algorithms:**
- **Bradley-Terry Model** (Bradley & Terry, Biometrika 1952) — Foundation of ELO ratings. Estimates win probability from paired comparisons: P(i > j) = score_i / (score_i + score_j). Maximum likelihood estimation from observed outcomes.
- **Wilson Score Interval** (Wilson, 1927; popularized by Evan Miller, 2009) — Lower-bound confidence interval for proportions. Prevents over-ranking items with few positive ratings. Used by Reddit, Yelp, Amazon for ranking with sparse data.
- **Thompson Sampling** (Thompson, 1933; formalized by Agrawal & Goyal, ICML 2013) — Bayesian approach to multi-armed bandits. Beta(alpha, beta) posterior for each component. Naturally explores uncertain components while exploiting known-good ones.
- **TrueSkill 2** (Minka, Cleven, Zaykov, Microsoft 2018) — Bayesian skill rating with Gaussian beliefs (mu, sigma). Sigma decreases with more data. Handles cold-start naturally via high initial uncertainty.

**Preference Learning:**
- **DPO (Direct Preference Optimization)** (Rafailov et al., NeurIPS 2023) — Trains models directly on human preferences without a separate reward model. Implicit Bradley-Terry where model log-probabilities serve as quality scores.
- **Chatbot Arena / LMSYS** (Chiang et al., ICML 2024) — ELO ranking for LLMs via 200K+ crowdsourced pairwise comparisons. Ratings stabilize after ~500 comparisons per model. Bootstrap confidence intervals (1000 resamples) for uncertainty.
- **HPS v2 (Human Preference Score)** (Wu et al., 2023) — Scoring model trained on 798K human preference annotations. Fine-tuned CLIP with preference head. ~70% agreement with human preferences.
- **PickScore** (Kirstain et al., NeurIPS 2023) — CLIP-ViT-H fine-tuned on 500K+ preferences. Combining PickScore (preference-aligned) with CLIP score (semantic alignment) at ratio 0.7/0.3 outperforms either alone.

**Component Selection:**
- **LinUCB Contextual Bandits** (Li, Chu, Langford, Schapire, WWW 2010) — Select components based on context features. UCB adds exploration bonus proportional to uncertainty.
- **Active Learning for RLHF** (multiple groups, 2023-2024) — Uncertainty sampling: show pairs where the reward model is most uncertain. Reduces annotation cost by 30-50% vs random sampling.
- **Reward Model Ensembles** (multiple groups, 2023-2024) — Ensemble of automated metrics + human preference model + constraint satisfaction. Equal weighting works as a baseline; learned weights improve by 5-15%.

---

## 12. Open Questions

1. **Incentivize rating?** Midjourney gives free GPU time. Should Atelier offer anything (priority generation, extended TTL, unlocked features)?
2. **Cold start problem?** New section types have no ratings or ELO data. Thompson Sampling + adaptive K handles this, but initial UX may show "no leaderboard yet" states.
3. **Rating decay?** Planned: sigma increases after 60 days without comparison. But should ELO itself decay, or just uncertainty? A template rated highly 6 months ago may not match current design trends.
4. **Cross-user ratings?** In multi-user mode, should one user's ELO comparisons affect another user's template selection? Options: (a) shared global ELO, (b) per-user ELO, (c) global ELO with per-user overrides.
5. **Blind vs informed comparison?** Should users see ELO stats during comparison (current plan shows them), or should comparisons be blind for less biased data? Midjourney is blind.
6. **Minimum comparisons before using ELO?** Should the system require N comparisons before ELO influences template selection, or trust Thompson Sampling to handle uncertainty?
7. **Section HTML rendering in comparisons?** Sections reference external assets (Google Fonts, picsum.photos). Offline/slow connections may make previews look broken. Should we cache rendered screenshots instead?
8. **Gamification?** Should the `/rank` page have streaks, badges, or a personal leaderboard ("You've ranked 47 sections — top 10% of raters")? Risk of gaming vs engagement tradeoff.
