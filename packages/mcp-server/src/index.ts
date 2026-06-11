import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { CanvasAI } from "@canvas-ai/sdk";

const TOOLS = [
  { name: "create_project", description: "Create a new design project",
    inputSchema: { type: "object" as const, properties: { title: { type: "string" } }, required: ["title"] } },
  { name: "generate_screen", description: "Generate a UI screen from text",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, prompt: { type: "string" },
      deviceType: { type: "string", enum: ["MOBILE","DESKTOP","TABLET","AGNOSTIC"] },
    }, required: ["projectId","prompt"] } },
  { name: "generate_from_image", description: "Generate UI from sketch/screenshot",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, imageBase64: { type: "string" },
      prompt: { type: "string" }, deviceType: { type: "string", enum: ["MOBILE","DESKTOP","TABLET","AGNOSTIC"] },
    }, required: ["projectId","imageBase64"] } },
  { name: "edit_screen", description: "Edit an existing screen",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, screenId: { type: "string" }, prompt: { type: "string" },
    }, required: ["projectId","screenId","prompt"] } },
  { name: "generate_variants", description: "Generate design variants",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, screenId: { type: "string" }, prompt: { type: "string" },
      variantCount: { type: "number" }, creativeRange: { type: "string", enum: ["REFINE","EXPLORE","REIMAGINE"] },
    }, required: ["projectId","screenId","prompt"] } },
  { name: "get_screen", description: "Get a screen's HTML",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, screenId: { type: "string" },
    }, required: ["projectId","screenId"] } },
  { name: "list_screens", description: "List all screens in a project",
    inputSchema: { type: "object" as const, properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "export_react", description: "Export a screen as React TSX",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, screenId: { type: "string" },
    }, required: ["projectId","screenId"] } },
  { name: "extract_design_system", description: "Extract design tokens from a URL",
    inputSchema: { type: "object" as const, properties: {
      projectId: { type: "string" }, url: { type: "string" },
    }, required: ["projectId","url"] } },
];

async function main() {
  const sdk = new CanvasAI();
  const server = new Server({ name: "atelier", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      let result: unknown;
      switch (name) {
        case "create_project": {
          const p = sdk.createProject(args.title as string);
          result = { id: p.id, title: args.title };
          break;
        }
        case "generate_screen": {
          const s = await sdk.project(args.projectId as string).generate(args.prompt as string, (args.deviceType as any) ?? "DESKTOP");
          result = { screenId: s.id, html: await s.getHtml() };
          break;
        }
        case "generate_from_image": {
          const s = await sdk.project(args.projectId as string).generateFromImage(args.imageBase64 as string, args.prompt as string, (args.deviceType as any) ?? "DESKTOP");
          result = { screenId: s.id, html: await s.getHtml() };
          break;
        }
        case "edit_screen": {
          const scr = await sdk.project(args.projectId as string).getScreen(args.screenId as string);
          if (!scr) throw new Error("Screen not found");
          const ed = await scr.edit(args.prompt as string);
          result = { screenId: ed.id, html: await ed.getHtml() };
          break;
        }
        case "generate_variants": {
          const scr = await sdk.project(args.projectId as string).getScreen(args.screenId as string);
          if (!scr) throw new Error("Screen not found");
          const vars = await scr.variants(args.prompt as string, { variantCount: args.variantCount as number, creativeRange: args.creativeRange as any });
          result = await Promise.all(vars.map(async v => ({ screenId: v.id, html: await v.getHtml() })));
          break;
        }
        case "get_screen": {
          const scr = await sdk.project(args.projectId as string).getScreen(args.screenId as string);
          if (!scr) throw new Error("Screen not found");
          result = { screenId: scr.id, html: await scr.getHtml(), prompt: scr.prompt };
          break;
        }
        case "list_screens": {
          const screens = await sdk.project(args.projectId as string).screens();
          result = screens.map(s => ({ id: s.id, prompt: s.prompt, deviceType: s.deviceType }));
          break;
        }
        case "export_react": {
          const scr = await sdk.project(args.projectId as string).getScreen(args.screenId as string);
          if (!scr) throw new Error("Screen not found");
          result = { code: await scr.exportReact() };
          break;
        }
        case "extract_design_system": {
          result = await sdk.project(args.projectId as string).extractDesignFromURL(args.url as string);
          break;
        }
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[atelier] MCP server running");
}

main().catch(console.error);
