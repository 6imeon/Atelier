import { useRef, useState, useCallback } from "react";
import { useCanvasStore, CanvasDesignSystem } from "../stores/canvas-store";
import { FontPicker } from "./FontPicker";
import {
  generateShades,
  generatePaletteFromSeed,
  applyColorToScreens,
  applyFontToScreens,
  applyRadiusToScreens,
} from "../utils/design-utils";
import { debugLog } from "../utils/debug";

// ─── Font & Radius Options ────────────────────────────────────────

// Font options now provided by FontPicker component

const RADIUS_OPTIONS = [
  { label: "None", value: "0px" }, { label: "S", value: "4px" },
  { label: "M", value: "8px" }, { label: "L", value: "12px" },
  { label: "XL", value: "16px" }, { label: "Full", value: "9999px" },
];

const THEME_OPTIONS = ["Custom", "Tonal", "Vibrant", "Monochrome", "Complementary"];

// ─── Color meaning helper ─────────────────────────────────────────

function getColorMeaning(role: string, personaId?: string): string {
  const meanings: Record<string, Record<string, string>> = {
    primary: {
      editorial: "Authority and editorial weight",
      warm: "Warmth and craft — the brand's primary voice",
      corporate: "Professionalism and trust",
      minimal: "Focus and intentional emphasis",
      bold: "Energy and confidence",
      luxury: "Refined elegance",
      default: "The brand's primary voice and key actions",
    },
    secondary: {
      editorial: "Depth and grounding",
      warm: "Stability — anchors the visual hierarchy",
      corporate: "Structure and reliability",
      default: "Supporting elements and secondary actions",
    },
    tertiary: { default: "Accents and decorative touches" },
    neutral: {
      warm: "Space and breath — lets content breathe",
      default: "Backgrounds, cards, and subtle fills",
    },
  };
  const roleMeanings = meanings[role] || {};
  if (personaId) {
    for (const key of Object.keys(roleMeanings)) {
      if (key !== "default" && personaId.includes(key)) return roleMeanings[key];
    }
  }
  return roleMeanings.default || "";
}

// ─── Main Component: Story Mode Design ────────────────────────────

type ColorKey = "primary" | "secondary" | "tertiary" | "neutral";

