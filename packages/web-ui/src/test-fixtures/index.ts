import { useCanvasStore } from "../stores/canvas-store";
import { homepageHtml } from "./templates/homepage";
import { aboutHtml } from "./templates/about";
import { minimalHtml } from "./templates/minimal";
import { testDesignTokens, testDesignSystem } from "./design-tokens";

/** Prefix for test screen IDs — used to identify and clean up test screens */
export const TEST_SCREEN_PREFIX = "test_fixture_";

/** Check if any test fixture screens are currently on the canvas */
export function hasTestFixtures(): boolean {
  return useCanvasStore.getState().screens.some(s => s.id.startsWith(TEST_SCREEN_PREFIX));
}

/** Remove all test fixture screens and design system card */
export function clearTestFixtures() {
  const store = useCanvasStore.getState();
  const testScreens = store.screens.filter(s => s.id.startsWith(TEST_SCREEN_PREFIX));
  testScreens.forEach(s => store.removeScreen(s.id));
  useCanvasStore.setState({ extractedTokens: null });
  console.log(`[TestMode] Cleared ${testScreens.length} test screens`);
}

/** Load test fixture screens + design system onto the canvas (no AI calls) */
export function loadTestFixtures() {
  const store = useCanvasStore.getState();

  // Clear existing test fixtures if any
  if (hasTestFixtures()) {
    clearTestFixtures();
  }

  // Create project if needed
  if (!store.project) {
    store.createProject("Test Project");
  }

  const pid = useCanvasStore.getState().project!.id;

  // Screen placement (matches ChatPanel's placeScreen logic)
  const screenW = 1440, screenH = 4000, gap = 40, gridOffsetX = 630;
  const cardW = screenW * 0.3;

  const templates = [
    { name: "Homepage", html: homepageHtml },
    { name: "About", html: aboutHtml },
    { name: "Contact", html: minimalHtml },
  ];

  templates.forEach((t, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    store.addScreen({
      id: `${TEST_SCREEN_PREFIX}${i}_${Date.now()}`,
      projectId: pid,
      prompt: `Horizon Studio — ${t.name}`,
      html: t.html,
      deviceType: "DESKTOP",
      x: col * (cardW + gap) + gridOffsetX,
      y: row * (screenH * 0.3 + gap + 40) + gap,
      width: screenW,
      height: screenH,
    });
  });

  // Set design system card (DesignSystemCard appears on canvas)
  const dsCardX = gridOffsetX - 560 - 30;
  useCanvasStore.setState({
    extractedTokens: {
      tokens: testDesignTokens,
      x: dsCardX,
      y: gap,
    },
  });

  // Update design system store (so font/color apply works)
  store.updateDesignSystem(testDesignSystem);

  console.log("[TestMode] Loaded 3 test screens + design system");
}
