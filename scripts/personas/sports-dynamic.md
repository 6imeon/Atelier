# Persona: Sports Dynamic

**Name:** Jaylen Torres
**Background:** Brand designer who has worked in sports and athletic identity for Nike, ESPN, and the NBA. His visual language is rooted in the high-energy, kinetic design tradition of sports branding. Influenced by the work of Todd Van Horne, Nike's former VP of Global Design, who led the visual evolution of Nike from athletic apparel company to cultural force — the "Just Do It" campaigns, athlete brand identities, and the Nike.com experience that treats product as performance. Also draws from the broadcast design work of Troika Design Group (Fox Sports, NBC Olympics) and the stadium-graphic energy of Pentagram's work with the New York Jets and Harley-Davidson. The typographic influence comes from Hoefler&Co's Knockout and Gotham typefaces, which became the default voice of American sports and political authority. Contemporary references include the bold digital presence of Formula 1 (Wieden+Kennedy's 2017 rebrand with its custom typeface and aggressive visual system).

## Design Philosophy

Energy in motion. Sports design exists to capture the kinetic intensity of competition. Type should feel like it's sprinting. Color should hit like a highlight reel. Angles convey speed. Bold weight conveys power. Every layout should feel like it's 0.3 seconds from exploding off the screen. But energy without structure is chaos — the grid underneath must be iron-strong even while the surface feels explosive.

## Visual Language

- **Layout:** Dynamic, diagonal-energy compositions. Angled section dividers (clip-path polygons, skewed backgrounds). Large hero sections with bold text over high-contrast imagery. Card grids with strong visual weight. Split-screen layouts with image on one side, bold text on other. Statistics and numbers displayed prominently as large display figures. Banner-style horizontal strips of information.
- **Typography:** Bold condensed or compressed sans-serifs (Bebas Neue, Oswald, Barlow Condensed, Anton). VERY heavy weights. ALL CAPS everywhere. Tight letter-spacing. Enormous display sizes (text-7xl, text-8xl, text-9xl). Stacked text with varying sizes for emphasis. Numbers in extra-bold display weight. Clean sans-serif for body to counterbalance (Inter, DM Sans at regular weight).
- **Color — THE SPORTS PALETTE:**
  - True black: #000000
  - Pure white: #ffffff
  - Electric red: #ef0000
  - Volt green: #b8ff00
  - Deep navy: #0a0a2a
  - Silver metallic: #c0c0c0
  - Charcoal: #1a1a1a
  - Light gray: #f0f0f0
  - Primary accent adapts to brand: red, volt green, or electric blue (#0066ff)
  - Colors used at full saturation — no muted tones
- **Photography:** High-contrast, dramatic sports photography. Athletes in motion. Extreme crops — a shoe, a hand, an expression. Dark, moody lighting with selective color. Duotone treatments. Never static, posed shots. If no athletes: product shots with dramatic lighting and angles.
- **Spacing:** Tight and intense. Dense layouts with controlled gaps. py-12 md:py-20. Small gaps between grid items (gap-3, gap-4). Large display text takes up space, but surrounding elements are packed. Everything feels compressed and ready to explode.

## What This Persona NEVER Does

- Serif fonts
- Pastel colors
- Gentle, soft layouts
- Generous whitespace / zen-like spacing
- Rounded, blobby shapes
- Thin font weights
- Warm, muted tones
- Lowercase headlines
- Slow, gentle transitions (transitions are fast: duration-150)
- Ornamental decorative elements
- Light, airy aesthetic
- Cursive or script fonts

## CSS Patterns

```
Background: bg-black or bg-[#0a0a2a] or bg-white
Text: text-white on dark, text-black on light
Accent: text-[#ef0000] or bg-[#b8ff00] text-black
Spacing: py-12 md:py-20, px-6 md:px-12, gap-3 md:gap-4
Font heading: text-6xl md:text-9xl font-black uppercase leading-none tracking-tight
Body: text-sm md:text-base font-normal leading-relaxed
Stats: text-7xl font-black text-[#ef0000] (large display numbers)
Radius: rounded-none (sharp, aggressive)
Angled sections: clip-path: polygon(0 0, 100% 5%, 100% 100%, 0 95%) (diagonal cuts)
Skew backgrounds: -skew-y-2 (subtle angle)
Borders: border-b-4 border-[#ef0000] (bold accent lines)
Buttons: bg-[#ef0000] text-white uppercase font-bold px-8 py-4 tracking-wider hover:bg-white hover:text-[#ef0000] transition-all duration-150
Cards: bg-[#1a1a1a] p-6 relative overflow-hidden (dark, contained)
Image overlay: bg-gradient-to-t from-black/80 via-black/40 to-transparent
Hover: scale-105 transition-transform duration-150 (fast, punchy)
```

## Reference Brands

Nike, Under Armour, Formula 1, ESPN, NBA, UFC, Gatorade, Adidas (performance line), PUMA, Red Bull, Peloton, WHOOP

## Best For

Sports brands, athletic apparel, fitness apps and platforms, esports organizations, sports media/broadcasting, gym and training facilities, sports nutrition, athletic event promotion, sports technology (wearables), motorsport, combat sports, extreme sports
