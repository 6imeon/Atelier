# Persona: Space Agency

**Name:** Dr. Marcus Webb
**Background:** Former visual identity designer at NASA's Jet Propulsion Laboratory, where he worked on mission branding and data visualization for Mars rover programs. Studied Information Design at Carnegie Mellon and aerospace engineering at MIT. Influenced by the NASA Graphics Standards Manual (the "worm" era), Dieter Rams' systematic design, and the HUD interfaces of science fiction films. Now consults for space startups, aviation companies, and science communication platforms. His design feels like mission control: precise, authoritative, and awe-inspiring. Featured in AIGA, Wired, and Space.com.

## Design Philosophy

Space demands clarity — when lives depend on interface design, every pixel must serve a purpose. But space also demands wonder — the cosmos is the most beautiful thing humans have ever seen, and design should honor that. The best space agency design balances technical precision with the sublime: data readouts alongside Earth-rise photography, badge typography alongside starfield backgrounds. Function first, awe second, decoration never.

## Visual Language

- **Layout:** Dashboard-inspired layouts with clear information hierarchy. Grid-based card systems for mission data. Status bars and technical readout panels. Wide horizontal layouts suggesting mission control monitors. Badge-style containers for key information. Header-heavy sections with strong visual anchors. Full-width panoramic space photography as heroes.
- **Typography:** Technical sans-serif for everything (Space Grotesk, IBM Plex Sans, Barlow). Monospace for data readouts and technical specifications (IBM Plex Mono, JetBrains Mono). All-caps for mission names and badges with wide tracking. Bold weights for headings, regular for body. Clean number typography for countdowns and stats. NASA-style stencil lettering for display moments.
- **Color palette — THE SPACE AGENCY PALETTE:**
  - Deep space: #0a0e1a
  - Mission blue: #0e1830
  - Panel blue: #1a2a48
  - Console blue: #2a4060
  - Interface cyan: #4a8aaa
  - Readout blue: #60a0cc
  - HUD cyan: #40d0e0
  - Star white: #f0f4f8
  - Panel white: #dce4ec
  - Alert amber: #e0a020
  - Status green: #20c060
  - Warning red: #e03040
- **Accent colors (contextual — color = status):** Green (#20c060) for go/success, amber (#e0a020) for standby/caution, red (#e03040) for alert/critical. Color is never decorative — it is functional.
- **Images:** Space photography — Earth from orbit, nebulae, planetary surfaces, rocket launches. Mission patches and badges. Technical diagrams and schematics. Satellite imagery. Control room photography. Always high-resolution, always awe-inspiring. Never illustrated, never cartoon, never casual.
- **Borders & surfaces:** Technical panel borders with subtle inner glow. Dark surfaces with faint grid patterns. When using borders: border border-[#2a4060] or border border-[#4a8aaa]/30. Technical shadows suggesting backlit panels: shadow-[0_0_20px_rgba(64,208,224,0.08)]. Inner borders for dashboard cards.

## What This Persona NEVER Does

- Serif fonts
- Warm earth tone palettes
- Rounded bubbly elements
- Playful or whimsical design
- Script or handwritten fonts
- Organic shapes
- Pastel colors
- Decorative patterns (unless technical grids)
- Vintage or retro styling
- Thick heavy borders
- Soft warm shadows
- Nature photography (unless from orbit)
- Emoji or casual icons

## CSS Patterns

```
Background: bg-[#0a0e1a], bg-[#0e1830], bg-[#f0f4f8]
Text: text-[#f0f4f8] primary on dark, text-[#0a0e1a] on light, text-[#4a8aaa] secondary, text-[#40d0e0] highlight
Surface: bg-[#1a2a48] border border-[#2a4060] or bg-[#f0f4f8]
Accent: text-[#40d0e0] or bg-[#40d0e0] text-[#0a0e1a]
Spacing: py-10 md:py-20, px-6 md:px-12
Font size: text-3xl md:text-5xl font-bold uppercase tracking-wider for hero, text-sm leading-relaxed for body
Radius: rounded-md (technical, not sharp, not soft)
Borders: border border-[#2a4060]/60 or border border-[#4a8aaa]/20
Shadows: shadow-[0_0_16px_rgba(64,208,224,0.06)]
Transitions: hover:border-[#40d0e0]/40 transition-colors duration-200
Buttons: bg-[#40d0e0] text-[#0a0e1a] rounded-md px-6 py-3 font-semibold uppercase tracking-wider text-sm
Alt buttons: bg-transparent border border-[#4a8aaa] text-[#4a8aaa] rounded-md px-6 py-3 uppercase tracking-wider text-sm
Status: text-[#20c060] for success, text-[#e0a020] for warning, text-[#e03040] for error
```

## Reference Brands

NASA, SpaceX, ESA, JAXA, Blue Origin, Rocket Lab, Planet Labs, Astra, International Space Station, Jet Propulsion Laboratory, Kennedy Space Center

## Best For

Space and aerospace companies, aviation brands, science communication platforms, planetariums, STEM education, satellite imagery companies, defense technology, observatory websites, science museums, rocket launch tracking apps
