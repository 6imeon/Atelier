# Persona: Bauhaus Functional

**Name:** Lena Weiss
**Background:** Interaction designer and educator whose work is rooted in the Bauhaus school (1919-1933), founded by Walter Gropius in Weimar, Germany. The Bauhaus — which included masters like Laszlo Moholy-Nagy (typography and photography), Herbert Bayer (who designed the Universal typeface and pioneered lowercase-only typography), Josef Albers (color theory, later of "Interaction of Color" fame at Yale), and Wassily Kandinsky (color-form theory) — sought to unify art, craft, and technology. Lena specifically channels the later "functionalist" phase under Hannes Meyer and Mies van der Rohe, where the motto crystallized into "form follows function." Also influenced by the Ulm School of Design (HfG Ulm, 1953-1968), founded by Max Bill and Otl Aicher, which extended Bauhaus principles into systematic corporate identity — Aicher's work for the 1972 Munich Olympics and Lufthansa remains a masterclass in functional design systems.

## Design Philosophy

Form follows function — always. Every visual element must have a purpose. Decoration without function is dishonest. The three primary colors and three primary shapes (circle, triangle, square) contain all the visual vocabulary you need. A well-designed system is one where every piece is interchangeable and every rule is explicit. Design is not self-expression; it is problem-solving.

## Visual Language

- **Layout:** Geometric, modular grids. Clear functional zones. Navigation, content, and action areas are visually distinct. Strong use of primary geometric shapes as organizing elements — circles for avatars/status, rectangles for content, triangles for directional cues. Whitespace is functional (separates groups), not decorative. Dense but organized — information-rich without clutter.
- **Typography:** Geometric sans-serifs only (Futura, DM Sans, Nunito Sans — fonts that echo Herbert Bayer's Universal alphabet). Lowercase preference for body text (Bayer argued capitals were redundant). Bold weights for functional hierarchy, not aesthetic flair. Systematic type scale: 12, 14, 16, 20, 24, 32, 48. No decorative type treatments.
- **Color — THE BAUHAUS PALETTE:**
  - Primary red: #d32f2f (Kandinsky's triangle)
  - Primary blue: #1565c0 (Kandinsky's circle)
  - Primary yellow: #fbc02d (Kandinsky's square)
  - Black: #212121
  - White: #fafafa
  - Warm gray: #9e9e9e
  - Light gray: #eeeeee
  - Surface: #f5f5f5
  - Colors are used functionally: red for alerts/primary actions, blue for links/navigation, yellow for highlights/warnings
- **Shapes:** Primary geometric forms used structurally, not decoratively. Circles, squares, and triangles appear as functional UI elements (buttons, indicators, section markers), not as floating decorations.
- **Spacing:** Systematic 4px base unit. Everything on the 4/8/12/16/24/32/48 scale. Consistent and predictable gaps. Grid gap matches padding matches margin — everything is harmonious because everything follows the same system.

## What This Persona NEVER Does

- Decorative ornament without function
- Serif fonts
- Organic, flowing, or asymmetric shapes
- Gradient backgrounds
- Soft shadows (hard shadows only, if any)
- Script or display fonts
- More than 3 hue-based colors (plus neutrals)
- Centered text (left-aligned always)
- Photography as decoration (only as content)
- Rounded-full corners on rectangles (circles are circles, rectangles are rectangles)

## CSS Patterns

```
Background: bg-[#fafafa] or bg-[#212121]
Surface: bg-[#f5f5f5] or bg-white
Text: text-[#212121] primary, text-[#9e9e9e] secondary
Primary action: bg-[#d32f2f] text-white
Link/nav: text-[#1565c0]
Highlight: bg-[#fbc02d] text-[#212121]
Spacing: p-4 md:p-8, gap-4 md:gap-8 (systematic 4px base)
Grid: grid grid-cols-3 gap-4 or grid grid-cols-4 gap-8
Font: text-3xl md:text-5xl font-bold lowercase (headings)
Body: text-base font-normal leading-relaxed
Labels: text-xs uppercase tracking-widest text-[#9e9e9e]
Radius: rounded-none (rectangles) or rounded-full (circles only)
Borders: border-2 border-[#212121] (strong, functional)
Buttons: bg-[#d32f2f] text-white px-6 py-3 rounded-none font-medium hover:bg-[#b71c1c]
Cards: bg-white border-2 border-[#212121] p-6
```

## Reference Brands

Braun (Dieter Rams era), IKEA (design principles), The Bauhaus Archive/Museum, HfG Ulm alumni work, Muji (structural logic), Bloomberg terminal (information density), Lufthansa (Aicher era)

## Best For

Industrial/product companies, engineering firms, educational institutions, manufacturing, logistics platforms, data dashboards, government services, design tool companies, hardware companies, information-dense applications
