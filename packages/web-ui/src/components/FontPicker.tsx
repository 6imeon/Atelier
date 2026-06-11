import { useState, useRef, useEffect, useCallback } from "react";

// ─── Popular Google Fonts (sorted by popularity) ────────────────
// Covers ~200 of the most-used Google Fonts. For any font not listed,
// users can type the exact name in the search box — we'll try to load
// it from Google Fonts directly.

const GOOGLE_FONTS = [
  // Sans-serif — geometric & modern
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Raleway", "Work Sans", "Outfit", "Sora", "Manrope", "Urbanist",
  "Plus Jakarta Sans", "DM Sans", "Space Grotesk", "Albert Sans",
  "Figtree", "Onest",
  // Sans-serif — humanist & neutral
  "Noto Sans", "Source Sans 3", "IBM Plex Sans", "Nunito", "Nunito Sans",
  "Rubik", "Karla", "Cabin", "Mukta", "Exo 2", "Barlow", "Red Hat Display",
  "Lexend", "Quicksand", "Comfortaa", "Overpass", "Archivo", "Mulish",
  "Ubuntu", "Titillium Web", "Hind", "Dosis", "Catamaran", "Signika",
  "Asap", "Fira Sans", "PT Sans", "Varela Round", "Kanit", "Sarabun",
  "Josefin Sans", "Maven Pro", "Prompt", "Yantramanav", "Cairo",
  "Assistant", "Public Sans", "Jost", "Sen", "Libre Franklin",
  // Sans-serif — condensed & display
  "Oswald", "Bebas Neue", "Anton", "Fjalla One", "Pathway Extreme",
  "Big Shoulders Display", "Saira", "Teko", "Pathway Gothic One",
  "Russo One", "Righteous", "Acme", "Bungee", "Orbitron",
  // Serif — classic & editorial
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif",
  "Source Serif 4", "IBM Plex Serif", "Libre Baskerville", "EB Garamond",
  "Crimson Text", "Cormorant Garamond", "Bitter", "Vollkorn", "Newsreader",
  "Spectral", "Cardo", "Libre Caslon Text", "Old Standard TT",
  "Gentium Book Plus", "Sorts Mill Goudy", "Neuton", "Brygada 1918",
  "Alegreya", "Amiri", "Faustina", "Gelasio", "Literata",
  // Serif — display & decorative
  "DM Serif Display", "Fraunces", "Bodoni Moda", "Abril Fatface",
  "Yeseva One", "Philosopher", "Domine", "Zilla Slab", "Bree Serif",
  "Cinzel", "Rozha One", "Marcellus", "Cormorant", "Limelight",
  "Playfair Display SC",
  // Slab serif
  "Roboto Slab", "Arvo", "Crete Round", "Josefin Slab", "Slabo 27px",
  "Patua One", "Rokkitt", "Aleo", "Sanchez",
  // Monospace
  "JetBrains Mono", "Fira Code", "Source Code Pro", "IBM Plex Mono",
  "Space Mono", "Roboto Mono", "DM Mono", "Ubuntu Mono", "Inconsolata",
  "Cousine", "Anonymous Pro", "Noto Sans Mono",
  // Handwriting & script
  "Caveat", "Dancing Script", "Pacifico", "Satisfy", "Great Vibes",
  "Kalam", "Permanent Marker", "Architects Daughter", "Indie Flower",
  "Shadows Into Light", "Sacramento", "Amatic SC", "Courgette",
  "Lobster", "Lobster Two", "Yellowtail", "Tangerine",
  // Display & decorative
  "Fredoka", "Baloo 2", "Lilita One", "Alfa Slab One", "Bangers",
  "Passion One", "Righteous", "Luckiest Guy", "Press Start 2P",
];

// Deduplicate (some may appear twice)
const FONT_LIST = [...new Set(GOOGLE_FONTS)];

// ─── Font CSS loader — loads preview fonts lazily ───────────────

const loadedFonts = new Set<string>();

function loadFontCSS(fontName: string): void {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const encoded = fontName.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
  link.dataset.fontPreview = fontName;
  document.head.appendChild(link);
}

// ─── FontPicker Component ───────────────────────────────────────

interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  /** Accent color for highlighting */
  accent?: string;
  /** Dark mode variant (for canvas card) vs light mode (for panel) */
  variant?: "dark" | "light";
}

