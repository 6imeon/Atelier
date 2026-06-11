"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
figma.showUI(__html__, { width: 340, height: 520, themeColors: true });
figma.ui.onmessage = async (msg) => {
    if (msg.type === "import-screen") {
        const { screenId, prompt, html, deviceType } = msg.data;
        const widths = { MOBILE: 390, TABLET: 820, DESKTOP: 1440, AGNOSTIC: 1280 };
        const heights = { MOBILE: 844, TABLET: 1180, DESKTOP: 900, AGNOSTIC: 800 };
        const w = widths[deviceType] ?? 1440;
        const h = heights[deviceType] ?? 900;
        const frame = figma.createFrame();
        frame.name = prompt?.slice(0, 60) || `Screen ${screenId}`;
        frame.resize(w, h);
        frame.x = figma.viewport.center.x - w / 2;
        frame.y = figma.viewport.center.y - h / 2;
        frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        const label = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        label.characters = prompt?.slice(0, 120) || screenId;
        label.fontSize = 14;
        label.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
        label.x = frame.x;
        label.y = frame.y + h + 12;
        figma.currentPage.appendChild(frame);
        figma.currentPage.appendChild(label);
        figma.viewport.scrollAndZoomIntoView([frame]);
        figma.ui.postMessage({ type: "import-complete", screenId });
    }
    if (msg.type === "import-design-system") {
        const ds = msg.data;
        if (!ds?.colors)
            return;
        const paintStyles = {
            "Primary": ds.colors.primary,
            "Secondary": ds.colors.secondary,
            "Accent": ds.colors.accent,
            "Background": ds.colors.background,
            "Surface": ds.colors.surface,
            "Text/Primary": ds.colors.text?.primary,
            "Text/Secondary": ds.colors.text?.secondary,
            "Text/Muted": ds.colors.text?.muted,
        };
        for (const [name, hex] of Object.entries(paintStyles)) {
            if (!hex)
                continue;
            const style = figma.createPaintStyle();
            style.name = `Atelier/${name}`;
            const rgb = hexToRgb(hex);
            if (rgb)
                style.paints = [{ type: "SOLID", color: rgb }];
        }
        figma.ui.postMessage({ type: "design-system-imported" });
    }
};
function hexToRgb(hex) {
    const m = hex.replace("#", "").match(/.{2}/g);
    if (!m || m.length < 3)
        return null;
    return { r: parseInt(m[0], 16) / 255, g: parseInt(m[1], 16) / 255, b: parseInt(m[2], 16) / 255 };
}
//# sourceMappingURL=code.js.map