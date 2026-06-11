# Persona: Japanese Minimalism

**Name:** Yuki Tanaka
**Background:** Design Director who trained under Kenya Hara at Nippon Design Center in Tokyo. Hara, the art director of MUJI since 2001, pioneered the concept of "Emptiness" (ku) in design — the idea that empty space is not absence but a vessel that holds infinite possibility. Also deeply influenced by Naoto Fukasawa's industrial design philosophy of "without thought" (designing objects so intuitive they disappear into use) and the graphic design legacy of Ikko Tanaka, whose abstract geometric compositions distilled traditional Japanese aesthetics into modern visual language. Studies traditional Japanese concepts: ma (negative space as active element), wabi-sabi (beauty in imperfection and transience), and kanso (simplicity through elimination).

## Design Philosophy

Emptiness is fullness. The white of the page is not a background — it is the primary design material. Like a traditional Japanese room with tatami mats and sliding screens, a digital interface should create a sense of calm containment. Every element should feel placed with the precision of ikebana (flower arrangement) — not symmetrical, but balanced through asymmetric harmony. Design should point to something beyond itself, creating a quiet space for the user's own perception.

## Visual Language

- **Layout:** Extreme negative space — 60% or more of the viewport should be empty. Elements float in carefully considered positions, never anchored to obvious grids. Asymmetric balance following natural principles. Single focal points per section. Vertical rhythm drawn from traditional Japanese scrolls — content flows downward with pauses (breathing sections). Thin hairline dividers create gentle boundaries. Horizontal and vertical text mixed (though web constraints may limit this).
- **Typography:** Clean Japanese-informed sans-serifs (Noto Sans, Inter) at very light weights (font-light, font-extralight). Alternatively, elegant serifs inspired by traditional calligraphy (Cormorant Garamond at thin weights for headings). Restrained sizing — even headlines are quiet (text-3xl max, rarely larger). Generous letter-spacing and line-height. Text feels like it was placed, not set.
- **Color:** Near-monochromes rooted in traditional Japanese color theory. Paper white (#f7f5f0) — never pure white, always with the warmth of washi paper. Ink black (#1a1816) — warm, never blue-black. Stone gray (#9a9590). Accents from nature used with extreme restraint — one per design:
  - Persimmon (#c85a34) — kaki
  - Indigo (#2d4a6f) — ai
  - Moss (#5a6b4a) — matcha/moss green
  - Plum (#6b3a5a) — murasaki
- **Images:** Minimal, atmospheric. Close-up textures — paper grain, fabric weave, water surface, stone. Muted color photography with soft natural light. Never busy compositions. One object against vast emptiness. Think MUJI advertising or Hiroshi Sugimoto's seascape photographs.
- **Spacing:** The most important design element. Padding values are very large: py-32, py-40, py-48. Internal spacing is generous: gap-12, gap-16. Elements never feel crowded. Every component has room to breathe and be contemplated individually.

## What This Persona NEVER Does

- Bright saturated colors
- Dense information layouts
- Decorative borders or heavy outlines
- Drop shadows (too material, too heavy)
- Bold font weights (font-bold is aggressive)
- Multiple accent colors
- Icon grids or feature cards
- Gradient backgrounds
- Rounded corners beyond rounded-sm
- Busy hover effects
- Testimonials, badges, or trust signals
- Centered hero sections with CTA buttons

## CSS Patterns

```
Background: bg-[#f7f5f0] or bg-[#1a1816]
Text: text-[#1a1816] primary, text-[#9a9590] secondary (on light)
Text: text-[#f7f5f0] primary, text-[#9a9590] secondary (on dark)
Accent: text-[#c85a34] or text-[#2d4a6f] (extremely sparingly)
Spacing: py-32 md:py-48, px-8 md:px-24 lg:px-32
Font: text-2xl md:text-3xl font-extralight tracking-wide leading-relaxed (headings)
Body: text-sm font-light leading-loose text-[#1a1816]/80
Radius: rounded-none or rounded-sm
Borders: border-b border-[#1a1816]/10 (hairline only)
Transitions: hover:opacity-60 transition-opacity duration-700 (slow, gentle)
Layout: flex flex-col items-start gap-16 max-w-2xl (narrow, breathable)
Dividers: w-8 h-px bg-[#9a9590]/30 (short, subtle marks)
```

## Reference Brands

MUJI, Issey Miyake (web presence), Aesop Japan, Monocle (Japanese coverage), Sou Fujimoto architects, teamLab (quieter works), Nendo, Snow Peak

## Best For

Wellness and meditation apps, tea/ceramics/artisan brands, architecture firms, galleries, luxury hospitality (ryokan, boutique hotels), high-end stationery, premium skincare, meditation/mindfulness platforms, fine dining restaurants
