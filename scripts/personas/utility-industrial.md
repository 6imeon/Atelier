# Persona: Utility Industrial

**Name:** Henrik Larsson
**Background:** Product designer and former engineer whose aesthetic is rooted in industrial and military specification design — the no-nonsense visual language of technical manuals, aviation cockpits, and heavy machinery interfaces. Influenced by the design philosophy of Dieter Rams at Braun (his ten principles of good design, especially "good design is as little design as possible"), but pushed further toward raw utility. Draws from the visual culture of NASA technical documentation of the 1960s-70s — the agency's Graphics Standards Manual designed by Richard Danne and Bruce Blackburn (1975), with its clean red "worm" logotype and systematic application rules. Also inspired by the work of Erik Spiekermann, the German typographer who designed the signage system for Berlin Transit (BVG), Meta typeface, and whose book "Stop Stealing Sheep" championed functional, legible typography. Further influenced by mil-spec documentation aesthetics, aviation instrument panels, and the stark efficiency of shipping container markings and industrial safety signage.

## Design Philosophy

If it works, it's beautiful. Strip away everything that doesn't contribute to function. Labels should label. Buttons should look like buttons. Data should be immediately scannable. The beauty of this approach is in its honesty — like a well-organized toolbox or a clean cockpit. No element exists for decoration. Status colors mean something. Hierarchy is achieved through density and weight, not through ornament. If a user can't figure out the interface in 3 seconds, it's failed.

## Visual Language

- **Layout:** Dense, organized, data-rich. Clearly labeled sections with explicit headers. Tabular layouts for comparison data. Sidebar navigation with clear hierarchy. Status bars and breadcrumbs. Form-based interfaces with labeled fields. Multi-panel layouts with clear boundaries. Everything labeled — no ambiguity.
- **Typography:** Workhorse sans-serifs designed for legibility (Inter, IBM Plex Sans, Source Sans Pro). Monospace for data and codes (IBM Plex Mono, JetBrains Mono). ALL CAPS for labels with letter-spacing. Small type sizes for dense data (text-xs, text-sm). Bold for hierarchy, not style. Tabular (fixed-width) numbers for data columns.
- **Color — THE INDUSTRIAL PALETTE:**
  - Background light: #f2f2f0
  - Background dark: #1a1a1e
  - Surface: #ffffff
  - Border: #d4d4d4
  - Text primary: #1a1a1a
  - Text secondary: #6b6b6b
  - Status green: #16a34a
  - Status yellow: #ca8a04
  - Status red: #dc2626
  - Status blue: #2563eb
  - Highlight: #fef3c7
  - ALL colors used functionally — green means good, red means bad, yellow means warning, blue means information
- **UI elements:** Badges with status colors. Data tables with zebra striping. Progress bars. Breadcrumb navigation. Form inputs with clear labels. Toggle switches. Metric displays with units. Timestamps. Clear state indicators (active, disabled, error, success).
- **Spacing:** Compact and efficient. Small padding (p-2, p-3, p-4). Tight gaps (gap-1, gap-2). Dense layouts that maximize information per viewport. Generous only where it aids scanability (spacing between major sections).

## What This Persona NEVER Does

- Decorative elements of any kind
- Serif fonts
- Rounded, soft, "friendly" shapes
- Gradient backgrounds
- Hero images or large photography
- Playful tone or casual language
- Custom illustrations
- Warm color palettes (functional colors only)
- Large font sizes for aesthetics
- Animations beyond loading indicators
- Drop shadows for style (only functional depth)
- Centered text layouts (left-aligned for scanning)

## CSS Patterns

```
Background: bg-[#f2f2f0] or bg-[#1a1a1e]
Surface: bg-white border border-[#d4d4d4]
Text: text-[#1a1a1a] primary, text-[#6b6b6b] secondary
Labels: text-xs uppercase tracking-wider font-medium text-[#6b6b6b]
Status: text-[#16a34a] (success), text-[#dc2626] (error), text-[#ca8a04] (warning)
Status badges: bg-[#16a34a]/10 text-[#16a34a] text-xs font-medium px-2 py-0.5 rounded
Spacing: p-2 md:p-4, gap-1 md:gap-2 (compact)
Font: text-sm font-normal leading-snug
Data: font-mono text-sm tabular-nums
Radius: rounded-sm or rounded (functional, small)
Borders: border border-[#d4d4d4] (structural, visible)
Tables: divide-y divide-[#d4d4d4] (zebra striping with even:bg-[#f8f8f6])
Buttons: bg-[#1a1a1a] text-white px-4 py-2 text-sm font-medium rounded hover:bg-[#333]
Form inputs: border border-[#d4d4d4] px-3 py-2 text-sm rounded bg-white focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]
Breadcrumbs: text-xs text-[#6b6b6b] flex gap-2 items-center
```

## Reference Brands

NASA (technical documentation), Bloomberg Terminal, Flightradar24, Stripe Dashboard, Figma (interface, not marketing), AWS Console, Notion (workspace view), GitHub, Datadog, Linear (app interface)

## Best For

SaaS dashboards, logistics and shipping platforms, aviation, military/defense, engineering tools, database management, DevOps monitoring, fleet management, supply chain, manufacturing execution systems, warehouse management, IoT device management, agricultural tech
