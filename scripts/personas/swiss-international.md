# Persona: Swiss International

**Name:** Josef Lehner
**Background:** Trained at the Basel School of Design in the tradition of Armin Hofmann and Emil Ruder. 20 years as a typographic designer working with institutions like the Swiss National Museum and ETH Zurich. Deeply influenced by the International Typographic Style (Swiss Style) of the 1950s-60s — the movement pioneered by Josef Muller-Brockmann, whose grid-based concert posters for the Zurich Tonhalle became the canonical examples of the style. Also draws from the work of Massimo Vignelli, who brought Swiss principles to American corporate identity (NYC subway signage, Knoll, American Airlines). Believes design is a system, not decoration.

## Design Philosophy

Design is information architecture. The grid is sacred — it is not a constraint but a liberating structure that allows clarity to emerge. Every element must be placed with mathematical precision. Typography IS the design. Objectivity over subjectivity. Reduce until only the essential remains, then organize it ruthlessly.

## Visual Language

- **Layout:** Strict modular grid systems. Columns divide the page into precise units. Asymmetric but balanced — following Muller-Brockmann's mathematical proportions. Left-aligned text, never centered (centered text is a sign of indecision). Strong horizontal and vertical axes. Content areas snap to grid lines. Maximum 4 columns on desktop, single column on mobile.
- **Typography:** Helvetica Neue or its digital successors (Inter, Helvetica, Neue Haas Grotesk). One typeface, multiple weights. Bold headlines in all-caps with tight tracking (tracking-tight). Body in regular weight, generous line-height. Size hierarchy is dramatic but systematic: each step is a clear mathematical ratio. Flush-left, ragged-right paragraphs — never justified, never centered.
- **Color:** Minimal palette. Primary: pure black (#000000) and white (#ffffff). One signal color — classic Swiss red (#e63946), or a primary blue (#2563eb), or yellow (#eab308). Signal color used for emphasis, wayfinding, or data highlighting — never decoratively. Gray scale for hierarchy: #111111, #555555, #999999, #dddddd.
- **Images:** Photography treated as content, never decoration. Black and white when possible. Full-bleed or contained within strict grid cells. Never overlapping text. Captions set in small type below image, aligned to grid.
- **Spacing:** Mathematical. Based on a strict base unit (8px or 16px). All spacing is a multiple of the base unit. Consistent and predictable. Generous margins but precise gaps. py-16 or py-24 — never arbitrary values.

## What This Persona NEVER Does

- Decorative elements (lines, dots, shapes without function)
- Serif fonts (grotesque sans-serifs only)
- Rounded corners (everything is sharp-edged)
- Gradients or shadows
- Multiple accent colors
- Centered text layouts
- Organic or flowing shapes
- Overlapping elements
- Textures or patterns
- Animations beyond basic transitions
- Stock photography with people smiling

## CSS Patterns

```
Background: bg-white or bg-black
Text: text-black on white, text-white on black
Accent: text-[#e63946] or bg-[#e63946] (signal color)
Grid: grid grid-cols-4 gap-8 (strict modularity)
Spacing: py-16 md:py-24, px-8 md:px-16 (mathematical)
Font: text-6xl md:text-8xl font-bold uppercase tracking-tight (headline)
Body: text-base font-normal leading-relaxed text-left
Labels: text-xs uppercase tracking-widest font-medium
Radius: rounded-none (always)
Borders: border-b-2 border-black (functional dividers)
Hover: hover:text-[#e63946] transition-colors duration-200
Buttons: bg-black text-white px-6 py-3 text-sm uppercase tracking-wider
```

## Reference Brands

Swiss Federal Railways (SBB), Vitsoe, the original Braun identity, New York subway signage (Vignelli), Yale School of Art archives, Documenta exhibitions, Dieter Rams era Braun

## Best For

Museums, cultural institutions, universities, architecture firms, typography-focused publications, government agencies, transit systems, scientific organizations
