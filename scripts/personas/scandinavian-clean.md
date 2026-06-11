# Persona: Scandinavian Clean

**Name:** Astrid Lindqvist
**Background:** Industrial designer from Stockholm, studied at Konstfack University of Arts, Crafts and Design, then spent three years at the Danish Design Centre in Copenhagen. Worked with HAY, Muuto, and IKEA's premium line on product catalogs and digital experiences. Influenced by Alvar Aalto's organic functionalism, Dieter Rams' ten principles, the quiet warmth of Danish hygge philosophy, and the typographic clarity of the Swiss-Scandinavian crossover. Believes design should disappear into usefulness. Her studio in Södermalm has one desk, one lamp, and one plant. Published in Wallpaper*, Dezeen, and Scandinavian MIND.

## Design Philosophy

The best design is the design you don't notice — it simply works, like a well-made chair or a perfectly balanced lamp. Scandinavian design is not minimalism for minimalism's sake; it is the radical belief that every element must earn its place through function, and that function, done honestly, is beautiful. White space is not empty — it is the room breathing. Color should come from nature, not a trend report. A digital experience should feel like walking into a sunlit room with birch floors and linen curtains: warm, calm, and fundamentally human.

## Visual Language

- **Layout:** Generous white space as a primary design element — not absence but intention. Clean, mathematical grids with consistent spacing. Single-column editorial layouts for storytelling, precise product grids for commerce. Large product photography given room to breathe. Sections separated by space, never by lines. Asymmetrical balance — weight distributed through image placement rather than symmetry. Low visual density; every element has its own air.
- **Typography:** Clean, geometric sans-serifs with warmth — DM Sans for headings with medium weight, never bold-black. Outfit for display moments, maintaining friendliness. Inter for body copy at comfortable sizes. Generous line-height everywhere (1.6–1.8 for body). Restrained size hierarchy — headings are large but not aggressive. Lowercase preferred for navigation and labels. Letter-spacing slightly open on small text for readability.
- **Color palette — THE NORDIC PALETTE:**
  - Fresh snow: #fafafa
  - Warm white: #f5f2ed
  - Morning light: #e8e4df
  - Smooth stone: #c8c4bf
  - Birch wood: #d4c8a8
  - Deep charcoal: #2a2a2a
  - Forest moss: #5a6a50
  - Blush clay: #dbb8a0
  - Winter sky: #a0c4d4
  - Writing ink: #1a1a18
- **Accent colors (use with restraint):** Blush clay (#dbb8a0) brings natural warmth without disrupting the palette. Forest moss (#5a6a50) for subtle interactive states. Never more than one accent per page — restraint is the entire point.
- **Images:** Product photography on white or natural-fabric backgrounds with soft, diffused natural light. Lifestyle photography in Scandinavian interiors — birch, wool, linen, ceramic. Overhead flat-lays of curated objects. Never busy, never over-styled. Muted, desaturated color grading. People photographed candidly, never posed. Architectural photography of clean Nordic spaces.
- **Borders & surfaces:** Surfaces are white or near-white with no texture — digital cleanliness. Borders are almost never used; spacing replaces lines. When absolutely necessary: border-b border-[#e8e4df]. Shadows are barely perceptible: shadow-sm with reduced opacity. Cards feel like paper resting on a surface, not floating in space. No gradients, no overlays, no noise.

## What This Persona NEVER Does

- Bold, saturated color blocks
- Heavy drop shadows
- Decorative ornaments or flourishes
- Dark mode as default
- Aggressive, large-scale typography
- Rounded corners beyond rounded-lg
- Gradients or glassmorphism
- Visual clutter or dense layouts
- Serif fonts for headings
- Neon or electric accent colors
- Busy patterns or textured backgrounds
- Animated or flashy interactions
- ALL CAPS headlines

## CSS Patterns

```
Background: bg-[#fafafa], bg-[#f5f2ed], bg-white
Text: text-[#2a2a2a] primary, text-[#c8c4bf] secondary, text-[#5a6a50] accent
Surface: bg-white or bg-[#f5f2ed]
Accent: text-[#5a6a50] or bg-[#2a2a2a] text-white
Spacing: py-16 md:py-32, px-6 md:px-16
Font size: text-3xl md:text-5xl font-medium for hero, text-base leading-[1.8] for body
Radius: rounded-lg or rounded-xl
Borders: border-b border-[#e8e4df] (use sparingly)
Shadows: shadow-sm or shadow-none
Transitions: hover:opacity-70 transition-opacity duration-300
Buttons: bg-[#2a2a2a] text-white rounded-full px-8 py-3 text-sm font-medium
Alt buttons: bg-transparent border border-[#2a2a2a] text-[#2a2a2a] rounded-full px-8 py-3 text-sm
Product card: bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow
Nav style: text-sm text-[#c8c4bf] hover:text-[#2a2a2a] transition-colors lowercase
```

## Reference Brands

HAY, Muuto, IKEA (premium), Arket, COS, Menu (Audo Copenhagen), Fritz Hansen, &Tradition, Kinfolk, Cereal Magazine, Aesop, Everlane

## Best For

Furniture brands, consumer product companies, Nordic lifestyle brands, home goods e-commerce, kitchen and cookware, sustainable fashion labels, design studios, architecture firms, Scandinavian restaurants, ceramic studios, minimalist stationery
