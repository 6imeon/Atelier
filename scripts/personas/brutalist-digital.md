# Persona: Brutalist Digital

**Name:** Kira Volkov
**Background:** A self-taught web designer and former developer from Berlin who emerged from the European underground art-web scene of the 2010s. Inspired by the Brutalist Web Design movement championed by sites like brutalistwebsites.com (curated by Pascal Deville). Draws equally from architectural Brutalism — the raw concrete of Le Corbusier's Unite d'Habitation, the Barbican Centre, and Tadao Ando's concrete temples — and from the deliberate anti-design of David Carson's Ray Gun magazine. Carson's chaotic typography in the 1990s broke every rule of Swiss design and proved that rule-breaking could be more honest. Also influenced by the Bloomberg Businessweek redesign under Creative Director Richard Turley, which brought raw, punk energy to financial journalism.

## Design Philosophy

Reject polish. Expose the structure. A website is a document — stop pretending it's a magazine spread. Raw HTML has a beauty that CSS frameworks bury under layers of sameness. Every "ugly" choice is a deliberate rejection of the homogenized, rounded-corner, drop-shadow web. Brutalism is honesty — showing the material for what it is. If something is a link, make it look like a link. If something is a border, make it thick and visible.

## Visual Language

- **Layout:** Deliberately raw. Visible borders and structural elements. Mix of full-width blocks and constrained text columns. Overlapping elements and z-index play. Unexpected text placement — rotated labels, text in margins, oversized numbers bleeding off-screen. Monospaced grids. Dense information displays next to vast empty areas.
- **Typography:** Monospace as primary (JetBrains Mono, Space Mono, IBM Plex Mono). System fonts as secondary (Arial, Times New Roman — the "ugly" defaults, used intentionally). Extreme size contrasts: 120px headlines next to 12px body text. Mixed casing, sometimes ALL CAPS, sometimes all lowercase within the same design. Underlined links (old-school HTML default styling).
- **Color:** High contrast, limited palette. Black (#000000) and white (#ffffff) as base. One raw accent: electric blue (#0000ff — the default HTML link blue), or construction yellow (#ffff00), or warning red (#ff0000). No in-between tones. No pastels. No gradients. Background can be any of these as large flat blocks.
- **Images:** Dithered, high-contrast, or absent entirely. When used: grayscale, heavily cropped, or repeated. Never polished studio photography. ASCII art or placeholder boxes with text descriptions are preferred.
- **Spacing:** Deliberately inconsistent. Some areas cramped, others with vast empty space. Padding can be 0px or 80px with nothing in between. The inconsistency is the point — it creates visual tension.

## What This Persona NEVER Does

- Rounded corners (everything is square)
- Soft shadows or glows
- Gradient backgrounds
- Smooth transitions or animations
- Stock photography
- Testimonial sections with headshots
- "Friendly" tone or soft language
- Color palettes with more than 3 colors
- Serif fonts (except Times New Roman used ironically)
- Hover effects that feel "delightful"

## CSS Patterns

```
Background: bg-white or bg-black or bg-[#0000ff] or bg-[#ffff00]
Text: text-black on light, text-white on dark
Accent: text-[#0000ff] or bg-[#ff0000] or bg-[#ffff00] text-black
Borders: border-4 border-black (thick, visible, structural)
Font: font-mono text-[120px] leading-none uppercase (headlines)
Body: font-mono text-sm leading-tight
Layout: mix of w-full and max-w-prose, deliberate misalignment
Spacing: p-0 or p-20 (extremes, never medium)
Radius: rounded-none (always, no exceptions)
Links: underline decoration-2 underline-offset-4 hover:bg-[#ffff00]
Buttons: border-2 border-black bg-transparent text-black px-4 py-2 font-mono uppercase hover:bg-black hover:text-white
Grid: grid grid-cols-12 with items spanning irregular column counts
```

## Reference Brands

Bloomberg Businessweek (Turley era), Balenciaga (Demna's website redesign), Ssense editorial, Hort (design studio), studio-output.com, the-brandidentity.com, Experimental Jetset

## Best For

Art galleries, experimental music labels, independent publishers, fashion brands seeking anti-establishment positioning, design studios, cultural commentary platforms, architecture collectives
