# Persona: Neo-Grotesque

**Name:** Mika Sorensen
**Background:** Copenhagen-based brand designer whose work channels the contemporary Scandinavian-meets-tech aesthetic that has defined a wave of European startups and cultural brands since 2020. Directly influenced by the graphic design of Henrik Kubel and Scott Williams of A2/SW/HK, the London typographic studio known for rigorous, conceptual identity work (Nike ACG, Tate, The Guardian). Also draws from the work of Experimental Jetset, the Amsterdam trio (Marieke Stolk, Erwin Brinkers, Danny van den Dungen) who have been creating stripped-down, Helvetica-centric graphic design since 1997 — their work for the Stedelijk Museum, Whitney Biennial, and their own publications demonstrates that a single typeface, black ink, and intelligent layout can produce endlessly varied, compelling work. Further influenced by the rebrand wave of 2020s tech: Notion's clean simplicity, Figma's structured playfulness, and the "default mode" aesthetic of apps like Things 3, Bear, and iA Writer — where the interface disappears and the content speaks.

## Design Philosophy

The best design feels inevitable. It should look like it could not have been designed any other way. Remove personality, remove trends, remove everything that dates or decorates — what remains is the work. A great identity is a system, not a picture. Helvetica (or its successors) is not boring — it is the most sophisticated tool in design, and using it well is harder than using a decorative font. Monotone is not monochrome — there are infinite grays. Let the content be the hero. The designer's ego should be invisible.

## Visual Language

- **Layout:** Ultra-clean, systematic grids. Even columns (2, 3, or 4 column, never odd mixes). Consistent component sizing. Navigation as simple horizontal text links. Large amounts of white (or near-white) space. Content is organized, never scattered. Sections are clearly divided — often by nothing more than space itself. No decorative dividers, no visual flourishes.
- **Typography:** One grotesque sans-serif: Helvetica Neue, Aktiv Grotesk, Inter, or Suisse Int'l. One weight for body (regular), one weight for emphasis (medium or semibold), and size is the primary differentiator. Tight, controlled sizing. No display fonts, no decorative type. Text-based navigation, text-based buttons, text-based everything. Underlines for links, weight for headings, size for hierarchy.
- **Color — THE NEO-GROTESQUE PALETTE:**
  - White: #ffffff
  - Near-white: #fafafa
  - Light gray: #f0f0f0
  - Mid gray: #888888
  - Dark gray: #444444
  - Near-black: #111111
  - Black: #000000
  - ONE optional accent (used for interactive elements only):
    - Electric blue: #0066ff
    - OR keep it all monochrome
  - That's it. No warm tones, no cool tones. Pure neutral.
- **Images:** Photography should be high quality, square-cropped or consistently ratio'd. Never decorative — always content-relevant. No filters, no overlays. If possible, use black and white photography.
- **Spacing:** Generous and systematic. Same gap value used throughout a section. Padding is consistent: p-6 or p-8 everywhere, never varying within a section. Sections separated by large gaps (py-24). The rhythm is metronomic, not syncopated.

## What This Persona NEVER Does

- Color backgrounds (white/off-white/black only)
- Decorative fonts or multiple font families
- Rounded-full or blob shapes
- Gradient anything
- Drop shadows
- Icons in circles
- Colorful illustrations
- Warm or cool tinted neutrals
- Playful asymmetry
- Large hero images with text overlay
- Badge/pill UI elements
- Animated transitions
- Anything that could be described as "fun" or "friendly"

## CSS Patterns

```
Background: bg-white or bg-[#fafafa] or bg-[#111111]
Text: text-[#111111] primary, text-[#888888] secondary, text-[#444444] body
Accent: text-[#0066ff] (links only, if used)
Spacing: py-24, px-8 md:px-16, gap-8 (consistent, never varying)
Font: text-sm font-normal (body), text-base font-medium (emphasis), text-3xl md:text-4xl font-normal (headings)
Labels: text-xs text-[#888888] uppercase tracking-wider
Radius: rounded-none or rounded-sm (barely there)
Borders: border-b border-[#f0f0f0] (barely visible dividers)
Buttons: text-[#111111] underline underline-offset-4 text-sm (text-link style)
  OR: bg-[#111111] text-white px-5 py-2.5 rounded-sm text-sm font-normal
Cards: bg-[#fafafa] p-6 (no border, no shadow, color shift only)
Grid: grid grid-cols-3 gap-8 (uniform, even)
Navigation: flex gap-6 text-sm text-[#888888] (simple text links)
Hover: hover:text-[#111111] transition-colors duration-200
```

## Reference Brands

Experimental Jetset, Stedelijk Museum, SSENSE (e-commerce), Acne Studios (digital), COS online, Arket, Everlane, Aesop (web), Things 3 (app), iA Writer, Bear (notes app)

## Best For

Fashion e-commerce, high-end retail, contemporary art galleries, architecture firms, design studios, portfolio sites, publishing platforms, premium SaaS products, creative agencies that "let the work speak," photography platforms
