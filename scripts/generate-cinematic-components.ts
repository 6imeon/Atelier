/**
 * Generate cinematic-tier components using Kimi K2.5 + SECTION_GENERATE_CINEMATIC_SYSTEM.
 *
 * Writes to scripts/components-cinematic.json (separate from base components.json).
 * Loaded at runtime by api-server alongside the base seed file.
 *
 * Usage:
 *   npx tsx scripts/generate-cinematic-components.ts            # all 25
 *   npx tsx scripts/generate-cinematic-components.ts --limit 3  # pilot: first 3 only
 *   npx tsx scripts/generate-cinematic-components.ts --only hero-parallax-split
 *
 * Requires OPENROUTER_API_KEY.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_PATH = resolve(__dirname, "components-cinematic.json");

// Load env from .env (same pattern as generate-components.ts)
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = trimmed.slice(eq + 1).trim();
  }
}

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) { console.error("Missing OPENROUTER_API_KEY"); process.exit(1); }

// ─── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 0;
const onlyArg = args.indexOf("--only");
const ONLY = onlyArg >= 0 ? args[onlyArg + 1] : null;

// ─── Cinematic system prompt (mirrors SECTION_GENERATE_CINEMATIC_SYSTEM) ────
const SYSTEM_PROMPT = `You are a world-class UI engineer building ONE cinematic section for a premium scroll-driven webpage. The target quality bar is report.adidas-group.com — pinned reveals, parallax layers, scrub-synced animations, animated counters, and choreographed element sequencing.

<output-rules>
- Return ONLY the HTML (no JSON, no markdown fences, no explanation)
- One top-level element: <section>, <nav>, <header>, or <footer>
- NO <!DOCTYPE>, <html>, <head>, <body>, or CDN tags — Tailwind, GSAP, ScrollTrigger, Swiper, and Google Fonts are loaded globally
- Include a <script> tag at the end with GSAP code that uses gsap.registerPlugin(ScrollTrigger)
- Include a <style> tag for @keyframes and any clip-path/mask setup
- Use a unique class prefix per section (e.g. .hero-cine__, .stats-cine__) to avoid selector collisions — NEVER use generic selectors like [data-animate]
- Do NOT truncate or cut off mid-tag
</output-rules>

<cinematic-principles>
1. Scroll is the timeline — animations progress with scroll via scrub: 1 (exception: nav micro-interactions, hover effects)
2. Pin important moments with pin: true + end: "+=150%" so viewers dwell on them
3. Layered depth — at least 2 parallax layers per visual section (background slower than foreground)
4. Choreographed sequences via gsap.timeline() so elements animate in ordered beats
5. Use realistic placeholder content — real company names, real stats, real copy (NO Lorem ipsum)
6. Unique ScrollTrigger id per section: id: "sectionname-main"
</cinematic-principles>

<safety-rules>
- ALWAYS gsap.registerPlugin(ScrollTrigger) before using it
- ALWAYS give ScrollTrigger a unique id using the section prefix
- NEVER animate elements to opacity: 0 and leave them there — content must be readable after scroll
- NEVER use generic selectors like [data-animate] or .fade-up
- For pinned sections set min-height: 100vh and overflow: hidden on the outer element
- Parallax yPercent magnitude <= 30 to avoid clipping
</safety-rules>

<imagery>
- Use https://picsum.photos/WIDTH/HEIGHT?random=N — full-bleed dimensions (1920x1080+ for heroes, 800x1000 for portraits)
- All <img> must have width, height, style="object-fit:cover;max-width:100%;height:auto;"
</imagery>

<quality>
Ship the real thing — this section will appear on a production site. No placeholder content, no Lorem ipsum, no decorative filler. Every effect must be load-bearing.
</quality>`;

// ─── 25 cinematic component specs ──────────────────────────────────────────
interface Spec {
  id: string;
  category: string; // ComponentCategory from SDK
  name: string;
  description: string;
  gsapPattern: string; // for tags
  brief: string; // user-message content with specific detail
}

const SPECS: Spec[] = [
  {
    id: "hero-parallax-split", category: "hero",
    name: "Hero — Parallax split with text reveal",
    description: "Full-screen split hero with a parallax image on the right and a word-by-word text reveal on the left, pinned on scroll.",
    gsapPattern: "pinned-parallax-split",
    brief: "Two-column layout: left 50% has a large 7rem headline that reveals word-by-word via yPercent 110 stagger, eyebrow label with accent line, subtitle, single CTA. Right 50% has a full-height image that parallaxes up 20% while the whole section is pinned for 150% scroll. Add a vertical red accent bar behind the headline. Use Playfair Display for headline, Inter for body.",
  },
  {
    id: "hero-pinned-video", category: "hero",
    name: "Hero — Pinned video background",
    description: "Full-bleed picsum image (treat as video poster) pinned with subtle scale zoom and overlay fade as the user scrolls.",
    gsapPattern: "pinned-video-zoom",
    brief: "Full-screen section with a 1920x1080 picsum background image, dark gradient overlay fading from 0.3 to 0.8 as you scroll, headline centered in white with massive 9rem type, small eyebrow with accent line. Pin for 200% scroll, scale image from 1.0 to 1.15, fade overlay via scrub. Scroll indicator at bottom.",
  },
  {
    id: "hero-text-split-reveal", category: "hero",
    name: "Hero — Text split reveal",
    description: "Giant multi-line headline where each word reveals from below as the viewport scrolls into the section, then the whole section fades to reveal the next.",
    gsapPattern: "split-text-reveal",
    brief: "Center-aligned hero with 4 lines of 8vw headline, each line wrapped in an overflow-hidden span with yPercent 110 initial position, staggered reveal over pinned scroll. Background is a subtle grain noise overlay on solid dark color. No image. Exit animation fades the content up as scroll progresses past 70%.",
  },
  {
    id: "stats-counter-pinned", category: "stats",
    name: "Stats — Pinned counter reveal",
    description: "Three huge animated counters (€23.7B / 59,000 / 1949) pinned and counting up as you scroll.",
    gsapPattern: "pinned-counter",
    brief: "Dark section pinned for 120% scroll. Title 'In Numbers' at top. 3-column grid with 8rem red/accent numbers counting up from 0 to target via gsap.to({val: target}) with onUpdate. Each number has a small label beneath. Use data-target attributes on each number. Format 23700000000 as €23.7B, 59000 as 59,000, 1949 as 1949.",
  },
  {
    id: "stats-horizontal-scroll", category: "stats",
    name: "Stats — Horizontal scroll row",
    description: "Row of 5 stat cards that scroll horizontally as the user scrolls vertically, pinned.",
    gsapPattern: "horizontal-scroll-pin",
    brief: "Pinned section where a horizontal track of 5 wide stat cards (each w-screen) scrolls sideways via gsap.to(track, {x: -(scrollWidth - window.innerWidth)}) with scrub. Each card has a large metric, label, small description. Alternating backgrounds.",
  },
  {
    id: "features-scroll-stacked-cards", category: "features",
    name: "Features — Stacked card reveal",
    description: "Four feature cards that stack on top of each other as you scroll, each revealing then translating up to make room for the next.",
    gsapPattern: "stacked-card-stack",
    brief: "Container with min-height 400vh. Inside, 4 feature cards absolutely positioned, each with its own ScrollTrigger that pins and then slides up out of view as scroll progresses. Each card has a number, headline, description, and picsum image. Use position: sticky approach with gsap.to({yPercent: -100}) scrub animations.",
  },
  {
    id: "features-horizontal-pin", category: "features",
    name: "Features — Horizontal pinned scroll",
    description: "Three feature panels laid out horizontally and revealed via horizontal scroll-pin.",
    gsapPattern: "horizontal-scroll-pin",
    brief: "Section pinned for 200% scroll. Inner .track is flex horizontal with width: 300vw, three .panel children each w-screen. gsap.to(track, {x: -window.innerWidth * 2}) scrub. Each panel has a large image left, title + description + bullet list right.",
  },
  {
    id: "timeline-scroll-sync", category: "gallery",
    name: "Timeline — Scroll-synced chapter reveal",
    description: "Vertical timeline with years (1949, 1970, 1995, 2024) that highlight one at a time as you scroll through the section.",
    gsapPattern: "scroll-chapter-sync",
    brief: "Two-column pinned section: left 33% is a sticky timeline showing 4 year markers with a vertical line, right 66% shows the current chapter content. As you scroll, each year highlights and the right content cross-fades. Use 4 ScrollTrigger.create for year activation plus one pinned parent.",
  },
  {
    id: "timeline-chapter-nav", category: "navbar",
    name: "Navigation — Scroll-sync chapter nav",
    description: "Sticky nav that highlights the current chapter as the user scrolls through the page. Progress bar beneath shows total progress.",
    gsapPattern: "scroll-active-nav",
    brief: "Sticky header with logo left, 5 chapter links center, CTA right. Progress bar beneath that fills based on scroll percentage. Active chapter link gets accent color via ScrollTrigger.create for each section, updating the nav .active class. Smooth scroll-to on click.",
  },
  {
    id: "testimonials-parallax-quotes", category: "testimonials",
    name: "Testimonials — Parallax oversized quotes",
    description: "Three large testimonial cards with oversized quote marks that parallax at different speeds.",
    gsapPattern: "parallax-layered",
    brief: "Section with 3 testimonial cards in a grid. Each has a giant 12rem accent-colored opening quote mark in the background that yPercent 40 parallaxes as scroll, overlaid by the quote text and author. Different parallax speeds per card (-30, -20, -10 yPercent).",
  },
  {
    id: "gallery-pinned-reveal", category: "gallery",
    name: "Gallery — Pinned masonry reveal",
    description: "Pinned section where a masonry gallery of 6 images staggers into view as you scroll.",
    gsapPattern: "pinned-stagger-grid",
    brief: "Pinned section with a 3-column masonry of 6 varied-height picsum images. Initial state: all images have scale 0.9 and opacity 0. Scrub timeline: each image fades in and scales to 1.0 with stagger 0.15. When scroll reaches 100%, add a subtle yPercent -10 parallax exit.",
  },
  {
    id: "gallery-horizontal-scrub", category: "gallery",
    name: "Gallery — Horizontal scrub track",
    description: "Wide horizontal image strip that scrubs left as the user scrolls vertically. Pinned.",
    gsapPattern: "horizontal-scrub-track",
    brief: "Section with a .strip containing 8 picsum images in a row (each 40vw wide). Pin the section and gsap.to(strip, {x: () => -(strip.scrollWidth - window.innerWidth)}) with scrub. Add a section title that stays pinned above the strip.",
  },
  {
    id: "chart-animated-bar", category: "stats",
    name: "Chart — Animated bar chart",
    description: "Vertical bar chart where bars grow from 0 to their target height as the user scrolls in.",
    gsapPattern: "scroll-chart-grow",
    brief: "Section with a chart container. 6 vertical bars each with data-value attribute (30, 55, 72, 89, 94, 100). Each bar is a div with style transform-origin: bottom; transform: scaleY(0). gsap.to(bars, {scaleY: (i) => bars[i].dataset.value / 100, stagger: 0.1}) triggered on scroll enter. Axis labels and value labels that appear after the bar animation finishes.",
  },
  {
    id: "chart-animated-line", category: "stats",
    name: "Chart — Animated SVG line chart",
    description: "SVG line chart that draws itself via stroke-dashoffset animation as the section enters view.",
    gsapPattern: "svg-stroke-draw",
    brief: "Section with inline SVG (600x300 viewBox). A polyline path representing a growth curve. Use stroke-dasharray on the path, initially stroke-dashoffset equals pathLength (hidden), gsap.to(path, {strokeDashoffset: 0, duration: 2, ease: power2.out}) on scroll enter. Data points appear as small circles after the line draws.",
  },
  {
    id: "chart-radial-progress", category: "stats",
    name: "Chart — Radial progress rings",
    description: "Three SVG radial progress rings that fill up as you scroll into view.",
    gsapPattern: "svg-radial-progress",
    brief: "3-column grid of SVG radial progress circles (each 200x200). Background ring + progress ring per card, using stroke-dasharray = 2*PI*r and animating stroke-dashoffset from circumference to (circumference * (1 - percent)). Animated percentage counter in the center of each. ScrollTrigger once on each.",
  },
  {
    id: "content-fullbleed-parallax", category: "content",
    name: "Content — Full-bleed parallax section",
    description: "Full-width image parallax with overlay text that slides up as you scroll in.",
    gsapPattern: "fullbleed-parallax",
    brief: "Section min-h-screen with a 1920x1080 picsum as absolute background image (z-0). Dark gradient overlay (z-10). Content block center-aligned with eyebrow, 6rem headline, subtitle, CTA. Image has yPercent 25 parallax via scrub. Content block has yPercent -15 counter-parallax.",
  },
  {
    id: "content-split-scroll", category: "content",
    name: "Content — Split scroll with sticky image",
    description: "Left column with 3 text blocks, right column with a sticky image that changes as each block enters.",
    gsapPattern: "sticky-image-swap",
    brief: "Two-column section. Left 50% has 3 content blocks (each min-h-screen). Right 50% has a sticky image container (position: sticky; top: 0; h-screen). Use 3 ScrollTriggers — one per block — that cross-fade the right image source as each block becomes active. Smooth transitions between images.",
  },
  {
    id: "cta-pinned-reveal", category: "cta",
    name: "CTA — Pinned reveal with layered text",
    description: "Pinned CTA section with layered text that slides into place as you scroll.",
    gsapPattern: "pinned-layered-reveal",
    brief: "Pinned section. Giant background number '2025' in outlined text (webkit-text-stroke, no fill). Over it, animated headline and subtitle that slide up and fade in via scrub timeline. Big accent CTA button appears last with scale 0.9 -> 1.0. Release pin after 120%.",
  },
  {
    id: "footer-morph-in", category: "footer",
    name: "Footer — Morph-in reveal",
    description: "Footer that morphs in with columns sliding up and overlapping into place.",
    gsapPattern: "stagger-morph-in",
    brief: "Dark footer with 4 columns: brand + tagline, nav links, resources, newsletter signup. On scroll enter, each column slides up 100% with stagger 0.15 via ScrollTrigger once. Bottom bar with copyright, social icons, back-to-top button. Accent-colored top border.",
  },
  {
    id: "nav-scroll-hide", category: "navbar",
    name: "Navigation — Scroll-aware hide/show",
    description: "Sticky nav that hides when scrolling down and shows when scrolling up, with blur background on scroll.",
    gsapPattern: "scroll-direction-nav",
    brief: "Fixed top nav. Use ScrollTrigger.create with onUpdate that compares direction to translateY -100% (hidden) or 0 (visible) via gsap.to. Add backdrop-filter: blur(12px) + bg-black/80 when scrolled > 50px. Logo left, nav links center, CTA right.",
  },
  {
    id: "section-divider-morph", category: "content",
    name: "Divider — Morphing section transition",
    description: "Section-to-section divider with a morphing SVG shape that animates between sections.",
    gsapPattern: "svg-morph-divider",
    brief: "A 200px-tall divider section. Inline SVG with a path that morphs from a flat line to a wave curve via gsap.to path attr 'd' animation tied to scroll. Gradient background behind the SVG that shifts colors via scrub. No text.",
  },
  {
    id: "backdrop-gradient-scrub", category: "content",
    name: "Backdrop — Gradient color scrub",
    description: "Section where the background gradient color shifts continuously as the user scrolls through.",
    gsapPattern: "gradient-scrub",
    brief: "min-h-[200vh] section. Background is a gradient that animates via scrub from one color pair to another (e.g. from indigo/purple to orange/red). Center content with 6rem headline and subtitle. Also animate the headline color via scrub to a contrasting value.",
  },
  {
    id: "text-reveal-on-scroll", category: "content",
    name: "Text — Word-by-word reveal",
    description: "Large paragraph where each word reveals from transparent to solid as the user scrolls.",
    gsapPattern: "word-by-word-scrub",
    brief: "Section with a 4rem quote paragraph. Wrap each word in a span. gsap.to all spans via stagger with scrub tied to the section — each word transitions from opacity 0.15 to 1.0 as the user scrolls through. Attribution below the quote.",
  },
  {
    id: "image-reveal-clip", category: "gallery",
    name: "Image — Clip-path reveal",
    description: "Large image revealed via animated clip-path as you scroll into view.",
    gsapPattern: "clip-path-reveal",
    brief: "Section with a 1600x900 picsum image that starts with clip-path: inset(50% 0 50% 0) and animates to inset(0 0 0 0) via scrub. Caption below with eyebrow + title. Add a subtle yPercent 15 parallax to the image after the clip reveal completes.",
  },
  {
    id: "card-grid-stagger", category: "cards",
    name: "Cards — Staggered grid reveal",
    description: "3x3 grid of product cards that stagger in with scale + opacity + y-offset as the section enters.",
    gsapPattern: "stagger-grid-reveal",
    brief: "3-column grid of 9 product cards. Each card has a picsum image, title, description, price, CTA. Initial state via gsap.set: opacity 0, y 60, scale 0.95. gsap.to all cards with stagger: { amount: 1.2, from: 'start' } on scroll enter. Cards have hover: scale 1.02 + shadow-xl.",
  },
  // ─── Annual-report fidelity components (T2.1, April 2026) ─────────────────
  // Added after the Adidas gap analysis showed we were missing specific
  // component patterns the nexxar-built adidas report relies on.
  {
    id: "kpi-countup-cards", category: "stats",
    name: "KPI — Animated CountUp cards (year-over-year)",
    description: "Four KPI cards with numbers that count up from 0 to their target value on scroll, each showing current year, previous year, and delta percentage badge. Grid entrance with stagger.",
    gsapPattern: "countup-kpi-grid",
    brief: "4-column CSS grid of KPI cards (Revenue €23.7B +12%, Operating Profit €1.30B +28%, Free Cash Flow €1.10B +45%, EPS €5.82 +35%). Each card: white bg, rounded-lg, shadow-md, p-8. Structure per card: eyebrow label (uppercase tracking-wide text-xs text-gray-500), giant count-up number (text-5xl font-bold, data-target attribute), previous-year line beneath (text-sm text-gray-400 'vs €21.2B 2023'), delta badge as inline-flex pill (green bg-emerald-100 text-emerald-700 for positive, red for negative, with arrow icon). Animation: gsap.from(cards, {y:40,opacity:0,stagger:0.15,duration:0.6,ease:'power2.out',scrollTrigger:{trigger:section,start:'top 80%',once:true}}). Counter: per-card gsap.to({val:0},{val:target,duration:2,ease:'expo.out',onUpdate:function(){ el.textContent = formatNumber(this.targets()[0].val) }}). Delta badges: gsap.from(badges,{scale:0.5,opacity:0,delay:1.5,duration:0.5,ease:'back.out(1.7)'}). Responsive: 4 → 2 → 1 columns via md:/sm: breakpoints.",
  },
  {
    id: "interactive-quiz", category: "content",
    name: "Quiz — Interactive 3-question trivia",
    description: "Stateful 3-question multiple-choice quiz with progress bar, animated feedback (correct bounce / wrong shake), and final score screen with contextual links.",
    gsapPattern: "stateful-quiz",
    brief: "Max-width 720px centered card-based quiz. State variables on window.__quizState = {q:0,score:0,answered:false}. Structure: top progress bar (h-1 bg-gray-200 with inner accent-colored div transitioning width 33%→66%→100%), question card (bg-white rounded-xl shadow-lg p-8), question number eyebrow 'Question 1 of 3', question text text-2xl font-semibold, three answer buttons (full-width, border, rounded-lg, p-4, text-left, hover:bg-gray-50). On click: if correct, turn green with checkmark + 'Correct!' text + bounce (gsap.from feedback {scale:0.5,duration:0.4,ease:'elastic.out(1,0.5)'}); if wrong, turn red with X icon + CSS @keyframes shake animation (translateX -10px/+10px/0). 'Next Question' button appears after answer, on click slide-left transition to next question (gsap.to current {x:-50,opacity:0,duration:0.3}, then reset). Final screen: score '2 / 3' with contextual copy and 3 link cards. Questions: '1. In what year was adidas founded?' (1949/1953/1965), '2. How many employees does adidas have?' (~45K/~59K/~75K), '3. What is adidas 2024 revenue?' (€19B/€23.7B/€28B). Entry animation: gsap.from(card,{y:30,opacity:0,duration:0.5,scrollTrigger:{start:'top 75%',once:true}}). No external quiz lib.",
  },
  {
    id: "esg-pillar-letterforms", category: "features",
    name: "ESG — Pillar cards with giant letterforms",
    description: "Three full-bleed image cards (Environment / Social / Governance) with oversized translucent E/S/G letterforms, staggered reveal, and image zoom on scroll.",
    gsapPattern: "esg-letterform-reveal",
    brief: "3-column CSS grid, gap-6, max-w-7xl mx-auto. Each card: position relative, overflow hidden, rounded-xl, min-h-[500px], bg picsum 900x1200 as absolute object-cover. Dark gradient overlay linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 60%). Giant letter (E, S, or G) positioned absolute top-6 right-6, text-[12rem] font-black text-white/10, leading-none. Content block anchored bottom: eyebrow uppercase text-white/60 text-xs ('PILLAR 01'), heading text-2xl font-bold text-white, description text-sm text-white/80 (2-3 lines), 'Learn more →' link text-white underline. Content: Environment (circular products, renewable materials, carbon reduction 85%), Social (fair wages, community impact, 59,000 employees), Governance (ethics, compliance, board diversity). Hover: transform translateY(-8px), shadow-2xl, img brightness(1.1) via transition-all duration-300. Scroll animation: gsap.from(cards,{y:60,opacity:0,stagger:0.2,duration:0.8,ease:'power2.out',scrollTrigger:{trigger:section,start:'top 75%',once:true}}). Letter animation: gsap.from(letters,{scale:0.5,opacity:0,delay:0.3,stagger:0.2,duration:0.6,ease:'back.out(1.4)'}). Image: gsap.from(imgs,{scale:1.1,duration:1.2,ease:'power2.out',scrollTrigger:{trigger:section,start:'top 80%',once:true}}). Responsive: 3 → 1 column stacked on md:.",
  },
  {
    id: "dashboard-swiper-tiles", category: "cards",
    name: "Dashboard — Instagram-story tile Swiper",
    description: "Horizontally scrollable Swiper carousel of 6 dashboard tiles with KPI numbers, icons, and CTA links. Peek effect on mobile, grid on desktop.",
    gsapPattern: "swiper-tile-dashboard",
    brief: "Section with header (small eyebrow 'AT A GLANCE', title 'Report Dashboard' text-4xl font-bold) and a Swiper carousel beneath. Swiper config: slidesPerView:3, spaceBetween:24, pagination:{clickable:true}, breakpoints:{768:{slidesPerView:2},480:{slidesPerView:1.2}}, autoplay:{delay:5000,disableOnInteraction:true}. Six tiles, each bg-white rounded-xl shadow-md p-6 min-h-[280px] flex flex-col: icon container at top (w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center with inline SVG icon), metric number text-4xl font-bold (€23.7B / 59K / 85% / 1949 / 4.2M / 12 markets) via data-value for CountUp on viewport-enter, label text-sm text-gray-500 uppercase tracking-wide, short insight text-sm line-clamp-2, 'Read more →' CTA link at bottom mt-auto text-blue-600 font-semibold. Tiles: gsap.from(tiles,{y:40,opacity:0,stagger:0.1,duration:0.6,scrollTrigger:{start:'top 80%',once:true}}). Numbers: on ScrollTrigger once, per-tile gsap.to counter animation. Add Swiper pagination dots beneath the carousel. Initialize Swiper inside the script tag after checking if (!el.swiper) to avoid double-init. Topics: Targets & Outlook, Financial Highlights 2024, Our Purpose and Mission, Sustainability Report, Innovation Pipeline, Shareholder Information.",
  },
  {
    id: "highcharts-data-panel", category: "stats",
    name: "Chart — Financial data panel with inline SVG charts",
    description: "Two-column financial dashboard section with inline SVG pie chart (Revenue by Region) and bar chart (Revenue by Channel), both animating on scroll. Highcharts-style aesthetics without the library.",
    gsapPattern: "svg-chart-panel",
    brief: "Dark section (bg-slate-900 text-white) with grid grid-cols-2 gap-8 max-w-7xl. Left column: 'Revenue by Region' heading + inline SVG donut chart (viewBox 0 0 200 200). Donut built from 4 path segments using stroke-dasharray circles (r=70, circumference 2*PI*70=~440). Segments: EMEA 42% (blue #6aabcf), North America 28% (cyan #00b2ff), Asia-Pacific 21% (indigo), Latin America 9% (purple). Each segment: stroke-dasharray starts at '0 440' then gsap.to({strokeDasharray: `${percent*440} 440`, duration:1.5, ease:'power2.out', stagger:0.15}). Center label shows total '€23.7B'. Legend beneath with colored dots and region names + percentages. Right column: 'Revenue by Channel' heading + horizontal bar chart. 3 bars: DTC (Direct) 58%, Wholesale 35%, E-com 7%. Each bar a div with style scaleX:0 transform-origin:left, gsap.to({scaleX:(i)=>bars[i].dataset.value/100, stagger:0.15, duration:1, ease:'power3.out'}). Bar labels (name + percentage) to the right of each bar. All animations triggered via ScrollTrigger once at 'top 75%'. Section header: eyebrow 'SECTION 05', title 'Financial Performance' text-5xl font-bold. Use brand blue #6aabcf as primary accent throughout.",
  },
];

async function generateComponent(spec: Spec): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "moonshotai/kimi-k2.5",
      temperature: 0.6,
      top_p: 0.95,
      reasoning: { effort: "none" },
      max_tokens: 12000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Build this cinematic section:

NAME: ${spec.name}
GSAP PATTERN: ${spec.gsapPattern}
UNIQUE CLASS PREFIX: .${spec.id}__ (use this exact prefix for all selectors to avoid collisions)
SCROLLTRIGGER ID: "${spec.id}-main"

BRIEF:
${spec.brief}

Return ONLY the HTML — no markdown fences, no explanation.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  let html = data.choices?.[0]?.message?.content ?? "";
  html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();
  return html;
}

async function main() {
  console.log("Cinematic Component Generator");
  console.log("=============================\n");

  let specs = SPECS;
  if (ONLY) {
    specs = specs.filter(s => s.id === ONLY);
    if (specs.length === 0) { console.error(`No spec with id=${ONLY}`); process.exit(1); }
  }
  if (LIMIT > 0) specs = specs.slice(0, LIMIT);

  console.log(`Generating ${specs.length}/${SPECS.length} cinematic components (Kimi K2.5)...\n`);

  // Load existing
  let existing: any[] = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    console.log(`Loaded ${existing.length} existing cinematic components\n`);
  }
  const existingById = new Map(existing.map((c: any) => [c.id, c]));

  const newComponents: any[] = [];
  const failed: string[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const id = `cine-${spec.id}`;
    console.log(`[${i + 1}/${specs.length}] ${spec.name}`);

    try {
      const t0 = Date.now();
      const html = await generateComponent(spec);
      const ms = Date.now() - t0;

      if (!html || html.length < 200) {
        console.log(`  SKIP: empty/tiny response (${html.length} chars)`);
        failed.push(spec.id);
        continue;
      }

      // Sanity checks
      const hasScript = /<script/i.test(html);
      const hasGsap = /gsap\./i.test(html);
      const hasPrefix = html.includes(`${spec.id}__`);
      const warnings: string[] = [];
      if (!hasScript) warnings.push("no <script>");
      if (!hasGsap) warnings.push("no gsap calls");
      if (!hasPrefix) warnings.push(`missing class prefix ${spec.id}__`);

      const component = {
        id,
        category: spec.category,
        name: spec.name,
        description: spec.description,
        html,
        tokens: { colors: ["primary", "accent", "surface", "text"], fonts: ["headline", "body"], radius: true },
        slots: [],
        variants: [],
        tags: ["tailwind", "gsap", "scrolltrigger", "cinematic", spec.gsapPattern, spec.category, "tier:cinematic"],
        source: "ai-generated-cinematic",
        adaptability: "fluid",
        quality: 5,
        positiveRatings: 0,
        negativeRatings: 0,
        compositeScore: 5,
        elo: { rating: 1500, matches: 0, wins: 0, sigma: 350 },
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      newComponents.push(component);
      existingById.set(id, component);

      const warnStr = warnings.length > 0 ? ` [warn: ${warnings.join(", ")}]` : "";
      console.log(`  OK ${Math.round(html.length / 1024)}KB in ${(ms / 1000).toFixed(1)}s${warnStr}`);

      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.warn(`  FAILED: ${err instanceof Error ? err.message : err}`);
      failed.push(spec.id);
    }
  }

  // Merge with existing and write
  const all = [...existingById.values()];
  writeFileSync(OUTPUT_PATH, JSON.stringify(all, null, 2));

  console.log(`\n=============================`);
  console.log(`Generated: ${newComponents.length} new`);
  console.log(`Total cinematic components: ${all.length}`);
  if (failed.length > 0) console.log(`Failed: ${failed.join(", ")}`);
  console.log(`Written to: ${OUTPUT_PATH}`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
