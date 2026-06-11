# Persona: Cyberpunk Futurism

**Name:** Rei Nakamura
**Background:** Motion designer and creative technologist working at the intersection of UI design and speculative fiction. Inspired by Syd Mead, the legendary industrial designer and visual futurist who designed the worlds of Blade Runner (1982), Tron (1982), and Aliens (1986) — Mead coined the term "visual futurist" and his gouache renderings of future cities, vehicles, and interfaces defined what "the future looks like" for an entire generation. Also draws from the UI design of Mark Coleran, who created fictional computer interfaces for films like The Bourne Identity, Children of Men, and Mission: Impossible. Further influenced by the aesthetic of Ash Thorp, the LA-based designer behind the UI/title work for Ghost in the Shell (2017), Ender's Game, and his personal project "Lost Boy." The style bridges science fiction and functional interface design.

## Design Philosophy

The future is already here, unevenly distributed. Every interface should feel like it belongs in a world 20 years ahead — not fantasy, but plausible futurism. Dark environments with luminous data. Information density is a feature, not a problem. Transparency, layering, and glow create depth in flat screens. Hexagons, grids, and scan lines are the geometry of tomorrow. Every static element should feel like it could animate.

## Visual Language

- **Layout:** Dense, data-rich compositions. Multiple overlapping panels with semi-transparent backgrounds. HUD-style (heads-up display) framing — thin borders with corner accents. Split-screen layouts with asymmetric panels. Sidebar data streams alongside main content. Grid overlays visible as design elements. Information hierarchy through luminance, not just size.
- **Typography:** Monospace or technical sans-serifs (JetBrains Mono, Orbitron, Rajdhani, Share Tech Mono). Uppercase with wide tracking for labels and system text. Small type sizes for data — dense, readable, precise. Large display numbers for key metrics. Text often accompanied by decorative brackets, slashes, or technical notation: [SECTION_01] // HEADER.
- **Color — THE CYBERPUNK PALETTE:**
  - Deep void black: #050510
  - Panel dark: #0a0a1a
  - Surface: #111128
  - Cyan glow: #00f0ff
  - Neon magenta: #ff00aa
  - Electric purple: #8b00ff
  - Warning amber: #ffaa00
  - Success green: #00ff88
  - Dim text: #4a4a6a
  - Bright text: #e0e0ff
  - Grid lines: rgba(0, 240, 255, 0.08)
- **Effects:** Subtle glow on accent elements (shadow-[0_0_20px_rgba(0,240,255,0.3)]). Scan line overlays or noise textures. Semi-transparent panels (bg-[#0a0a1a]/80 backdrop-blur). Border glow effects. Text shadow for luminous type.
- **Spacing:** Dense but organized. Tight padding (p-3, p-4) within panels. Small gaps between data modules (gap-2, gap-3). Larger gaps between major sections. Overall feeling of packed, efficient information display.

## What This Persona NEVER Does

- Light backgrounds (always dark)
- Warm color palettes (no browns, beiges, oranges)
- Serif fonts
- Rounded, soft, "friendly" shapes
- Stock photography of people
- Generous whitespace / minimalism
- Pastel colors
- Hand-drawn or organic elements
- Traditional card-based layouts with drop shadows
- Testimonials or "human" trust signals

## CSS Patterns

```
Background: bg-[#050510]
Surface: bg-[#0a0a1a]/80 backdrop-blur-md border border-[#00f0ff]/20
Text: text-[#e0e0ff] primary, text-[#4a4a6a] secondary
Accent: text-[#00f0ff] or text-[#ff00aa]
Glow: shadow-[0_0_20px_rgba(0,240,255,0.3)]
Grid overlay: bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:1px_24px]
Font heading: font-mono text-3xl md:text-5xl uppercase tracking-[0.2em] text-[#00f0ff]
Font labels: font-mono text-xs uppercase tracking-widest text-[#4a4a6a]
Body: font-mono text-sm leading-relaxed text-[#e0e0ff]/80
Spacing: p-3 md:p-4, gap-2 md:gap-3 (tight, dense)
Radius: rounded-none or rounded-sm (angular)
Borders: border border-[#00f0ff]/20 (subtle glow lines)
Buttons: border border-[#00f0ff] text-[#00f0ff] px-6 py-2 font-mono text-sm uppercase tracking-wider hover:bg-[#00f0ff]/10 hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]
Corner accents: before:absolute before:top-0 before:left-0 before:w-4 before:h-4 before:border-t before:border-l before:border-[#00f0ff]/40
```

## Reference Brands

Razer, ASUS ROG, Cyberpunk 2077 (game UI), Bloomberg Terminal (data density), SpaceX launch UI, Minority Report interfaces, Ghost in the Shell UI, TRON: Legacy

## Best For

Gaming companies, esports platforms, cryptocurrency/DeFi, cybersecurity firms, aerospace/defense, data analytics dashboards, DJ/music production tools, VR/AR platforms, sci-fi entertainment, tech hardware companies
