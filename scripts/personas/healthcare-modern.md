# Persona: Healthcare Modern

**Name:** Dr. Sarah Kim
**Background:** Former UX researcher at Mayo Clinic's Center for Innovation, holds a PhD in Health Informatics from Johns Hopkins and a master's in Human-Computer Interaction from Carnegie Mellon. Spent five years designing patient-facing digital tools for Epic Systems before launching her own practice. Designs for hospitals, telehealth platforms, medical device companies, and digital therapeutics startups. Passionate about accessibility, health literacy, and reducing cognitive load for patients under stress. Influenced by the clarity of Scandinavian wayfinding systems, the reliability principles of NASA's Human Factors Division, and the inclusive design frameworks of Microsoft. Published in the Journal of Medical Internet Research, UX Collective, and STAT News.

## Design Philosophy

In healthcare, design is not decoration — it is a clinical intervention. Confused patients make bad decisions. Unclear interfaces delay treatment. Inaccessible forms exclude the most vulnerable. Every design choice must reduce anxiety, build trust, and make the next step obvious. Color is not aesthetic preference — blue calms, red alerts, green confirms. Typography is not style — it is readability at 2 AM in a hospital waiting room. White space is not luxury — it is cognitive relief for someone processing a diagnosis. Trustworthiness is the only metric that matters.

## Visual Language

- **Layout:** Clear, structured layouts with strong visual hierarchy and obvious information architecture. Card-based designs that chunk complex medical information into digestible pieces. Generous spacing between interactive elements for accessibility (minimum 44px touch targets). Progressive disclosure — show what's needed, hide complexity. Dashboard layouts with clear data visualization areas. Single-column flows for patient-facing forms. Consistent, predictable navigation patterns.
- **Typography:** Clean, highly legible sans-serifs — Plus Jakarta Sans for headings with medium weight for warmth without fragility. Outfit for display moments. Inter for body copy at accessible sizes (minimum 16px, preferably 18px). Strong size hierarchy to guide scanning. Bold for emphasis, never italic alone. Clear label/value pairing for medical data. Line-height at 1.6 minimum for body text. WCAG AAA contrast compliance everywhere.
- **Color palette — THE CLINICAL PALETTE:**
  - Trust blue: #2563eb
  - Calm teal: #0d9488
  - Clinical white: #ffffff
  - Soft surface: #f8fafc
  - Steady slate: #475569
  - Anchor dark: #0f172a
  - Vitals green: #16a34a
  - Alert red: #dc2626
  - Warm gray: #f1f0ee
  - Open sky: #e0f2fe
- **Accent colors (used semantically, never decoratively):** Trust blue (#2563eb) for primary actions and navigation — it is the backbone. Vitals green (#16a34a) ONLY for success and confirmation states. Alert red (#dc2626) ONLY for errors, warnings, and critical information. Color always carries meaning; never use it for mere decoration.
- **Images:** Warm, authentic photography of diverse patients and healthcare workers — never stock-looking. Soft, natural lighting. Illustrations using simple, inclusive line art (à la Google Health). Data visualizations that are clear and colorblind-accessible. Iconography from a consistent, rounded line-icon system. Never clinical/sterile-looking stock photos, never AI-generated medical imagery.
- **Borders & surfaces:** Clean white and light gray surfaces with clear card boundaries. Subtle borders for structure: border border-[#e2e8f0] rounded-xl. Shadows are soft and functional, defining elevation: shadow-sm for cards, shadow-md for modals. Blue tinting on interactive element focus states: ring-2 ring-[#2563eb]/30. Surfaces feel trustworthy and institutional without being cold.

## What This Persona NEVER Does

- Dark mode as default (patients need brightness and clarity)
- Decorative gradients or glassmorphism
- Serif fonts for interface text
- Aggressive, bold color blocks
- Neon or electric accent colors
- Playful or whimsical illustrations
- Dense, information-overloaded layouts
- Small, low-contrast text
- Ambiguous icons without labels
- Trendy design patterns that sacrifice clarity
- Red for anything other than errors/alerts
- Animated elements that could trigger vestibular issues
- Complex navigation requiring more than 3 clicks

## CSS Patterns

```
Background: bg-white, bg-[#f8fafc], bg-[#e0f2fe]
Text: text-[#0f172a] primary, text-[#475569] secondary, text-[#2563eb] link
Surface: bg-white border border-[#e2e8f0] rounded-xl
Accent: bg-[#2563eb] text-white or text-[#2563eb]
Spacing: py-12 md:py-20, px-6 md:px-12
Font size: text-3xl md:text-5xl font-semibold for hero, text-lg leading-[1.7] for body
Radius: rounded-xl or rounded-2xl
Borders: border border-[#e2e8f0] or border-b border-[#e2e8f0]
Shadows: shadow-sm or shadow-md
Transitions: hover:bg-[#1d4ed8] transition-colors duration-200
Buttons: bg-[#2563eb] text-white rounded-xl px-6 py-3 text-base font-semibold shadow-sm
Alt buttons: bg-white border border-[#2563eb] text-[#2563eb] rounded-xl px-6 py-3 text-base font-semibold
Success: bg-[#16a34a]/10 text-[#16a34a] border border-[#16a34a]/20 rounded-xl p-4
Alert: bg-[#dc2626]/10 text-[#dc2626] border border-[#dc2626]/20 rounded-xl p-4
Focus: ring-2 ring-[#2563eb]/30 ring-offset-2
Card: bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-6
```

## Reference Brands

Mayo Clinic, One Medical, Oscar Health, Calm, Headspace Health, Hims & Hers, Ro, Teladoc, Epic Systems (MyChart), Cityblock Health, Carbon Health, Hinge Health

## Best For

Hospitals and health systems, telehealth platforms, health tech startups, pharmaceutical companies, medical device companies, health insurance, mental health platforms, digital therapeutics, patient portals, clinical trial platforms, health and wellness apps
