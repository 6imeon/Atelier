/**
 * Atelier logo mark (chisel) + wordmark.
 * Matches the TopBar's original design — chisel icon with Instrument Serif italic text.
 */

interface Props {
  size?: "sm" | "md" | "lg";
  color?: string;
  onClick?: () => void;
}

const SIZES = {
  sm: { chiselW: 12, chiselH: 17, dotSize: 4, shaftW: 1.5, shaftH: 12, fontSize: 14, gap: 7 },
  md: { chiselW: 16, chiselH: 22, dotSize: 5, shaftW: 2, shaftH: 16, fontSize: 16, gap: 10 },
  lg: { chiselW: 22, chiselH: 30, dotSize: 7, shaftW: 2.5, shaftH: 22, fontSize: 22, gap: 12 },
};

export function AtelierLogo({ size = "md", color = "#1F1A1C", onClick }: Props) {
  const s = SIZES[size];

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: s.gap,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {/* Chisel icon */}
      <div style={{ position: "relative", width: s.chiselW, height: s.chiselH, flexShrink: 0 }}>
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: s.dotSize, height: s.dotSize, background: color, borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", top: s.dotSize - 1, left: "50%",
          transform: "translateX(-50%) rotate(-12deg)",
          width: s.shaftW, height: s.shaftH,
          background: `linear-gradient(180deg, ${color} 0%, ${color}18 100%)`,
          borderRadius: 1,
        }} />
      </div>
      {/* Wordmark */}
      <span style={{
        fontFamily: "'Instrument Serif', serif",
        fontStyle: "italic",
        fontSize: s.fontSize,
        color,
        letterSpacing: 0.5,
      }}>
        Atelier
      </span>
    </div>
  );
}