export function FontPicker({ value, onChange, accent = "#7c5cfc", variant = "dark" }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customFont, setCustomFont] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter fonts by search query
  const filtered = search.trim()
    ? FONT_LIST.filter(f => f.toLowerCase().includes(search.toLowerCase()))
    : FONT_LIST;

  // Lazy-load fonts for visible items
  const visibleFonts = useRef(new Set<string>());
  const loadVisibleFonts = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const items = list.querySelectorAll("[data-font]");
    const listRect = list.getBoundingClientRect();
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      // Load if within ~100px of visible area
      if (rect.bottom > listRect.top - 100 && rect.top < listRect.bottom + 100) {
        const font = (item as HTMLElement).dataset.font!;
        if (!visibleFonts.current.has(font)) {
          visibleFonts.current.add(font);
          loadFontCSS(font);
        }
      }
    });
  }, []);

  // Load visible fonts on open and scroll
  useEffect(() => {
    if (!open) return;
    // Small delay to let the list render
    const t = setTimeout(loadVisibleFonts, 50);
    return () => clearTimeout(t);
  }, [open, filtered, loadVisibleFonts]);

  // Load the currently selected font for preview
  useEffect(() => {
    if (value) loadFontCSS(value);
  }, [value]);

  // Focus search input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-font-picker]")) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const tryCustomFont = () => {
    const name = customFont.trim();
    if (!name) return;
    setCustomLoading(true);
    loadFontCSS(name);
    // Give it a moment to load, then apply
    setTimeout(() => {
      onChange(name);
      setCustomFont("");
      setCustomLoading(false);
      setOpen(false);
    }, 500);
  };

  const isDark = variant === "dark";
  const bg = isDark ? "#1c1c20" : "var(--chrome-bg, #fff)";
  const surface = isDark ? "#141416" : "var(--chrome-surface, #f4f4f5)";
  const border = isDark ? "rgba(255,255,255,0.06)" : "var(--chrome-border, #e4e4e7)";
  const text = isDark ? "#e4e4e7" : "var(--chrome-text, #18181b)";
  const textMuted = isDark ? "#71717a" : "var(--chrome-text-muted, #a1a1aa)";

  return (
    <div data-font-picker style={{ position: "relative" }}>
      {/* Trigger button */}
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "6px 8px", border: "none", borderRadius: 8,
        background: open ? (isDark ? "rgba(255,255,255,0.04)" : "var(--chrome-surface)") : "transparent",
        cursor: "pointer", fontFamily: "inherit",
      }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: text, width: 22, textAlign: "center",
          fontFamily: `'${value}', sans-serif`,
        }}>Aa</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 11, color: text, fontWeight: 500 }}>{value}</div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: 4, borderRadius: 10, overflow: "hidden",
          background: bg, border: `1px solid ${border}`,
          boxShadow: isDark
            ? "0 12px 40px rgba(0,0,0,0.5)"
            : "0 8px 24px rgba(0,0,0,0.12)",
        }}>
          {/* Search input */}
          <div style={{ padding: "8px 8px 4px", borderBottom: `1px solid ${border}` }}>
            <div style={{ position: "relative" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="1.5"
                style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search fonts..."
                onKeyDown={e => {
                  if (e.key === "Escape") { setSearch(""); setOpen(false); }
                  if (e.key === "Enter" && filtered.length > 0) {
                    onChange(filtered[0]);
                    setOpen(false);
                    setSearch("");
                  }
                }}
                style={{
                  width: "100%", padding: "6px 8px 6px 28px", borderRadius: 6, boxSizing: "border-box",
                  border: `1px solid ${border}`, background: surface,
                  color: text, fontSize: 11, fontFamily: "inherit", outline: "none",
                }} />
            </div>
          </div>

          {/* Font list */}
          <div ref={listRef} onScroll={loadVisibleFonts} style={{
            maxHeight: 220, overflowY: "auto", padding: "4px",
          }}>
            {filtered.length === 0 && !search.trim() && (
              <div style={{ padding: 12, textAlign: "center", color: textMuted, fontSize: 11 }}>
                No fonts available
              </div>
            )}
            {filtered.length === 0 && search.trim() && (
              <div style={{ padding: "8px 12px", textAlign: "center" }}>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 6 }}>
                  No matches for "{search}"
                </div>
                <div style={{ color: textMuted, fontSize: 10 }}>
                  Try the exact Google Fonts name below
                </div>
              </div>
            )}
            {filtered.map(font => (
              <button key={font} data-font={font}
                onClick={() => { onChange(font); setOpen(false); setSearch(""); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "5px 8px", border: "none", borderRadius: 6, fontSize: 13,
                  background: value === font ? `${accent}22` : "transparent",
                  color: value === font ? accent : text,
                  cursor: "pointer",
                  fontFamily: `'${font}', sans-serif`,
                  fontWeight: 500,
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => {
                  if (value !== font) (e.target as HTMLElement).style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
                }}
                onMouseLeave={e => {
                  if (value !== font) (e.target as HTMLElement).style.background = "transparent";
                }}
              >
                {font}
              </button>
            ))}
          </div>

          {/* Custom font input — for fonts not in the list */}
          <div style={{
            padding: "6px 8px 8px", borderTop: `1px solid ${border}`,
            display: "flex", gap: 4, alignItems: "center",
          }}>
            <input value={customFont} onChange={e => setCustomFont(e.target.value)}
              placeholder="Any Google Font name..."
              onKeyDown={e => { if (e.key === "Enter") tryCustomFont(); }}
              style={{
                flex: 1, padding: "5px 8px", borderRadius: 6, boxSizing: "border-box",
                border: `1px solid ${border}`, background: surface,
                color: text, fontSize: 10, fontFamily: "inherit", outline: "none",
              }} />
            <button onClick={tryCustomFont} disabled={!customFont.trim() || customLoading}
              style={{
                padding: "5px 10px", borderRadius: 6, border: "none", fontSize: 10,
                fontWeight: 600, fontFamily: "inherit", cursor: customFont.trim() ? "pointer" : "default",
                background: customFont.trim() ? accent : (isDark ? "#27272a" : "#e4e4e7"),
                color: customFont.trim() ? "white" : textMuted,
              }}>
              {customLoading ? "..." : "Use"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