export function DesignSystemCard({ x, y, tokens }: { x: number; y: number; tokens: Record<string, any> }) {
  const { designSystem, updateDesignSystem, screens, updateScreen, pushHistory } = useCanvasStore();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedColor, setExpandedColor] = useState<ColorKey | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const brandData = tokens?._brandData;
  const logos = designSystem.logos || tokens?.logos || [];
  const brandName = tokens?.brandName || tokens?.name || "Design System";
  const primaryLogo = logos.find((l: any) => l.data);
  const meta = tokens?._meta || {};
  const analysis = meta.analysis || tokens?.analysis || "";
  const personaName = meta.personaName || null;
  const personaId = meta.personaId || null;
  const personaContent = meta.personaContent || null;
  const proposedPages = meta.proposedPages || [];

  const palette = designSystem.palette;
  const fonts = designSystem.fonts;
  const seedColor = designSystem.seedColor;
  const colorTheme = designSystem.colorTheme;
  const cornerRadius = designSystem.cornerRadius;
  const pc = palette.primary;

  // Extract persona ethos
  let personaEthos = "";
  if (personaContent) {
    const lines = personaContent.split("\n").filter((l: string) => l.trim() && !l.startsWith("#"));
    personaEthos = lines.slice(0, 3).join(" ").trim();
    if (personaEthos.length > 200) personaEthos = personaEthos.slice(0, 200) + "...";
  }

  // ─── Handlers ────────────────────────────────────────────────

  const handleSeedChange = useCallback((newSeed: string) => {
    pushHistory();
    const oldPalette = { ...palette };
    const newPalette = generatePaletteFromSeed(newSeed, colorTheme);
    const merged = { ...palette, ...newPalette };
    updateDesignSystem({ seedColor: newSeed, palette: merged });
    // Apply all color changes in one pass per screen
    const keys: ColorKey[] = ["primary", "secondary", "tertiary", "neutral"];
    const replacements: Array<[string, string]> = [];
    for (const key of keys) {
      if (oldPalette[key] !== merged[key]) replacements.push([oldPalette[key], merged[key]!]);
    }
    if (replacements.length > 0) {
      const freshScreens = useCanvasStore.getState().screens;
      for (const screen of freshScreens) {
        if (!screen.html) continue;
        let html = screen.html;
        for (const [oldC, newC] of replacements) {
          html = html.replace(new RegExp(oldC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), newC.toLowerCase());
        }
        if (html !== screen.html) updateScreen(screen.id, { html });
      }
    }
    const { extractedTokens } = useCanvasStore.getState();
    if (extractedTokens) {
      const t = { ...extractedTokens.tokens };
      if (t.colors) t.colors = { ...t.colors, primary: merged.primary, secondary: merged.secondary, accent: merged.tertiary };
      useCanvasStore.setState({ extractedTokens: { ...extractedTokens, tokens: t } });
    }
  }, [palette, colorTheme, updateScreen, updateDesignSystem, pushHistory]);

  const handleThemeChange = useCallback((theme: string) => {
    pushHistory();
    const oldPalette = { ...palette };
    const newPalette = generatePaletteFromSeed(seedColor, theme);
    const merged = { ...palette, ...newPalette };
    debugLog("design", "Theme change:", theme, { old: oldPalette, new: merged });
    updateDesignSystem({ colorTheme: theme, palette: merged });
    // Apply all color changes to screen HTML in one pass to avoid stale-read issues
    const keys: ColorKey[] = ["primary", "secondary", "tertiary", "neutral"];
    const replacements: Array<[string, string]> = [];
    for (const key of keys) {
      if (oldPalette[key] !== merged[key]) {
        debugLog("design", `Applying ${key}: ${oldPalette[key]} → ${merged[key]}`);
        replacements.push([oldPalette[key], merged[key]!]);
      }
    }
    if (replacements.length > 0) {
      // Read fresh screens and apply all replacements in one pass per screen
      const freshScreens = useCanvasStore.getState().screens;
      for (const screen of freshScreens) {
        if (!screen.html) continue;
        let html = screen.html;
        for (const [oldC, newC] of replacements) {
          html = html.replace(new RegExp(oldC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), newC.toLowerCase());
        }
        if (html !== screen.html) updateScreen(screen.id, { html });
      }
    }
  }, [palette, seedColor, updateScreen, updateDesignSystem, pushHistory]);

  const handleColorChange = useCallback((key: ColorKey, newColor: string) => {
    pushHistory();
    const old = palette[key];
    updateDesignSystem({ palette: { ...palette, [key]: newColor }, colorTheme: "Custom" });
    applyColorToScreens(old, newColor, screens, updateScreen);
  }, [palette, screens, updateScreen, updateDesignSystem, pushHistory]);

  const handleFontChange = useCallback((role: "headline" | "body" | "label", newFont: string) => {
    pushHistory();
    const old = fonts[role];
    updateDesignSystem({ fonts: { ...fonts, [role]: newFont } });
    applyFontToScreens(old, newFont, screens, updateScreen);
  }, [fonts, screens, updateScreen, updateDesignSystem, pushHistory]);

  const handleRadiusChange = useCallback((newRadius: string) => {
    pushHistory();
    const old = cornerRadius;
    updateDesignSystem({ cornerRadius: newRadius });
    applyRadiusToScreens(old, newRadius, screens, updateScreen);
  }, [cornerRadius, screens, updateScreen, updateDesignSystem, pushHistory]);

  const toggle = (section: string) => setExpandedSection(expandedSection === section ? null : section);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div data-design-card onWheel={(e) => e.stopPropagation()} style={{
      position: "absolute", left: x, top: y, width: 320,
      background: "#141416", borderRadius: 20, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
      fontFamily: "'Inter', system-ui, sans-serif", maxHeight: 750, display: "flex", flexDirection: "column",
    }}>

      {/* ═══ Hero Section — Persona & Ethos ═══ */}
      <div
        style={{
          padding: "20px 20px 16px", position: "relative", cursor: "grab",
          background: `linear-gradient(180deg, ${pc}12, transparent)`,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          e.stopPropagation();
          const zoom = useCanvasStore.getState().viewport.zoom;
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };
          const onMove = (ev: PointerEvent) => {
            if (!dragRef.current) return;
            const dx = (ev.clientX - dragRef.current.startX) / zoom;
            const dy = (ev.clientY - dragRef.current.startY) / zoom;
            const et = useCanvasStore.getState().extractedTokens;
            if (et) useCanvasStore.setState({ extractedTokens: { ...et, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy } });
          };
          const onUp = () => { dragRef.current = null; window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
      >
        {/* Brand mark + close */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${pc}44, ${pc}22)`,
            border: `1px solid ${pc}33`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {primaryLogo ? (
              <img src={primaryLogo.data} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain" }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pc} strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fafafa" }}>{brandName}</div>
            {personaName && <div style={{ fontSize: 10, color: pc, fontWeight: 500 }}>by {personaName}</div>}
          </div>
          <button onClick={() => useCanvasStore.setState({ extractedTokens: null })} title="Close" style={{
            width: 24, height: 24, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.04)",
            color: "#52525b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Ethos quote */}
        {(personaEthos || analysis) && (
          <div style={{
            fontSize: 11, color: "#71717a", lineHeight: 1.6, fontStyle: "italic",
            borderLeft: `2px solid ${pc}33`, paddingLeft: 12,
          }}>
            {personaEthos || analysis}
          </div>
        )}
      </div>

      {/* ═══ Scrollable Content ═══ */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* ═══ Palette Story ═══ */}
        <StorySection label="Palette Story" icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20 4 4 0 0 1 0-8 4 4 0 0 0 0-8"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>
        }>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(["primary", "secondary", "tertiary", "neutral"] as const).map(key => (
              <div key={key}
                onClick={() => setExpandedColor(expandedColor === key ? null : key)}
                style={{
                  padding: 10, borderRadius: 12, cursor: "pointer",
                  background: expandedColor === key ? "rgba(255,255,255,0.04)" : `${palette[key]}08`,
                  border: expandedColor === key ? `1px solid ${pc}33` : "1px solid transparent",
                  transition: "all 0.2s",
                }}>
                <div style={{
                  width: "100%", height: 32, borderRadius: 8, marginBottom: 8,
                  position: "relative", overflow: "hidden", cursor: "pointer",
                  background: palette[key],
                }} onClick={(e) => e.stopPropagation()}>
                  <input type="color" value={palette[key] || "#888888"}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    style={{
                      position: "absolute", inset: 0, width: "100%", height: "100%",
                      opacity: 0, cursor: "pointer", border: "none",
                    }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7", marginBottom: 2, textTransform: "capitalize" }}>{key}</div>
                <div style={{ fontSize: 9, color: "#52525b", lineHeight: 1.3 }}>
                  {getColorMeaning(key, personaId || undefined)}
                </div>
                <div style={{ fontSize: 9, color: "#3f3f46", fontFamily: "monospace", marginTop: 3 }}>
                  {palette[key]?.toUpperCase()}
                </div>
              </div>
            ))}
          </div>

          {/* Expanded shade strip */}
          {expandedColor && (
            <div style={{ marginTop: 8, padding: "8px 4px" }}>
              <div style={{ display: "flex", gap: 2 }}>
                {generateShades(palette[expandedColor]).map((shade, i) => (
                  <div key={i} onClick={() => handleColorChange(expandedColor, shade)}
                    title={shade}
                    style={{
                      flex: 1, height: 24, background: shade, cursor: "pointer",
                      borderRadius: i === 0 ? "6px 0 0 6px" : i === 6 ? "0 6px 6px 0" : 0,
                      transition: "transform 0.15s",
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.transform = "scaleY(1.4)"}
                    onMouseLeave={e => (e.target as HTMLElement).style.transform = "scaleY(1)"}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Seed + Theme row */}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: "#3f3f46", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Seed</div>
              <ColorPickerInline hex={seedColor} onChange={handleSeedChange} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: "#3f3f46", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Harmony</div>
              <select value={colorTheme} onChange={e => handleThemeChange(e.target.value)} style={{
                width: "100%", padding: "5px 6px", borderRadius: 6, fontSize: 10,
                border: "1px solid rgba(255,255,255,0.06)", background: "#1c1c20",
                color: "#a1a1aa", fontFamily: "inherit", outline: "none", cursor: "pointer",
              }}>
                {THEME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </StorySection>

        {/* ═══ Type Pairing ═══ */}
        <StorySection label="Type Pairing" icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
        }>
          {/* Live pairing preview */}
          <div style={{
            padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10,
          }}>
            <div style={{ fontFamily: `'${fonts.headline}', serif`, fontSize: 20, fontWeight: 600, color: "#fafafa", marginBottom: 6, lineHeight: 1.2 }}>
              Words that connect.
            </div>
            <div style={{ fontFamily: `'${fonts.body}', sans-serif`, fontSize: 12, color: "#71717a", lineHeight: 1.6, marginBottom: 8 }}>
              We help ambitious brands find their voice and tell their stories with clarity and purpose.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontFamily: `'${fonts.headline}', serif`, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#52525b", fontSize: 9, fontWeight: 600 }}>
                {fonts.headline}
              </span>
              <span style={{ fontSize: 9, color: "#27272a" }}>x</span>
              <span style={{ fontFamily: `'${fonts.body}', sans-serif`, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#52525b", fontSize: 9, fontWeight: 500 }}>
                {fonts.body}
              </span>
            </div>
          </div>

          {/* Font selectors */}
          {(["headline", "body", "label"] as const).map(role => (
            <div key={role} style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: "#3f3f46", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 2, paddingLeft: 8 }}>{role}</div>
              <FontPicker
                value={fonts[role]}
                onChange={(f) => handleFontChange(role, f)}
                accent={pc}
                variant="dark"
              />
            </div>
          ))}
        </StorySection>

        {/* ═══ Shape & Radius ═══ */}
        <StorySection label="Shape" icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
        }>
          <div style={{ display: "flex", gap: 4 }}>
            {RADIUS_OPTIONS.map(r => (
              <button key={r.value} onClick={() => handleRadiusChange(r.value)} style={{
                flex: 1, padding: "6px 0", fontSize: 10, fontWeight: 500, cursor: "pointer",
                borderRadius: 8, fontFamily: "inherit",
                border: cornerRadius === r.value ? `1.5px solid ${pc}` : "1px solid rgba(255,255,255,0.06)",
                background: cornerRadius === r.value ? `${pc}12` : "transparent",
                color: cornerRadius === r.value ? pc : "#52525b",
              }}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
            {RADIUS_OPTIONS.map(r => (
              <div key={r.value} style={{
                width: 26, height: 26, borderRadius: r.value,
                border: cornerRadius === r.value ? `2px solid ${pc}` : "1.5px solid rgba(255,255,255,0.06)",
                background: cornerRadius === r.value ? `${pc}12` : "transparent",
                transition: "all 0.2s",
              }} />
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#3f3f46", textAlign: "center", marginTop: 6 }}>
            {cornerRadius === "0px" ? "Sharp edges — structured, editorial" :
             cornerRadius === "4px" ? "Subtle rounding — clean, professional" :
             cornerRadius === "8px" ? "Moderate — friendly, modern" :
             cornerRadius === "12px" ? "Generous — soft, approachable" :
             cornerRadius === "16px" ? "Very round — playful, contemporary" :
             "Full rounding — pill-shaped, maximally soft"}
          </div>
        </StorySection>

        {/* ═══ Page Plan ═══ */}
        {proposedPages.length > 0 && (
          <StorySection label="Page Plan" icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          }>
            {proposedPages.map((page: any, i: number) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0",
                borderBottom: i < proposedPages.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, background: `${pc}12`,
                  color: pc, fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#e4e4e7" }}>{page.title}</div>
                  <div style={{ fontSize: 10, color: "#52525b", lineHeight: 1.4 }}>{page.description}</div>
                </div>
              </div>
            ))}
          </StorySection>
        )}

        {/* ═══ Original Site Reference (collapsible) ═══ */}
        {(brandData?.colors?.sections?.length > 0 || logos.length > 0) && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={() => toggle("reference")} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 6,
              padding: "10px 20px", border: "none", background: "none",
              color: "#3f3f46", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: expandedSection === "reference" ? "rotate(180deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Original Site Reference
            </button>
            {expandedSection === "reference" && (
              <div style={{ padding: "0 20px 14px" }}>
                {brandData?.colors?.sections?.map((section: any) => (
                  <div key={section.label} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#3f3f46", marginBottom: 3, fontWeight: 500 }}>
                      {section.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {section.colors.map((c: any, i: number) => (
                        <div key={i} title={`${c.hex} — click to use as seed`}
                          style={{ width: 18, height: 18, borderRadius: 5, background: c.hex, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                          onClick={() => handleSeedChange(c.hex)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {logos.filter((l: any) => l.data).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 9, color: "#3f3f46", marginBottom: 3, fontWeight: 500 }}>Logos</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {logos.filter((l: any) => l.data).map((logo: any, i: number) => (
                        <div key={i} style={{ padding: 4, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "#fff" }}>
                          <img src={logo.data} alt={logo.type} style={{ maxWidth: 50, maxHeight: 30, objectFit: "contain" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ DESIGN.md Export ═══ */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => toggle("designmd")} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 6,
            padding: "10px 20px", border: "none", background: "none",
            color: "#3f3f46", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expandedSection === "designmd" ? "rotate(180deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            DESIGN.md
          </button>
          {expandedSection === "designmd" && (
            <DesignMdTab tokens={tokens} brandName={brandName} palette={palette} fonts={fonts} cornerRadius={cornerRadius} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StorySection({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{
        fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px",
        color: "#3f3f46", marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ color: "#52525b" }}>{icon}</span>
        {label}
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.04)" }} />
      </div>
      {children}
    </div>
  );
}

function ColorPickerInline({ hex, onChange }: { hex: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", position: "relative" }}>
      <div style={{ width: 20, height: 20, borderRadius: 6, background: hex, border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <input type="color" value={hex || "#888888"} onChange={e => onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", border: "none" }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: "monospace", color: "#71717a" }}>{hex?.toUpperCase()}</span>
    </div>
  );
}

function DesignMdTab({ tokens, brandName, palette, fonts, cornerRadius }: {
  tokens: Record<string, any>; brandName: string;
  palette: CanvasDesignSystem["palette"]; fonts: CanvasDesignSystem["fonts"]; cornerRadius: string;
}) {
  const content = generateDesignMd(brandName, palette, fonts, cornerRadius, tokens);
  return (
    <div style={{ padding: "0 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <button onClick={() => navigator.clipboard.writeText(content)} title="Copy to clipboard" style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6,
          color: "#52525b", cursor: "pointer", padding: "3px 8px", fontSize: 9, fontFamily: "inherit",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
      <pre style={{
        padding: 12, borderRadius: 10, background: "#0e0e10",
        border: "1px solid rgba(255,255,255,0.04)", fontSize: 10, lineHeight: 1.6,
        color: "#71717a", whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 400, overflowY: "auto", margin: 0,
      }}>{content}</pre>
    </div>
  );
}

function generateDesignMd(
  brandName: string, palette: CanvasDesignSystem["palette"],
  fonts: CanvasDesignSystem["fonts"], cornerRadius: string,
  tokens: Record<string, any>,
): string {
  const meta = tokens?._meta || {};
  const analysis = meta.analysis || tokens?.analysis || "";
  const personaName = meta.personaName || null;
  const personaId = meta.personaId || null;
  const personaContent = meta.personaContent || null;
  const proposedPages = meta.proposedPages || [];
  const url = meta.url || "";
  const originalBrand = meta.originalBrandName || brandName;

  let personaEthos = "";
  if (personaContent) {
    const lines = personaContent.split("\n").filter((l: string) => l.trim() && !l.startsWith("#"));
    personaEthos = lines.slice(0, 4).join("\n").trim();
  }

  return `# Design System: ${brandName}
${url ? `\n> Redesign of [${originalBrand}](${url})\n` : ""}
${analysis ? `## Brand Analysis\n\n${analysis}\n` : ""}
${personaName ? `## Design Persona\n\n**${personaName}** (\`${personaId}\`)\n\n${personaEthos ? `${personaEthos}\n` : ""}` : ""}
## Colors

| Role       | Hex       | Usage |
|------------|-----------|-------|
| Primary    | ${palette.primary} | CTAs, active states, key highlights |
| Secondary  | ${palette.secondary} | Supporting elements, secondary buttons |
| Tertiary   | ${palette.tertiary} | Accents, decorative touches |
| Neutral    | ${palette.neutral} | Backgrounds, cards, subtle fills |
${palette.background ? `| Background | ${palette.background} | Page background |\n` : ""}${palette.text ? `| Text       | ${palette.text} | Body text, headings |\n` : ""}
## Typography

| Role     | Font Family        | Usage |
|----------|--------------------|-------|
| Headline | ${fonts.headline} | Page titles, section headings, hero text |
| Body     | ${fonts.body} | Paragraphs, descriptions, card content |
| Label    | ${fonts.label} | Buttons, tags, navigation, captions |

## Corner Radius

\`${cornerRadius}\`
${proposedPages.length > 0 ? `\n## Pages\n\n${proposedPages.map((p: any, i: number) => `${i + 1}. **${p.title}** — ${p.description}`).join("\n")}\n` : ""}`;
}
