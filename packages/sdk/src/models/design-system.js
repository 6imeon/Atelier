"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDesignMd = toDesignMd;
exports.parseDesignMd = parseDesignMd;
function toDesignMd(ds) {
    return `# DESIGN.md

## Colors
- Primary: \`${ds.colors.primary}\`
- Secondary: \`${ds.colors.secondary}\`
- Accent: \`${ds.colors.accent}\`
- Background: \`${ds.colors.background}\`
- Surface: \`${ds.colors.surface}\`
- Text Primary: \`${ds.colors.text.primary}\`
- Text Secondary: \`${ds.colors.text.secondary}\`
- Text Muted: \`${ds.colors.text.muted}\`

## Typography
- Heading: \`${ds.typography.fontFamilies.heading}\`
- Body: \`${ds.typography.fontFamilies.body}\`
- Mono: \`${ds.typography.fontFamilies.mono}\`

### Scale
${Object.entries(ds.typography.scale).map(([k, v]) => `- ${k}: \`${v}\``).join("\n")}

## Spacing
Base unit: \`${ds.spacing.unit}\`
Scale: ${ds.spacing.scale.map(s => `\`${s}\``).join(", ")}

## Border Radius
${Object.entries(ds.borderRadius).map(([k, v]) => `- ${k}: \`${v}\``).join("\n")}

## Shadows
${Object.entries(ds.shadows).map(([k, v]) => `- ${k}: \`${v}\``).join("\n")}

## Component Patterns
${ds.componentPatterns.map(cp => `### ${cp.name}\n${cp.description}\n\`\`\`\n${cp.tailwindClasses}\n\`\`\``).join("\n\n")}
`;
}
function parseDesignMd(md) {
    const ds = {};
    const val = (label) => {
        const m = md.match(new RegExp(`- ${label}:\\s*\`([^\\x60]+)\``));
        return m?.[1];
    };
    const section = (heading) => {
        const m = md.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`));
        return m?.[1] ?? "";
    };
    const kvPairs = (text) => {
        const out = {};
        for (const m of text.matchAll(/- (.+?):\s*`([^`]+)`/g))
            out[m[1]] = m[2];
        return out;
    };
    const primary = val("Primary"), secondary = val("Secondary"), accent = val("Accent");
    const background = val("Background"), surface = val("Surface");
    const textPrimary = val("Text Primary"), textSecondary = val("Text Secondary"), textMuted = val("Text Muted");
    if (primary || secondary || accent || background || surface) {
        ds.colors = {
            primary: primary ?? "", secondary: secondary ?? "", accent: accent ?? "",
            background: background ?? "", surface: surface ?? "",
            text: { primary: textPrimary ?? "", secondary: textSecondary ?? "", muted: textMuted ?? "" },
        };
    }
    const heading = val("Heading"), body = val("Body"), mono = val("Mono");
    if (heading || body || mono) {
        const scaleSection = section("Typography");
        const scaleBlock = scaleSection.match(/### Scale\n([\s\S]*?)(?=\n## |\n### |$)/)?.[1] ?? "";
        ds.typography = {
            fontFamilies: { heading: heading ?? "", body: body ?? "", mono: mono ?? "" },
            scale: kvPairs(scaleBlock),
        };
    }
    const spacingSection = section("Spacing");
    const unitMatch = spacingSection.match(/Base unit:\s*`([^`]+)`/);
    const scaleMatch = spacingSection.match(/Scale:\s*(.*)/);
    if (unitMatch) {
        const scaleVals = scaleMatch ? [...scaleMatch[1].matchAll(/`([^`]+)`/g)].map(m => m[1]) : [];
        ds.spacing = { unit: unitMatch[1], scale: scaleVals };
    }
    const radiusKv = kvPairs(section("Border Radius"));
    if (Object.keys(radiusKv).length)
        ds.borderRadius = radiusKv;
    const shadowKv = kvPairs(section("Shadows"));
    if (Object.keys(shadowKv).length)
        ds.shadows = shadowKv;
    const cpSection = section("Component Patterns");
    const patterns = [];
    for (const m of cpSection.matchAll(/### (.+)\n(.+)\n```\n([\s\S]*?)```/g)) {
        patterns.push({ name: m[1], description: m[2], tailwindClasses: m[3].trim() });
    }
    if (patterns.length)
        ds.componentPatterns = patterns;
    return ds;
}
//# sourceMappingURL=design-system.js.map