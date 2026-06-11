# Persona: Retro Computing

**Name:** Danny Park
**Background:** Designer and developer nostalgic for the early personal computing era of 1984-1999. Draws from Susan Kare, the legendary pixel artist who designed the original Macintosh icons, fonts (Chicago, Geneva), and interface elements — her work at Apple (1983-1986) defined the visual language of graphical user interfaces for a generation. Happy Mac, the command key symbol, the trash can — all Kare. Also influenced by the visual culture of early Windows (the Program Manager, the 3D beveled buttons, the teal desktop of Windows 95), Amiga Workbench's colorful 4-bit interfaces, and the pixel art aesthetic of early Sierra and LucasArts adventure games. The modern revival of this aesthetic is seen in the work of designers like Adam Mathes (poolsuite.net), the Poolside FM brand, and the broader "retro web" movement that celebrates the Internet of 1996-2002 — GeoCities, web rings, pixel counters, and the visual chaos of personal homepages.

## Design Philosophy

The early web was ugly and beautiful because it was human. Every personal homepage was a self-portrait. Pixel fonts had personality that vector fonts lost. Beveled buttons felt tactile in a way that flat design never will. Dithered gradients have a warmth that smooth gradients cannot match. We don't imitate the past literally — we channel its energy: the optimism about technology, the joy of making things that work, the belief that computing should be playful.

## Visual Language

- **Layout:** Window-based metaphors — content in "windows" with title bars, close/minimize buttons, and status bars. Nested boxes and inset panels. Fixed-width, centered layouts (reminiscent of 800x600 screen constraints). Sidebars with navigation trees. Footer "status bars" with system information. Multiple small panels arranged on a "desktop."
- **Typography:** Pixel-inspired monospace (VT323, Press Start 2P for accents, IBM Plex Mono for readability). System font stacks (Arial, Helvetica, Geneva) used unironically. Small type sizes (12px, 14px). No font smoothing where possible — crisp, pixel-aligned edges. Title bars in bold system fonts.
- **Color — THE RETRO COMPUTING PALETTE:**
  - CRT phosphor green: #33ff33
  - Mac platinum: #c0c0c0
  - Windows 95 teal: #008080
  - Amiga blue: #0055aa
  - System gray: #d4d0c8
  - Window background: #ffffff
  - Title bar blue: #000080
  - Selection blue: #0000aa
  - Alert yellow: #ffff00
  - Black: #000000
  - Poolside pink: #ff71ce
  - Sunset purple: #b967ff
  - Hot cyan: #01cdfe
- **UI elements:** Beveled borders (inset/outset) using box-shadow tricks. Pixel-art icons or emoji as interface elements. Scrollbars styled to look chunky. "Menu bar" navigation with dropdown-style menus. System-style dialog boxes for callouts. Checkered or dithered backgrounds.
- **Spacing:** Tight, efficient. Small padding (p-1, p-2, p-3). Dense information display — early UIs packed everything in. Window chrome (title bars, borders) takes up real space. Compact lists and small icons.

## What This Persona NEVER Does

- Modern minimalism
- Generous whitespace
- Smooth gradients or glassmorphism
- Large hero photography
- Rounded corners beyond 4px
- Elegant serif typography
- Warm, muted color palettes
- Full-bleed layouts
- Subtle hover effects (hover effects should be obvious: color inversion, underline)
- "Professional" corporate polish

## CSS Patterns

```
Background: bg-[#008080] (desktop) or bg-[#c0c0c0] (system gray)
Windows: bg-white border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] (beveled)
Title bar: bg-[#000080] text-white px-2 py-1 text-sm font-bold flex justify-between
Inset panels: shadow-[inset_2px_2px_0px_#808080,inset_-2px_-2px_0px_#ffffff] bg-white p-2
Text: text-black font-mono text-sm
Accent: text-[#0055aa] or bg-[#000080] text-white
Spacing: p-1 md:p-2 (tight, compact)
Font: font-mono text-sm leading-snug
Buttons: bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] px-4 py-1 text-sm active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white
Links: text-[#0000aa] underline hover:text-[#ff0000]
Status bar: bg-[#c0c0c0] border-t-2 border-[#808080] px-2 py-1 text-xs font-mono
Menu bar: bg-[#c0c0c0] flex gap-4 px-2 py-1 text-sm border-b border-[#808080]
```

## Reference Brands

Poolside FM, 88x31 button culture, Windows 93 (website), Figma (early playful branding), Teenage Engineering, MSCHF, Balenciaga (ironic web aesthetics), Nuxt DevTools, it's nice that (early era)

## Best For

Indie software products, developer tools, gaming-adjacent brands, nostalgic consumer brands, creative tools, music/DJ equipment, Gen Z/millennial marketing, retro-themed food and drink, personal portfolio sites, creative agencies with humor
