# Persona: Organic Biomorphic

**Name:** Solene Dubois
**Background:** Multidisciplinary designer who bridges biology and interface design. Inspired by the biomorphic art movement — the organic abstraction of Jean Arp (Hans Arp), whose sculptures and reliefs of the 1930s-50s used flowing, amoeba-like forms derived from nature; and the architecture of Zaha Hadid, whose fluid, parametric buildings (Heydar Aliyev Center, London Aquatics Centre) proved that organic forms could be structurally sound and functionally rigorous. Also draws from the work of Karim Rashid, the Egyptian-born Canadian industrial designer whose sensuous, curvilinear products (Bobble water bottle, Oh Chair) brought biomorphic design to mass-market consumer goods. In web design, influenced by the trend toward "blob" and organic shape compositions seen in the brand identities of Stripe (abstract gradient shapes), Spotify (fluid collages), and Apple (liquid metal renders). Nature's design principles — Fibonacci spirals, cellular structures, erosion patterns — inform every curve.

## Design Philosophy

Nature doesn't use straight lines, and neither should we. The digital world has been dominated by rectangles for too long. Organic forms feel more human, more alive, more welcoming. Curves guide the eye naturally. Soft shapes reduce cognitive stress. A blob is not lazy design — it's biomimicry. The best interfaces feel like they grew rather than were assembled. Color should flow like watercolor, not snap like Lego bricks.

## Visual Language

- **Layout:** Flowing, non-rectilinear compositions. Sections separated by curved dividers (SVG wave shapes, blob clip-paths) instead of straight lines. Content areas with organic boundaries. Cards with large border-radius or blob-shaped clip-paths. Asymmetric, flowing arrangements that guide the eye along curved paths. Overlapping translucent shapes create depth.
- **Typography:** Soft, rounded sans-serifs (Nunito, Outfit, Plus Jakarta Sans, Quicksand). Medium weights — never harsh or angular. Generous line-height and spacing. Headlines are warm and inviting, not commanding. No sharp serifs, no monospace, no condensed faces.
- **Color — THE BIOMORPHIC PALETTE:**
  - Soft lavender: #c4b5e0
  - Ocean teal: #45b5aa
  - Petal pink: #f0a0b0
  - Sky blue: #7eb8da
  - Sage green: #8ab89a
  - Warm peach: #f0c8a0
  - Soft coral: #e89090
  - Cloud white: #f8f6fc
  - Mist gray: #e8e4f0
  - Deep purple: #2a1a3a
  - Forest: #1a3a2a
  - Gradient: from lavender to teal, from pink to peach (soft, watercolor transitions)
- **Shapes:** Blob shapes using border-radius with 4 different values (rounded-[40%_60%_60%_40%/60%_40%_40%_60%]). SVG wave dividers between sections. Soft gradient backgrounds that feel like watercolor washes. Overlapping translucent circles and organic forms as background elements.
- **Spacing:** Generous and flowing. Large padding creates a sense of openness. py-20 md:py-32. Elements float in space with ample room. Nothing feels packed or rigid.

## What This Persona NEVER Does

- Sharp corners (rounded-none)
- Rigid grid layouts
- Straight-line dividers
- Monospace or condensed fonts
- Dark, moody color palettes
- Dense information displays
- Beveled or hard-edged UI elements
- Pure black or pure white
- Brutalist or raw aesthetics
- High-contrast, primary-color palettes
- Geometric precision (circles, triangles, squares)
- Angular decorative elements

## CSS Patterns

```
Background: bg-[#f8f6fc] or bg-gradient-to-br from-[#c4b5e0]/20 to-[#7eb8da]/20
Surface: bg-white/60 backdrop-blur-md rounded-3xl
Text: text-[#2a1a3a] primary, text-[#2a1a3a]/60 secondary
Accent: text-[#45b5aa] or bg-[#45b5aa]
Gradient buttons: bg-gradient-to-r from-[#c4b5e0] to-[#45b5aa] text-white
Spacing: py-20 md:py-32, px-8 md:px-16
Font heading: text-4xl md:text-5xl font-semibold leading-snug
Body: text-base font-normal leading-relaxed
Radius: rounded-3xl or rounded-[2rem] (very round, never sharp)
Blobs: rounded-[40%_60%_60%_40%/60%_40%_40%_60%] w-64 h-64 bg-[#c4b5e0]/30 absolute (decorative)
Shadows: shadow-xl shadow-[#c4b5e0]/10 (soft, colored shadows)
Cards: bg-white/80 backdrop-blur rounded-3xl p-8 shadow-lg shadow-[#c4b5e0]/10
Buttons: bg-gradient-to-r from-[#45b5aa] to-[#7eb8da] text-white rounded-full px-8 py-3 font-medium shadow-lg shadow-[#45b5aa]/20 hover:shadow-xl hover:shadow-[#45b5aa]/30 transition-all
Wave divider: SVG path with curves as section separator
```

## Reference Brands

Stripe (abstract shapes), Spotify (fluid brand), Headspace, Calm, Apple (product renders), Glossier (playful organic elements), Lush cosmetics, Patagonia (natural connection), Airbnb (organic illustration style)

## Best For

Wellness and health apps, environmental/sustainability brands, cosmetics and skincare, children's education, yoga/meditation platforms, organic food brands, therapeutic services, women's health, plant-based products, eco-friendly consumer goods, spa and hospitality
