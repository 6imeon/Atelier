/**
 * react-components skill — exports Atelier screens as React/TSX components.
 *
 * Usage:
 *   npx tsx skills/react-components/scripts/export.ts <projectId> <screenId>
 *   npx tsx skills/react-components/scripts/export.ts <projectId> <screenId> --split
 */
import { getCanvasAI } from "@canvas-ai/sdk";

interface ExportedComponent {
  name: string;
  code: string;
  filePath: string;
}

interface ExportResult {
  components: ExportedComponent[];
  screenId: string;
  projectId: string;
}

export async function exportReactComponents(
  projectId: string,
  screenId: string,
  opts: { split?: boolean } = {},
): Promise<ExportResult> {
  const sdk = getCanvasAI();
  const project = sdk.project(projectId);
  const screen = await project.getScreen(screenId);

  if (!screen) throw new Error(`Screen ${screenId} not found in project ${projectId}`);

  const code = await screen.exportReact();

  if (!opts.split) {
    // Single component export
    const name = screenId
      .replace(/^scr_/, "")
      .replace(/[_-](\w)/g, (_, c) => c.toUpperCase())
      .replace(/^\w/, (c) => c.toUpperCase());

    const componentName = `${name}Screen`;
    return {
      components: [
        {
          name: componentName,
          code,
          filePath: `components/${componentName}.tsx`,
        },
      ],
      screenId,
      projectId,
    };
  }

  // Split mode: parse the exported code and separate into sub-components
  // This is a simplified heuristic — look for function/const component declarations
  const componentRegex = /(?:export\s+)?(?:function|const)\s+(\w+)\s*[=(]/g;
  const matches = [...code.matchAll(componentRegex)];
  const componentNames = matches
    .map((m) => m[1])
    .filter((n) => /^[A-Z]/.test(n)); // React components start uppercase

  if (componentNames.length <= 1) {
    // Can't split further, return as single component
    const name = componentNames[0] ?? "Screen";
    return {
      components: [{ name, code, filePath: `components/${name}.tsx` }],
      screenId,
      projectId,
    };
  }

  // Return the full file as-is but list each component found
  return {
    components: componentNames.map((name) => ({
      name,
      code, // In a real implementation, each component would be extracted
      filePath: `components/${name}.tsx`,
    })),
    screenId,
    projectId,
  };
}

// CLI entrypoint
if (process.argv[1]?.includes("export")) {
  const args = process.argv.slice(2);
  const projectId = args.find((a) => !a.startsWith("--"));
  const screenId = args.find((a, i) => i > 0 && !a.startsWith("--"));
  const split = args.includes("--split");

  if (!projectId || !screenId) {
    console.error("Usage: export.ts <projectId> <screenId> [--split]");
    process.exit(1);
  }

  exportReactComponents(projectId, screenId, { split })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
}
