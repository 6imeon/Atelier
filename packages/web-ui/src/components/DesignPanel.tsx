import { useRef, useState } from "react";
import { useCanvasStore } from "../stores/canvas-store";
import { useThemeStore } from "../theme";
import { FontPicker } from "./FontPicker";
import {
  generateShades,
  generatePaletteFromSeed,
  applyColorToScreens,
  applyFontToScreens,
  applyRadiusToScreens,
  applyMultiColorReplace,
} from "../utils/design-utils";

// ─── Options ─────────────────────────────────────────────────────

// Font options now provided by FontPicker component

const RADIUS_OPTIONS = [
  { label: "None", value: "0px" },
  { label: "S", value: "4px" },
  { label: "M", value: "8px" },
  { label: "L", value: "12px" },
  { label: "XL", value: "16px" },
  { label: "Full", value: "9999px" },
];

const THEME_OPTIONS = ["Custom", "Tonal", "Vibrant", "Monochrome", "Complementary"];

type ColorKey = "primary" | "secondary" | "tertiary" | "neutral";

// ─── Main Component ──────────────────────────────────────────────

export function DesignPanel() {
  const { designPanelOpen, toggleDesignPanel, project, designSystem, updateDesignSystem, screens, updateScreen, extractedTokens, pushHistory } = useCanvasStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<"theme" | "designmd">("theme");
  const [expandedColor, setExpandedColor] = useState<ColorKey | null>(null);

  if (!designPanelOpen) return null;

  const palette = designSystem.palette;
  const fonts = designSystem.fonts;
  const seedColor = designSystem.seedColor;
  const colorTheme = designSystem.colorTheme;
  const cornerRadius = designSystem.cornerRadius;
  const pc = palette.primary;

  // ─── Handlers (apply to screens like DesignSystemCard) ─────────

  const handleSeedChange = (newSeed: string) => {
    pushHistory();
    const oldPalette = { ...palette };
    const newPalette = generatePaletteFromSeed(newSeed, colorTheme);
    const merged = { ...palette, ...newPalette };
    updateDesignSystem({ seedColor: newSeed, palette: merged });
    applyMultiColorReplace(oldPalette, merged, updateScreen);
  };

  const handleThemeChange = (newTheme: string) => {
    pushHistory();
    const oldPalette = { ...palette };
    const newPalette = generatePaletteFromSeed(seedColor, newTheme);
    const merged = { ...palette, ...newPalette };
    updateDesignSystem({ colorTheme: newTheme, palette: merged });
    applyMultiColorReplace(oldPalette, merged, updateScreen);
  };

  const handleColorChange = (key: ColorKey, newColor: string) => {
    pushHistory();
    const old = palette[key];
    updateDesignSystem({ palette: { ...palette, [key]: newColor }, colorTheme: "Custom" });
    applyColorToScreens(old, newColor, screens, updateScreen);
  };

  const handleFontChange = (role: "headline" | "body" | "label", newFont: string) => {
    pushHistory();
    const old = fonts[role];
    updateDesignSystem({ fonts: { ...fonts, [role]: newFont } });
    applyFontToScreens(old, newFont, screens, updateScreen);
  };

  const handleRadiusChange = (newRadius: string) => {
    pushHistory();
    const old = cornerRadius;
    updateDesignSystem({ cornerRadius: newRadius });
    applyRadiusToScreens(old, newRadius, screens, updateScreen);
  };

  // Phase 5 — 3-dial handler. No screen mutation: dials affect future
  // generations only, so flipping them doesn't retroactively change screens.
  const dials = designSystem.dials ?? { variance: 8, motion: 6, density: 4 };
  const handleDialChange = (key: "variance" | "motion" | "density", v: number) => {
    updateDesignSystem({ dials: { ...dials, [key]: v } });
  };

  // ─── DESIGN.md content ─────────────────────────────────────────

  const meta = (extractedTokens?.tokens as any)?._meta || {};
  const analysis = meta.analysis || "";
  const personaName = meta.personaName || null;
  const personaId = meta.personaId || null;
  const proposedPages = meta.proposedPages || [];
  const url = meta.url || "";

  const designMdContent = `# Design System${project?.title ? `: ${project.title}` : ""}
${url ? `\n> Redesign of [${meta.originalBrandName || project?.title || ""}](${url})\n` : ""}
${analysis ? `## Brand Analysis\n\n${analysis}\n` : ""}
${personaName ? `## Design Persona\n\n**${personaName}** (\`${personaId}\`)\n` : ""}
## Colors

| Role       | Hex       |
|------------|-----------|
| Primary    | ${palette.primary} |
| Secondary  | ${palette.secondary} |
| Tertiary   | ${palette.tertiary} |
| Neutral    | ${palette.neutral} |
${palette.background ? `| Background | ${palette.background} |\n` : ""}${palette.text ? `| Text       | ${palette.text} |\n` : ""}
## Typography

| Role     | Font Family        |
|----------|--------------------|
| Headline | ${fonts.headline} |
| Body     | ${fonts.body} |
| Label    | ${fonts.label} |

## Corner Radius

\`${cornerRadius}\`
${proposedPages.length > 0 ? `\n## Pages\n\n${proposedPages.map((p: any, i: number) => `${i + 1}. **${p.title}** — ${p.description}`).join("\n")}\n` : ""}
`;

  return (
    <div style={{
      position: "fixed", right: 64, top: 0, width: 320, height: "100vh",
      background: "var(--chrome-bg)", borderLeft: "1px solid var(--chrome-border)",
      boxShadow: "var(--shadow-lg)", zIndex: 95,
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "fadeUp 0.2s ease",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--chrome-border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleDesignPanel} aria-label="Close" style={{
              background: "none", border: "none", color: "var(--chrome-text-muted)", cursor: "pointer",
              display: "flex", alignItems: "center", padding: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--chrome-text)" }}>
              Design System
            </span>
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--chrome-border)" }}>
          {(["theme", "designmd"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
              background: "none", border: "none", cursor: "pointer",
              color: activeTab === tab ? "var(--chrome-text)" : "var(--chrome-text-muted)",
              borderBottom: activeTab === tab ? `2px solid ${pc}` : "2px solid transparent",
            }}>
              {tab === "theme" ? "Theme" : "DESIGN.md"}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {activeTab === "theme" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Mode toggle */}
            <Section label="Mode">
              <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--chrome-border)", background: "var(--chrome-surface)" }}>
                {(["light", "dark"] as const).map(m => (
                  <button key={m} onClick={() => { if (theme !== m) toggleTheme(); }} style={{
                    flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: theme === m ? "var(--chrome-bg)" : "transparent",
                    color: theme === m ? "var(--chrome-text)" : "var(--chrome-text-muted)",
                    boxShadow: theme === m ? "var(--shadow-sm)" : "none",
                    borderRadius: theme === m ? 8 : 0,
                  }}>
                    {m === "light" ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    )}
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </Section>

            {/* Seed Color */}
            <Section label="Seed Color">
              <ColorRow hex={seedColor} onChange={handleSeedChange} />
            </Section>

            {/* Color Theme */}
            <Section label="Color Theme">
              <Dropdown value={colorTheme} options={THEME_OPTIONS} onChange={handleThemeChange} previewColor={pc} />
            </Section>

            {/* Color Palette */}
            <Section label="Color Palette">
              {(["primary", "secondary", "tertiary", "neutral"] as const).map(key => (
                <div key={key} style={{ marginBottom: 2 }}>
                  <button
                    onClick={() => setExpandedColor(expandedColor === key ? null : key)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", border: "none", borderRadius: 8,
                      background: expandedColor === key ? "var(--chrome-surface)" : "transparent",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: palette[key], border: "1px solid var(--chrome-border)", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "var(--chrome-text)", fontWeight: 500, flex: 1, textAlign: "left", textTransform: "capitalize" }}>{key}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--chrome-text-muted)" strokeWidth="2"
                      style={{ transform: expandedColor === key ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {expandedColor === key && (
                    <div style={{ padding: "6px 8px" }}>
                      <ColorRow hex={palette[key]} onChange={(c) => handleColorChange(key, c)} />
                      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                        {generateShades(palette[key]).map((shade, i) => (
                          <div key={i} onClick={() => handleColorChange(key, shade)}
                            style={{ flex: 1, height: 20, background: shade, borderRadius: i === 0 ? "4px 0 0 4px" : i === 6 ? "0 4px 4px 0" : 0, cursor: "pointer" }}
                            title={shade}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Section>

            {/* Font */}
            <Section label="Font">
              {(["headline", "body", "label"] as const).map(role => (
                <div key={role} style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: "var(--chrome-text-muted)", textTransform: "capitalize", marginBottom: 2, paddingLeft: 8 }}>{role}</div>
                  <FontPicker
                    value={fonts[role]}
                    onChange={(f) => handleFontChange(role, f)}
                    accent={pc}
                    variant="light"
                  />
                </div>
              ))}
            </Section>

            {/* Corner Radius */}
            <Section label="Corner Radius">
              <div style={{ display: "flex", gap: 4 }}>
                {RADIUS_OPTIONS.map(r => (
                  <button key={r.value} onClick={() => handleRadiusChange(r.value)}
                    style={{
                      flex: 1, padding: "6px 0", border: cornerRadius === r.value ? `1.5px solid ${pc}` : "1px solid var(--chrome-border)",
                      borderRadius: 8, fontSize: 10, fontWeight: 500, cursor: "pointer",
                      background: cornerRadius === r.value ? `${pc}15` : "var(--chrome-bg)",
                      color: cornerRadius === r.value ? pc : "var(--chrome-text-muted)",
                      fontFamily: "inherit",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
                {RADIUS_OPTIONS.map(r => (
                  <div key={r.value} style={{
                    width: 28, height: 28, borderRadius: r.value,
                    border: cornerRadius === r.value ? `2px solid ${pc}` : "1.5px solid var(--chrome-border)",
                    background: cornerRadius === r.value ? `${pc}15` : "var(--chrome-bg)",
                    transition: "all 0.2s",
                  }} />
                ))}
              </div>
            </Section>

            {/* Dials — Phase 5 */}
            <Section label="Dials">
              <div style={{ fontSize: 9, color: "var(--chrome-text-muted)", marginBottom: 8, lineHeight: 1.5 }}>
                Orthogonal to persona — applied to future generations.
              </div>
              <DialSlider label="Variance" hint="1 symmetric · 10 broken grid" value={dials.variance} accent={pc}
                onChange={(v) => handleDialChange("variance", v)} />
              <DialSlider label="Motion" hint="1 static · 10 scroll choreography" value={dials.motion} accent={pc}
                onChange={(v) => handleDialChange("motion", v)} />
              <DialSlider label="Density" hint="1 gallery · 10 data-dense" value={dials.density} accent={pc}
                onChange={(v) => handleDialChange("density", v)} />
            </Section>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--chrome-text-muted)", fontWeight: 500 }}>DESIGN.md</span>
              <button onClick={() => navigator.clipboard.writeText(designMdContent)} title="Copy to clipboard" style={{
                background: "none", border: "none", color: "var(--chrome-text-muted)", cursor: "pointer", padding: 2,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            <pre style={{
              padding: 12, borderRadius: 10, background: "var(--chrome-surface)",
              border: "1px solid var(--chrome-border)", fontSize: 10, lineHeight: 1.6,
              color: "var(--chrome-text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 500, overflowY: "auto", margin: 0,
            }}>
              {designMdContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function DialSlider({ label, hint, value, accent, onChange }: {
  label: string; hint: string; value: number; accent: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--chrome-text)" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: accent, fontWeight: 600 }}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
      />
      <div style={{ fontSize: 9, color: "var(--chrome-text-muted)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--chrome-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ColorRow({ hex, onChange }: { hex: string; onChange: (c: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => ref.current?.click()}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: hex, border: "1px solid var(--chrome-border)", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--chrome-text)" }}>{hex?.toUpperCase()}</span>
      <input ref={ref} type="color" value={hex || "#888888"} onChange={e => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }} />
    </div>
  );
}

function Dropdown({ value, options, onChange, previewColor }: { value: string; options: string[]; onChange: (v: string) => void; previewColor?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px", border: "1px solid var(--chrome-border)", borderRadius: 8,
        background: "var(--chrome-bg)", cursor: "pointer", fontFamily: "inherit",
      }}>
        {previewColor && <div style={{ width: 16, height: 16, borderRadius: "50%", background: `conic-gradient(${previewColor}, ${previewColor}88, ${previewColor})`, flexShrink: 0 }} />}
        <span style={{ fontSize: 12, color: "var(--chrome-text)", flex: 1, textAlign: "left" }}>{value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--chrome-text-muted)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9 }} />
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 2,
            background: "var(--chrome-surface)", border: "1px solid var(--chrome-border)",
            borderRadius: 8, boxShadow: "var(--shadow-lg)", overflow: "hidden",
          }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{
                display: "block", width: "100%", textAlign: "left", padding: "6px 10px",
                border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                background: value === o ? `${previewColor || "var(--accent)"}15` : "transparent",
                color: value === o ? previewColor || "var(--accent)" : "var(--chrome-text)",
              }}>
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
