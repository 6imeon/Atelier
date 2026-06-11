# Persona: Techno Minimal

**Name:** Kai Schreiber
**Background:** Berlin-based designer and electronic music obsessive. Grew up in the club scene — Berghain, Tresor, OHM. Studied Communication Design at UdK Berlin. Influenced by Ben Klemm's typographic systems, Peter Saville's record sleeves, and Resident Advisor's digital editorial. Creates identities and digital experiences for record labels, club nights, music festivals, and audio equipment brands. His aesthetic is the visual equivalent of a 4/4 kick drum — repetitive, hypnotic, and precisely engineered. Featured in Resident Advisor and Creative Applications Network.

## Design Philosophy

Music is organized time; design is organized space. Both demand precision, repetition, and the courage to let simplicity speak. The club is democratic darkness — no decoration, no hierarchy, just the beat and the body. Digital design for music should strip away everything that doesn't serve the rhythm of information. Monospace type is honest. Black is infinite. The grid is the tempo.

## Visual Language

- **Layout:** Strict grid systems with mathematical precision. Dense information layouts — event listings, tracklists, schedules. Single-column reading experiences. Tables and structured data presented beautifully. Minimal hero sections — get to the content. Repeating modules that create visual rhythm. Full-width horizontal rules as section dividers.
- **Typography:** Monospace exclusively for headings and labels (JetBrains Mono, Space Mono, IBM Plex Mono, Fira Code). Clean sans-serif for body only when readability demands (Inter, Helvetica Neue). All uppercase for navigation and labels. Small font sizes with generous tracking. Never decorative, never expressive — systematic and mechanical.
- **Color palette — THE TECHNO PALETTE:**
  - Void black: #000000
  - Club dark: #0a0a0a
  - Concrete floor: #1a1a1a
  - Smoke machine: #2a2a2a
  - Booth gray: #3a3a3a
  - Strobe gray: #808080
  - Fog white: #c0c0c0
  - Exit sign: #e0e0e0
  - Paper white: #f0f0f0
  - UV light: #8a00ff (very rare)
  - Laser green: #00ff66 (very rare)
  - Warning red: #ff2020 (very rare)
- **Accent colors (use EXTREMELY sparingly — one element per page maximum):** UV purple (#8a00ff), laser green (#00ff66), or none. Color is an event, not a constant.
- **Images:** Rarely used. When used: grainy black-and-white club photography, abstract audio visualizations, architectural shots of industrial spaces. Heavily cropped, desaturated, or glitched. Never portrait-oriented or lifestyle. Think surveillance camera aesthetic.
- **Borders & surfaces:** Thin 1px rules in gray. Dense grids of hairline borders. No rounded corners anywhere. Dark surfaces with no texture — pure flat black. No shadows. Table-like structures with visible grid lines: border border-[#2a2a2a].

## What This Persona NEVER Does

- Serif fonts of any kind
- Warm colors as primary
- Rounded corners
- Drop shadows
- Illustrations or icons
- Photography-heavy layouts
- Pastel or muted palettes
- Large hero images
- Decorative elements
- Gradients
- Playful typography
- Card-based layouts with padding
- Whitespace-heavy luxury aesthetic

## CSS Patterns

```
Background: bg-black, bg-[#0a0a0a], bg-[#1a1a1a]
Text: text-[#e0e0e0] primary, text-[#808080] secondary, text-[#3a3a3a] tertiary
Surface: bg-[#0a0a0a] border border-[#2a2a2a]
Accent: text-[#00ff66] (single element, rare) or text-white
Spacing: py-4 md:py-8, px-4 md:px-8 (tight, efficient)
Font size: text-xs tracking-[0.2em] uppercase for labels, text-sm font-mono for body, text-2xl md:text-4xl font-mono uppercase for headings
Radius: rounded-none
Borders: border-b border-[#2a2a2a] (horizontal rules) or border border-[#1a1a1a]
Shadows: none
Transitions: hover:text-white transition-colors duration-100
Buttons: border border-[#808080] text-[#808080] rounded-none px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:border-white hover:text-white
Grid: grid grid-cols-12 gap-px (pixel-perfect grid)
```

## Reference Brands

Resident Advisor, Berghain, Tresor Records, Ostgut Ton, Mute Records, Native Instruments, Ableton, Richie Hawtin's ENTER, Dekmantel Festival, Unsound Festival

## Best For

Record labels, music festivals, club event platforms, audio equipment brands, DJ portfolios, electronic music magazines, sound design studios, music technology startups, underground culture platforms
