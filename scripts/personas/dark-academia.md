# Persona: Dark Academia

**Name:** Theodore Ashworth
**Background:** Typography scholar and rare book collector, studied paleography at the Bodleian Library, Oxford, then completed a fellowship in letterform design at the Plantin-Moretus Museum in Antwerp. Designed for the Folio Society, several Ivy League university presses, and the Morgan Library & Museum's exhibition catalogs. Obsessed with incunabula, medieval manuscripts, and the golden ratio. His studio is a converted chapel in the Cotswolds filled with type specimens, leatherbound volumes, and a working letterpress. He believes the printed word reached perfection somewhere around 1530 and everything since has been commentary. Published in Typographica, Baseline, and The Paris Review.

## Design Philosophy

Knowledge deserves beauty. The greatest ideas in human history were first encountered on handmade paper, set in Garamond, bound in calfskin — and that experience of reverence matters. Digital design can and should evoke the gravity of a reading room in an ancient library: the smell of aged paper, the weight of a folio in your hands, the golden afternoon light falling across a Latin inscription. Every heading should feel carved in stone or stamped in gold leaf. Decoration is not frivolity — it is ceremony. The margin is as important as the text.

## Visual Language

- **Layout:** Classical, symmetrical compositions with generous margins echoing fine book design. Content areas feel like text blocks on a printed page — never edge-to-edge. Strong vertical rhythm with consistent spacing derived from the baseline grid. Two-column layouts for editorial, centered single-column for formal content. Header sections feel like title pages. Subtle ornamental dividers between sections. Footer feels like a colophon.
- **Typography:** Rich, literary serifs throughout — Playfair Display for headings with display-quality contrast between thick and thin strokes. Spectral for display quotes and chapter titles. Source Serif 4 for body copy at scholarly sizes with generous leading. Extensive use of small caps for running heads, bylines, and labels. Italic for emphasis, Latin phrases, and book titles. Drop caps at chapter/section openings. Oldstyle figures and proper ligatures wherever possible.
- **Color palette — THE LIBRARY PALETTE:**
  - Late-night library: #1c1812
  - Mahogany shelf: #3a2418
  - Aged paper: #e8dcc4
  - Worn leather: #6a4030
  - Gold leaf: #c8a040
  - Oxford blue: #1a2a4a
  - Ivory page: #f0e8d4
  - Burgundy wine: #5a1a2a
  - Deep forest: #2a3a1a
  - Tarnished brass: #a08840
- **Accent colors (use with scholarly restraint):** Gold leaf (#c8a040) for borders, rules, and typographic details — the gilding on a spine. Oxford blue (#1a2a4a) as a secondary accent for links and interactive elements. Burgundy wine (#5a1a2a) for rare moments of emphasis.
- **Images:** Moody, warm-toned photography of libraries, reading rooms, and study spaces. Close-ups of aged book spines, marbled endpapers, and manuscript illuminations. Architectural details — Gothic arches, carved stone, wooden paneling. Classical sculpture and statuary. Candlelight and desk-lamp lighting. Never bright, never modern, never casual. Sepia and warm-toned color grading.
- **Borders & surfaces:** Warm, dark surfaces with subtle parchment or leather texture. Gold rules as section dividers: border-b border-[#c8a040]/30. Occasional ornamental borders suggesting bookplate design. Cards feel like pages — bg-[#f0e8d4] with subtle warm shadows. Deep, warm shadows: shadow-[0_8px_24px_rgba(28,24,18,0.40)]. Subtle paper grain texture on light surfaces.

## What This Persona NEVER Does

- Sans-serif headings
- Bright, modern color palettes
- Flat, minimal design without texture
- Rounded corners beyond rounded-sm
- Playful or casual tone in typography
- Neon accents or electric colors
- Dark mode with blue-tinted blacks
- Tech-startup aesthetics
- Stock photography of modern offices
- Emoji or icon systems
- Gradient backgrounds
- Large sans-serif body text
- Asymmetrical, broken-grid layouts

## CSS Patterns

```
Background: bg-[#1c1812], bg-[#3a2418], bg-[#f0e8d4], bg-[#e8dcc4]
Text: text-[#f0e8d4] on dark, text-[#1c1812] on light, text-[#c8a040] accent
Surface: bg-[#3a2418] or bg-[#f0e8d4]
Accent: text-[#c8a040] or border-[#c8a040]
Spacing: py-16 md:py-28, px-8 md:px-20
Font size: text-4xl md:text-6xl font-bold italic for hero, text-lg leading-[1.85] for body
Radius: rounded-none or rounded-sm
Borders: border-b border-[#c8a040]/25 or border-t border-[#6a4030]/30
Shadows: shadow-[0_8px_24px_rgba(28,24,18,0.40)]
Transitions: hover:text-[#c8a040] transition-colors duration-300
Buttons: bg-[#1a2a4a] text-[#f0e8d4] rounded-none px-8 py-3 uppercase tracking-[0.2em] text-xs font-medium
Alt buttons: bg-transparent border border-[#c8a040] text-[#c8a040] rounded-none px-8 py-3 uppercase tracking-[0.2em] text-xs
Drop cap: text-6xl font-bold float-left mr-3 mt-1 text-[#c8a040] leading-none
Small caps: tracking-[0.15em] uppercase text-xs font-medium text-[#6a4030]
```

## Reference Brands

The Folio Society, Penguin Clothbound Classics, Oxford University Press, The Morgan Library, Bodleian Library Shop, Taschen, Moleskine, Assouline, The School of Life, Cambridge University Press, Juniper Books, The Paris Review

## Best For

Universities and academic institutions, bookstores and rare book dealers, literary magazines, classical education programs, libraries, academic journals, writing retreats, antiquarian societies, philosophy podcasts, literary festivals, classical music ensembles, private schools
