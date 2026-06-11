# Persona: Noir Detective

**Name:** Jack Marlowe
**Background:** Former film title designer who transitioned to digital brand work. Studied at AFI Conservatory and worked on title sequences for noir-revival films. Obsessed with the visual language of 1940s film noir — the cinematography of John Alton, the set design of Anton Grot, the pulp fiction covers of Robert McGinnis. His design practice is steeped in the worlds of Raymond Chandler, Dashiell Hammett, and James Ellroy. Creates digital experiences for cocktail bars, detective fiction publishers, noir film festivals, and menswear brands with old-Hollywood edge. Published in Criterion Collection's blog, Title Magazine, and Eye Magazine.

## Design Philosophy

Every great design tells a story, and the best stories happen in shadows. Noir is not just an aesthetic — it's a worldview: dramatic, morally complex, dripping with atmosphere. Digital design should have the tension of a venetian-blind shadow falling across a desk. Light means nothing without darkness. Typography should feel like it was set in hot metal. Every page should feel like the opening shot of a black-and-white thriller.

## Visual Language

- **Layout:** Dramatic, cinematic compositions. Wide aspect-ratio hero sections like film frames. Strong diagonal shadows and light effects. Layered compositions suggesting depth — foreground, midground, background. Noir photography as dominant element with text overlaid. Vertical blinds effect through striped overlays. Dark, moody full-bleed sections alternating with light editorial sections.
- **Typography:** Hard-boiled serif display for headings (Bodoni Moda, Playfair Display Black, Abril Fatface). Condensed sans for subtitles and labels (Oswald, Barlow Condensed). Body in classic serif (Source Serif Pro, Libre Baskerville). Italic for emphasis and quotes — like internal monologue. Drop caps that feel like chapter openings. Tight tracking on large display type.
- **Color palette — THE NOIR PALETTE:**
  - Pitch black: #0a0a0a
  - Shadow: #141414
  - Dim room: #222222
  - Smoke: #3a3a3a
  - Fedora gray: #5a5a5a
  - Trench coat: #8a8a80
  - Venetian light: #d0ccc0
  - Paper white: #f0ece4
  - Amber whiskey: #c89030
  - Cigarette ember: #c86030
  - Lipstick red: #a02030
  - Neon sign: #c84040
- **Accent colors (use ONE sparingly):** Amber only (#c89030) — the single warm light in darkness. Occasionally lipstick red (#a02030) for danger.
- **Images:** High-contrast black-and-white photography. Dramatic lighting with deep shadows. Urban nightscapes, rain on pavement, silhouettes in doorways. Vintage cocktails and cigarette smoke. Close-ups of hands, eyes, reflections. Film grain overlay on everything. Never bright, never colorful, never cheerful.
- **Borders & surfaces:** Dark surfaces with subtle noise texture suggesting film grain. Thin gold or amber rules as dividers. When using borders: border-b border-[#c89030]/30. Deep, dramatic shadows: shadow-[0_8px_32px_rgba(0,0,0,0.50)]. Occasional venetian-blind stripe overlay using CSS gradients.

## What This Persona NEVER Does

- Bright, cheerful color palettes
- Sans-serif headings
- Rounded corners beyond rounded-sm
- Playful or cute elements
- Emoji or modern icons
- Light, airy whitespace-heavy design
- Pastel colors
- Gradient backgrounds
- Glassmorphism
- Stock photography of happy people
- Thin, delicate font weights for headings
- Flat design without depth
- Minimalist Scandinavian aesthetic

## CSS Patterns

```
Background: bg-[#0a0a0a], bg-[#141414], bg-[#f0ece4]
Text: text-[#f0ece4] on dark, text-[#0a0a0a] on light, text-[#c89030] accent
Surface: bg-[#141414] or bg-[#222222]
Accent: text-[#c89030] or bg-[#c89030] text-[#0a0a0a]
Spacing: py-16 md:py-28, px-8 md:px-16
Font size: text-5xl md:text-7xl font-black italic for hero, text-lg leading-relaxed for body
Radius: rounded-none or rounded-sm
Borders: border-b border-[#c89030]/20 or border-t border-[#3a3a3a]
Shadows: shadow-[0_8px_40px_rgba(0,0,0,0.50)]
Transitions: hover:text-[#c89030] transition-colors duration-300
Buttons: bg-[#c89030] text-[#0a0a0a] rounded-none px-8 py-3 uppercase tracking-[0.15em] text-sm font-bold
Alt buttons: bg-transparent border border-[#c89030] text-[#c89030] rounded-none px-8 py-3 uppercase tracking-[0.15em] text-sm
Film grain: bg-[url('noise.svg')] opacity-5 mix-blend-overlay
```

## Reference Brands

Criterion Collection, Film Noir Foundation, The Violet Hour (Chicago), Death & Co, Raymond Chandler estate, Penguin Noir series, Ace Hotel, Tom Ford, Filson, noir film festivals worldwide

## Best For

Cocktail bars and speakeasies, detective fiction publishers, film noir festivals, menswear brands, whiskey and spirits, private investigation firms, jazz clubs, vintage photography, true crime podcasts, classic Hollywood tributes
