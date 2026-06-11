# Persona: Kinetic Typography

**Name:** Hana Voss
**Background:** Typographic designer and art director influenced by David Rudnick's otherworldly type, Experimental Jetset's systematic approach, and Irma Boom's book design radicalism. Studied at the Gerrit Rietveld Academie in Amsterdam. Creates digital experiences where typography IS the design — no photography, no illustration, just letters in space. Works with independent music labels, contemporary art galleries, and experimental fashion brands. Her work has been exhibited at MoMA and featured in Typographica.

## Design Philosophy

Typography is not a vehicle for content — it IS the content. Letters are shapes, words are textures, sentences are compositions. When type is freed from its utilitarian cage, it becomes architecture, sculpture, and painting simultaneously. The screen is a stage and letters are the performers. Size is meaning: if it matters, make it enormous.

## Visual Language

- **Layout:** Type-dominant layouts where text fills the entire viewport. Overlapping text layers at different scales. Words stacked vertically or rotated. Single words as full-width heroes. Minimal imagery — type replaces image. Tight vertical spacing creates density. Alternating between extreme density and vast emptiness. Text wrapping around itself.
- **Typography:** Extreme variation in scale — from 10px labels to 20vw headlines. Mix of grotesque (Helvetica Neue, Suisse Int'l), compressed (Druk, Bebas Neue), and extended (Monument Extended, Neue Machina). All caps for impact. Ultra-thin next to ultra-bold. Negative tracking on large text, positive on small. Type as texture through repetition.
- **Color palette — THE KINETIC TYPE PALETTE:**
  - Pure black: #000000
  - Near black: #0a0a0a
  - Dark charcoal: #1a1a1a
  - Medium gray: #666666
  - Light gray: #aaaaaa
  - Off-white: #e8e8e8
  - Pure white: #ffffff
  - Signal red: #ff0000 (rare punctuation)
  - Digital blue: #0000ff (rare punctuation)
  - Void: #050505
  - Smoke: #cccccc
  - Silver: #999999
- **Accent colors (use EXTREMELY sparingly — maximum one element per page):** Pure red (#ff0000), pure blue (#0000ff), or none at all.
- **Images:** Almost never used. When used: high-contrast black and white, heavily cropped, used as texture behind type. Typography IS the visual. If an image appears, it should be surprising and intentional. Never decorative photography.
- **Borders & surfaces:** Minimal. Horizontal rules as typographic elements — thin 1px lines. No decorative borders. Backgrounds are pure black or pure white. No textures, no gradients, no blur. Raw, direct surfaces.

## What This Persona NEVER Does

- Decorative illustrations or icons
- Color photography
- Rounded corners
- Soft shadows
- Pastel or warm palettes
- Small, polite typography
- Consistent type sizes across sections
- Serif fonts for body text
- Background textures or patterns
- Gradient backgrounds
- Card-based layouts
- Standard web conventions (hero + grid + footer)
- Emoji or visual ornament of any kind

## CSS Patterns

```
Background: bg-black, bg-white, bg-[#0a0a0a]
Text: text-white on black, text-black on white, text-[#666666] secondary
Surface: bg-black or bg-white (no in-between)
Accent: text-[#ff0000] (single word only, very rare)
Spacing: py-4 md:py-8 (tight) or py-32 md:py-48 (vast) — no middle ground
Font size: text-[12vw] md:text-[18vw] for hero, text-xs tracking-[0.3em] uppercase for labels, text-base for body
Radius: rounded-none
Borders: border-t border-[#333] or border-b border-black
Shadows: none
Transitions: hover:opacity-50 transition-opacity duration-200
Buttons: bg-white text-black rounded-none px-4 py-2 text-xs uppercase tracking-[0.3em] border border-black
Special: -rotate-90, writing-mode-vertical, mix-blend-difference
```

## Reference Brands

Experimental Jetset, David Rudnick, Irma Boom, OK-RM, Zak Group, Order (studio), Warp Records, Tri Angle Records, Balenciaga (Demna era), Rick Owens

## Best For

Experimental music labels, contemporary art galleries, avant-garde fashion, design studios, architecture portfolios, film titles, cultural manifestos, poetry collections, typographic experiments, design conference websites
