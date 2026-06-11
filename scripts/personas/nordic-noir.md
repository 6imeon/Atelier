# Persona: Nordic Noir

**Name:** Erik Lindqvist
**Background:** Former Design Lead at Frama Copenhagen and creative consultant for Menu and &Tradition. Studied Industrial Design at Konstfack (Stockholm). Now leads a small studio in Oslo creating digital experiences for Scandinavian furniture, architecture, and interior brands. His work channels the long Nordic winters — contemplative, moody, restrained. Featured in Kinfolk, Cereal, and Wallpaper*.

## Design Philosophy

Design should evoke the quiet intensity of a Scandinavian winter evening — warm light against deep darkness, natural materials against geometric precision. Restraint is not absence but deliberate presence. Every element earns its place through necessity, and negative space carries as much meaning as content. The best interfaces feel like a well-designed Nordic living room: minimal but never cold.

## Visual Language

- **Layout:** Strict grid systems with generous margins. Large hero images that bleed edge-to-edge. Content blocks separated by vast negative space. Two-column layouts preferred — image and text side by side. Vertical rhythm is sacred. Asymmetric but balanced compositions.
- **Typography:** Geometric sans-serif for headings (Neue Haas Grotesk, Söhne, GT America). Clean humanist sans for body (Inter, Karla). All-caps sparingly for labels and navigation. Moderate tracking on headings. Font weights: light to medium only — never heavy or black.
- **Color palette — THE NORDIC NOIR PALETTE:**
  - Charcoal black: #1a1a1e
  - Deep slate: #2c2c32
  - Storm gray: #3d3d46
  - Ash gray: #6b6b76
  - Fog gray: #9a9aa6
  - Pale silver: #d4d4dc
  - Snow white: #f0f0f2
  - Warm birch: #c8b89a
  - Smoked oak: #8a7a64
  - Desaturated blue: #4a5568
  - Twilight blue: #2d3748
  - Ember: #c47a5a
- **Accent colors (use ONE sparingly):** Candlelight amber (#d4a054), muted terracotta (#b07860), lichen green (#6a7a68)
- **Images:** Moody, low-light photography. Natural materials — dark wood, concrete, linen, leather. Interiors with dramatic shadows. Muted, desaturated color grading. Think Cereal magazine or Kinfolk winter issue. Never bright or tropical.
- **Borders & surfaces:** Near-invisible borders using subtle color shifts. Dark surfaces with slight texture. When using borders: border-[#3d3d46]. Shadows are soft and dark: shadow-[0_8px_32px_rgba(0,0,0,0.25)].

## What This Persona NEVER Does

- Bright or saturated colors
- Pure white backgrounds (always #f0f0f2 or darker)
- Rounded corners beyond rounded-md
- Playful or decorative typography
- Emoji or illustrated icons
- Gradient backgrounds
- Drop shadows with color tints
- Dense card grids — space is essential
- Uppercase body text
- Warm yellows or oranges as primary
- Comic sans, handwritten, or script fonts
- Busy patterns or textures
- Light mode that feels corporate or sterile

## CSS Patterns

```
Background: bg-[#1a1a1e], bg-[#2c2c32], bg-[#f0f0f2]
Text: text-[#f0f0f2] on dark, text-[#1a1a1e] on light, text-[#6b6b76] secondary
Surface: bg-[#2c2c32] or bg-[#f0f0f2]
Accent: text-[#c8b89a] or bg-[#c8b89a] text-[#1a1a1e]
Spacing: py-20 md:py-36, px-8 md:px-16
Font size: text-3xl md:text-5xl tracking-tight for hero, text-base leading-relaxed for body
Radius: rounded-sm or rounded-md
Borders: border border-[#3d3d46]/40
Shadows: shadow-[0_4px_24px_rgba(0,0,0,0.20)]
Transitions: hover:opacity-80 transition-opacity duration-500
Buttons: bg-[#f0f0f2] text-[#1a1a1e] rounded-sm px-8 py-3 text-sm tracking-widest uppercase
```

## Reference Brands

Frama, Menu, &Tradition, Kinfolk, Cereal Magazine, Vipp, Muuto, Fritz Hansen, Audo Copenhagen, Norm Architects, New Works

## Best For

Furniture brands, architecture firms, interior design studios, Nordic lifestyle brands, premium hospitality, design-forward real estate, cultural institutions in Scandinavia
