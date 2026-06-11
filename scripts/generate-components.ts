/**
 * Generate high-quality AI components inspired by premium sites.
 *
 * Usage:
 *   npx tsx scripts/generate-components.ts
 *
 * Requires OPENROUTER_API_KEY in .env and crawl4ai running for the API server.
 * Appends to existing components.json.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const OUTPUT_PATH = resolve(__dirname, "components.json");

// Load env
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (!process.env[trimmed.slice(0, eq).trim()])
      process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error("Missing OPENROUTER_API_KEY"); process.exit(1); }

// Premium component specs — inspired by Stripe, Linear, Vercel, Notion, Arc
const COMPONENT_SPECS = [
  // Heroes
  { category: "hero", name: "Hero — Gradient with floating cards", description: "Full-width hero with gradient background, large headline, subtitle, CTA buttons, and floating product preview cards. Inspired by Stripe.", style: "Modern SaaS, dark gradient bg (#0a0a1a to #1a1a3a), accent blue/purple, floating cards with glass-morphism" },
  { category: "hero", name: "Hero — Split with video placeholder", description: "Two-column hero: left side has headline, description, email signup form; right side has a rounded video/product preview with play button overlay.", style: "Clean enterprise, white bg, dark text, blue accent, subtle shadows" },
  { category: "hero", name: "Hero — Centered minimal with stats", description: "Centered headline with animated gradient text, subtitle, two CTA buttons, and a row of 4 stats/metrics below (Users, Countries, Uptime, Rating).", style: "Minimal dark theme, gradient text effect, monospace numbers for stats" },
  { category: "hero", name: "Hero — App showcase with browser frame", description: "Hero section with a browser-frame mockup showing an app screenshot. Headline above, feature pills/badges, and CTA. Inspired by Linear.", style: "Dark bg, green/teal accents, browser frame with rounded corners and dot controls" },

  // Features
  { category: "features", name: "Features — Bento grid", description: "Asymmetric bento-box grid layout (2 large + 4 small cards) showing features with icons, titles, and descriptions. Each card has a subtle gradient background.", style: "Dark cards on dark bg, colored icon accents per card, rounded-2xl, gap-4" },
  { category: "features", name: "Features — Icon cards with hover", description: "3-column grid of feature cards. Each has an icon in a colored circle, title, description, and 'Learn more' link. Cards lift on hover with shadow.", style: "White cards, light gray bg, colored icons (blue/green/purple), hover:shadow-xl transition" },
  { category: "features", name: "Features — Alternating image sections", description: "3 feature sections that alternate image left/right. Each has a small label, large heading, paragraph, and bullet list of benefits.", style: "Clean white bg, picsum placeholder images, alternating layout, subtle section dividers" },
  { category: "features", name: "Features — Comparison table", description: "Feature comparison between two plans or products. Clean table with checkmarks, X marks, and highlighted recommended column.", style: "Minimal table design, green checkmarks, gray X marks, highlighted column with accent border" },

  // Testimonials
  { category: "testimonials", name: "Testimonials — Masonry cards", description: "Masonry-style grid of testimonial cards with varying heights. Each has a quote, author name, role, company, and small avatar. Star ratings.", style: "Mixed card sizes, subtle borders, avatar circles, 5-star ratings in amber" },
  { category: "testimonials", name: "Testimonials — Large featured quote", description: "Single large testimonial with oversized quote marks, italic text, author photo, name, title. Flanked by company logos below.", style: "Centered, large serif italic quote, circular author photo, logo cloud below in grayscale" },
  { category: "testimonials", name: "Testimonials — Social proof wall", description: "Grid of short tweet-style testimonials with author avatar, name, handle, and tweet text. Mixed card backgrounds.", style: "Twitter/X card style, rounded-xl, some cards with colored backgrounds, @handles in gray" },

  // Pricing
  { category: "pricing", name: "Pricing — Three-tier with popular badge", description: "Three pricing cards: Starter, Pro (popular/highlighted), Enterprise. Each with price, billing toggle, feature list with checkmarks, CTA button.", style: "Center card elevated with accent border and 'Most Popular' badge, monthly/yearly toggle, green checkmarks" },
  { category: "pricing", name: "Pricing — Horizontal comparison", description: "Horizontal pricing layout with feature rows and plan columns. Sticky header row. Feature groups with collapsible sections.", style: "Clean table layout, alternating row backgrounds, sticky header, accent for recommended plan" },

  // CTA
  { category: "cta", name: "CTA — Full-width gradient banner", description: "Full-width section with gradient background, large heading, subtitle, and two buttons (primary + secondary). Decorative dots/circles pattern.", style: "Vibrant gradient (blue to purple), white text, rounded buttons, abstract decorative elements" },
  { category: "cta", name: "CTA — Newsletter with social proof", description: "Email signup section with input + button, 'Join 10,000+ subscribers' text, and row of small avatar bubbles showing recent signups.", style: "Dark bg, email input with inline button, overlapping avatar circles, subtle glow on input focus" },

  // Stats
  { category: "stats", name: "Stats — Animated counters row", description: "Horizontal row of 4 large statistics with labels. Numbers with + or % suffixes. Clean dividers between each stat.", style: "Large bold numbers (48px+), subtle gray labels below, vertical dividers, monospace/tabular numbers" },
  { category: "stats", name: "Stats — Cards with icons and trend arrows", description: "Grid of 4 stat cards each showing an icon, metric name, large number, and trend indicator (up/down arrow with percentage).", style: "White cards with subtle shadow, colored trend arrows (green up, red down), small sparkline charts" },

  // Gallery
  { category: "gallery", name: "Gallery — Masonry image grid", description: "Responsive masonry photo gallery with varying image sizes. Hover overlay shows title and category tag. Lightbox-ready structure.", style: "Rounded corners, hover overlay with gradient, picsum images with ?random=N" },

  // Sidebar
  { category: "sidebar", name: "Sidebar — App navigation", description: "Vertical sidebar with logo, nav sections (Dashboard, Projects, Team, Settings), icon + label items, active state, user avatar at bottom.", style: "Dark sidebar (#1a1a2e), hover bg highlights, active item with accent left border, grouped sections with labels" },

  // Modal
  { category: "modal", name: "Modal — Confirmation dialog", description: "Centered modal with backdrop blur. Icon (warning/success), title, description, and two buttons (Cancel + Confirm). Smooth animations.", style: "White card on blurred dark backdrop, rounded-2xl, red for destructive, green for success variants" },

  // Banner
  { category: "banner", name: "Banner — Cookie consent", description: "Bottom-fixed cookie consent banner with text, 'Accept all', 'Customize', and 'Reject' buttons. Clean and GDPR-compliant.", style: "White banner with shadow-lg, fixed bottom, rounded top corners, subtle border" },
  { category: "banner", name: "Banner — Announcement with countdown", description: "Top banner with gradient bg announcing a sale/event. Includes countdown timer (days:hours:mins:secs) and CTA link. Dismissible.", style: "Gradient bg (amber to orange), white text, monospace countdown boxes, X close button" },
];

async function generateComponent(spec: typeof COMPONENT_SPECS[0]): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324",
      temperature: 0.7,
      max_tokens: 8000,
      messages: [
        {
          role: "system",
          content: `You are a world-class UI engineer. Generate a single, self-contained UI section using Tailwind CSS.

RULES:
- Return ONLY the HTML for the section (no <!DOCTYPE>, no <html>, no <head>, no <script>)
- Just the section/div element and its contents
- Use Tailwind CSS utility classes exclusively
- Make it responsive (mobile-first with sm:/md:/lg: breakpoints)
- Use https://picsum.photos/WIDTH/HEIGHT?random=N for any images (vary N)
- Use realistic placeholder text (not lorem ipsum) — real company names, real features, real stats
- Include hover states, transitions, and subtle animations where appropriate
- Make it production-quality — something you'd see on Stripe, Linear, or Vercel
- Include proper accessibility (aria labels, semantic HTML)`,
        },
        {
          role: "user",
          content: `Generate this component:

NAME: ${spec.name}
DESCRIPTION: ${spec.description}
STYLE: ${spec.style}

Return ONLY the HTML section. No explanation, no markdown fences.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let html = data.choices?.[0]?.message?.content ?? "";
  // Strip markdown fences if present
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}

async function main() {
  console.log("AI Component Generator");
  console.log("======================\n");
  console.log(`Generating ${COMPONENT_SPECS.length} premium components...\n`);

  // Load existing components
  let existing: any[] = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    console.log(`Loaded ${existing.length} existing components\n`);
  }

  // Track highest ID per category
  const counters: Record<string, number> = {};
  for (const c of existing) {
    const num = parseInt(c.id.split("-").pop() || "0");
    counters[c.category] = Math.max(counters[c.category] || 0, num);
  }

  const newComponents: any[] = [];

  for (let i = 0; i < COMPONENT_SPECS.length; i++) {
    const spec = COMPONENT_SPECS[i];
    console.log(`[${i + 1}/${COMPONENT_SPECS.length}] ${spec.name}...`);

    try {
      const html = await generateComponent(spec);
      if (!html || html.length < 100) {
        console.log(`  Skipped (empty response)`);
        continue;
      }

      counters[spec.category] = (counters[spec.category] || 0) + 1;
      const id = `${spec.category}-${String(counters[spec.category]).padStart(2, "0")}`;

      newComponents.push({
        id,
        category: spec.category,
        name: spec.name,
        description: spec.description,
        html,
        thumbnail: undefined,
        tokens: { colors: ["primary", "surface", "text"], fonts: ["headline", "body"], radius: true },
        slots: [],
        variants: [],
        tags: ["tailwind", "responsive", spec.category, "ai-generated", "premium"],
        source: "ai-generated",
        adaptability: "fluid",
        quality: 5,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      console.log(`  + ${id}: ${html.length} chars`);

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.warn(`  Failed: ${err}`);
    }
  }

  // Merge with existing
  const all = [...existing, ...newComponents];
  writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2));

  console.log(`\n======================`);
  console.log(`Generated: ${newComponents.length} new components`);
  console.log(`Total library: ${all.length} components`);
  console.log(`Written to: ${OUTPUT_PATH}`);

  const byCat: Record<string, number> = {};
  for (const c of all) byCat[c.category] = (byCat[c.category] || 0) + 1;
  console.log("\nBy category:");
  for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
