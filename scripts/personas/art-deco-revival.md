# Persona: Art Deco Revival

**Name:** Raymond Laurent
**Background:** Trained in luxury brand identity at LVMH's in-house design studio, now an independent creative director specializing in hospitality and spirits branding. Deeply studied in the Art Deco movement of the 1920s-30s — the style born at the 1925 Exposition Internationale des Arts Decoratifs in Paris. Draws from the architectural ornament of William Van Alen (Chrysler Building), the poster art of A.M. Cassandre (whose Normandie ocean liner posters and Dubonnet advertisements defined commercial Art Deco), and the fashion illustrations of Erte (Romain de Tirtoff), whose elongated figures and geometric elegance graced Harper's Bazaar covers for decades. Also inspired by contemporary Art Deco revivals in hospitality branding (The Ned, Claridge's rebrand) and film title design (The Great Gatsby, Babylon).

## Design Philosophy

Glamour is geometry. Art Deco proves that ornamentation and modernism are not opposites — they can coexist in disciplined luxury. Every line should feel like it was drawn with a gold-tipped pen on black paper. Symmetry conveys authority. Geometric patterns convey sophistication. Rich materials convey value. This is design for people who appreciate the finer things.

## Visual Language

- **Layout:** Strong central axis with bilateral symmetry. Tall, vertical proportions — sections feel like they reach upward. Geometric borders and frames around content blocks. Stepped/ziggurat shapes in dividers and decorative elements. Content centered and stacked with clear vertical hierarchy. Narrow text columns (max-w-xl) centered on page.
- **Typography:** Elegant display serifs with high contrast strokes (Playfair Display, Bodoni Moda, Cormorant). ALL CAPS headlines with wide letter-spacing (tracking-[0.3em] or tracking-[0.5em]). Thin geometric sans-serif for body (Jost, Raleway at light weights). Gold-colored text for emphasis. Decorative initial caps or numbered sections.
- **Color — THE DECO PALETTE:**
  - Deep black: #0d0d0d
  - Midnight navy: #0a1628
  - Rich emerald: #1a5c3a
  - Gold/brass: #c9a84c
  - Champagne: #f0e6d0
  - Cream: #faf5eb
  - Ivory white: #f8f4ec
  - Copper accent: #b87333
  - Art Deco teal: #1a6b6a
  - Burgundy: #6b1a2a
  - Warm gray: #8a8078
- **Decorative elements:** Thin gold lines as borders and dividers. Geometric patterns: chevrons, sunbursts, fan shapes, stepped forms. These can be created with CSS borders and gradients or thin SVG lines. Small diamond or dot ornaments between sections.
- **Spacing:** Formal and structured. Consistent padding (py-20 md:py-32). Generous margins around text blocks. Symmetrical internal spacing. Everything aligned to center axis.

## What This Persona NEVER Does

- Casual or playful tone
- Asymmetric, off-center layouts
- Bright neon or pastel colors
- Rounded, blobby shapes
- Sans-serif headlines
- Dense, cluttered layouts
- Stock photography of modern offices
- Flat design without ornamentation
- Monospace or technical fonts
- Minimalist "empty" pages — Deco demands presence

## CSS Patterns

```
Background: bg-[#0d0d0d] or bg-[#0a1628] or bg-[#faf5eb]
Text: text-[#faf5eb] on dark, text-[#0d0d0d] on light
Gold accent: text-[#c9a84c] or border-[#c9a84c]
Decorative border: border border-[#c9a84c]/40 or border-t-2 border-[#c9a84c]
Spacing: py-20 md:py-32, px-8 md:px-16 text-center
Font heading: text-4xl md:text-6xl font-light uppercase tracking-[0.3em]
Font body: text-base font-light leading-relaxed tracking-wide
Radius: rounded-none (sharp, architectural edges)
Dividers: w-24 h-px bg-[#c9a84c] mx-auto my-8 (centered gold lines)
Buttons: border-2 border-[#c9a84c] text-[#c9a84c] px-10 py-4 uppercase tracking-[0.2em] text-sm hover:bg-[#c9a84c] hover:text-[#0d0d0d] transition-all
Cards: border border-[#c9a84c]/30 bg-[#0d0d0d] p-10 text-center
Layout: flex flex-col items-center text-center max-w-4xl mx-auto
```

## Reference Brands

The Ned (hotel), Claridge's, The Wolseley, Gatsby-era inspired brands, Hendrick's Gin, St. Germain, The Savoy, Bulgari Hotels, luxury real estate (Miami Beach Deco district), Roaring 20s event branding

## Best For

Luxury hospitality (hotels, restaurants, bars), spirits and wine brands, luxury real estate, upscale event venues, private clubs, fine jewelry, premium automotive (Bentley, Rolls-Royce style), high-end financial services, luxury travel, theater and performing arts
