#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FigmaBridge } from './websocket.js';
import { PexelsClient } from './pexels.js';

const bridge = new FigmaBridge(Number(process.env.WS_PORT) || 9100);

const pexelsKey = process.env.PEXELS_API_KEY || '';
const pexels = pexelsKey ? new PexelsClient(pexelsKey) : null;

const server = new McpServer({
  name: 'cursor-bridge',
  version: '1.0.0',
});

const ColorSchema = z.object({
  r: z.number().min(0).max(1).describe('Red channel (0-1)'),
  g: z.number().min(0).max(1).describe('Green channel (0-1)'),
  b: z.number().min(0).max(1).describe('Blue channel (0-1)'),
  a: z.number().min(0).max(1).optional().describe('Alpha/opacity (0-1, default 1)'),
});

const AutoLayoutSchema = z.object({
  direction: z.enum(['HORIZONTAL', 'VERTICAL']).optional(),
  gap: z.number().optional().describe('Spacing between children in pixels'),
  padding: z.number().optional().describe('Equal padding on all sides'),
  paddingTop: z.number().optional(),
  paddingRight: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional(),
  primarySizing: z.enum(['FIXED', 'AUTO']).optional(),
  counterSizing: z.enum(['FIXED', 'AUTO']).optional(),
  primaryAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).optional(),
  counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX']).optional(),
}).optional();

function formatResult(response: { status: string; data?: unknown; error?: string }): { content: Array<{ type: 'text'; text: string }> } {
  if (response.status === 'error') {
    return { content: [{ type: 'text', text: `Error: ${response.error}` }] };
  }
  return { content: [{ type: 'text', text: JSON.stringify(response.data ?? { success: true }, null, 2) }] };
}

// ── Create tools ────────────────────────────────────────────────────

server.tool(
  'create_frame',
  'Create a frame (container) in Figma. Supports auto-layout, fills, corner radius, and nesting.',
  {
    name: z.string().optional().describe('Frame name'),
    width: z.number().optional().describe('Width in pixels (default 100)'),
    height: z.number().optional().describe('Height in pixels (default 100)'),
    x: z.number().optional().describe('X position'),
    y: z.number().optional().describe('Y position'),
    parentId: z.string().optional().describe('Parent node ID to append into'),
    fillColor: ColorSchema.optional().describe('Background fill color'),
    cornerRadius: z.number().optional().describe('Corner radius in pixels'),
    autoLayout: AutoLayoutSchema.describe('Auto-layout configuration'),
  },
  async (params) => formatResult(await bridge.send('create_frame', params)),
);

server.tool(
  'create_rectangle',
  'Create a rectangle shape in Figma.',
  {
    name: z.string().optional().describe('Rectangle name'),
    width: z.number().optional().describe('Width in pixels'),
    height: z.number().optional().describe('Height in pixels'),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional().describe('Parent node ID'),
    fillColor: ColorSchema.optional().describe('Fill color'),
    cornerRadius: z.number().optional(),
  },
  async (params) => formatResult(await bridge.send('create_rectangle', params)),
);

server.tool(
  'create_text',
  'Create a text node in Figma. Loads the font automatically.',
  {
    name: z.string().optional().describe('Node name'),
    text: z.string().describe('The text content'),
    fontFamily: z.string().optional().describe('Font family (default "Inter")'),
    fontStyle: z.string().optional().describe('Font style, e.g. "Regular", "Bold", "Medium" (default "Regular")'),
    fontSize: z.number().optional().describe('Font size in pixels'),
    fillColor: ColorSchema.optional().describe('Text color'),
    lineHeight: z.number().optional().describe('Line height in pixels'),
    letterSpacing: z.number().optional().describe('Letter spacing in pixels'),
    textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
    width: z.number().optional().describe('Fixed width (text wraps). If omitted, text auto-sizes.'),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional().describe('Parent node ID'),
  },
  async (params) => formatResult(await bridge.send('create_text', params)),
);

server.tool(
  'create_ellipse',
  'Create an ellipse/circle in Figma.',
  {
    name: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional(),
    fillColor: ColorSchema.optional(),
  },
  async (params) => formatResult(await bridge.send('create_ellipse', params)),
);

// ── Modify tools ────────────────────────────────────────────────────

server.tool(
  'set_fill',
  'Set the fill of a node to a solid color, gradient, or clear it.',
  {
    nodeId: z.string().describe('Target node ID'),
    color: ColorSchema.optional().describe('Solid fill color'),
    gradient: z.object({
      type: z.enum(['LINEAR', 'RADIAL']),
      stops: z.array(z.object({
        position: z.number().min(0).max(1),
        color: ColorSchema,
      })),
    }).optional().describe('Gradient fill'),
    visible: z.boolean().optional().describe('Set to false to remove all fills'),
  },
  async (params) => formatResult(await bridge.send('set_fill', params)),
);

server.tool(
  'set_text',
  'Change the text content of an existing text node.',
  {
    nodeId: z.string().describe('Target text node ID'),
    text: z.string().describe('New text content'),
  },
  async (params) => formatResult(await bridge.send('set_text', params)),
);

server.tool(
  'set_font',
  'Change font properties of a text node (family, style, size, color, spacing).',
  {
    nodeId: z.string().describe('Target text node ID'),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional().describe('e.g. "Regular", "Bold", "Medium", "SemiBold"'),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
    fillColor: ColorSchema.optional().describe('Text color'),
  },
  async (params) => formatResult(await bridge.send('set_font', params)),
);

server.tool(
  'set_layout',
  'Configure auto-layout on a frame (direction, gap, padding, alignment).',
  {
    nodeId: z.string().describe('Target frame node ID'),
    direction: z.enum(['HORIZONTAL', 'VERTICAL']).optional(),
    gap: z.number().optional(),
    padding: z.number().optional().describe('Equal padding all sides'),
    paddingTop: z.number().optional(),
    paddingRight: z.number().optional(),
    paddingBottom: z.number().optional(),
    paddingLeft: z.number().optional(),
    primaryAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
    counterAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional(),
    primaryAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).optional(),
    counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX']).optional(),
  },
  async (params) => formatResult(await bridge.send('set_layout', params)),
);

server.tool(
  'set_corner_radius',
  'Set corner radius on a node (frame, rectangle, etc.).',
  {
    nodeId: z.string().describe('Target node ID'),
    radius: z.number().describe('Corner radius in pixels'),
  },
  async (params) => formatResult(await bridge.send('set_corner_radius', params)),
);

server.tool(
  'set_effects',
  'Apply visual effects (drop shadow, inner shadow, blur) to a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    effects: z.array(z.object({
      type: z.enum(['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR']),
      color: ColorSchema.optional().describe('Shadow color (for shadow types)'),
      offsetX: z.number().optional().describe('Horizontal offset (shadows)'),
      offsetY: z.number().optional().describe('Vertical offset (shadows)'),
      radius: z.number().optional().describe('Blur radius'),
      spread: z.number().optional().describe('Spread (shadows)'),
    })).describe('Array of effects to apply'),
  },
  async (params) => formatResult(await bridge.send('set_effects', params)),
);

server.tool(
  'set_stroke',
  'Set stroke (border) on a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    color: ColorSchema.optional().describe('Stroke color'),
    weight: z.number().optional().describe('Stroke weight in pixels'),
    align: z.enum(['INSIDE', 'OUTSIDE', 'CENTER']).optional(),
  },
  async (params) => formatResult(await bridge.send('set_stroke', params)),
);

// ── Transform tools ─────────────────────────────────────────────────

server.tool(
  'move_node',
  'Move a node to a new position.',
  {
    nodeId: z.string().describe('Target node ID'),
    x: z.number().optional(),
    y: z.number().optional(),
  },
  async (params) => formatResult(await bridge.send('move_node', params)),
);

server.tool(
  'resize_node',
  'Resize a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    width: z.number().optional(),
    height: z.number().optional(),
  },
  async (params) => formatResult(await bridge.send('resize_node', params)),
);

server.tool(
  'rename_node',
  'Rename a node in the layer panel.',
  {
    nodeId: z.string().describe('Target node ID'),
    name: z.string().describe('New name'),
  },
  async (params) => formatResult(await bridge.send('rename_node', params)),
);

// ── Structural tools ────────────────────────────────────────────────

server.tool(
  'delete_node',
  'Delete a node from the Figma document.',
  {
    nodeId: z.string().describe('Node ID to delete'),
  },
  async (params) => formatResult(await bridge.send('delete_node', params)),
);

server.tool(
  'duplicate_node',
  'Duplicate a node, optionally offset from the original.',
  {
    nodeId: z.string().describe('Node ID to duplicate'),
    offsetX: z.number().optional().describe('Horizontal offset from original'),
    offsetY: z.number().optional().describe('Vertical offset from original'),
  },
  async (params) => formatResult(await bridge.send('duplicate_node', params)),
);

server.tool(
  'group_nodes',
  'Group multiple nodes together.',
  {
    nodeIds: z.array(z.string()).min(2).describe('Array of node IDs to group'),
    name: z.string().optional().describe('Group name'),
  },
  async (params) => formatResult(await bridge.send('group_nodes', params)),
);

// ── Image tool ──────────────────────────────────────────────────────

server.tool(
  'place_image',
  'Search Pexels for a stock photo and place it in Figma. Pass either a search query (uses Pexels) or a direct imageUrl.',
  {
    query: z.string().optional().describe('Pexels search query (e.g. "mountain landscape")'),
    imageUrl: z.string().optional().describe('Direct image URL (skips Pexels search)'),
    imageSize: z.enum(['original', 'large2x', 'large', 'medium', 'small', 'portrait', 'landscape', 'tiny']).optional().describe('Pexels size variant (default "large")'),
    name: z.string().optional().describe('Node name'),
    width: z.number().optional().describe('Display width in pixels'),
    height: z.number().optional().describe('Display height in pixels'),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional(),
    cornerRadius: z.number().optional(),
    scaleMode: z.enum(['FILL', 'FIT', 'CROP', 'TILE']).optional(),
  },
  async (params) => {
    let imageUrl = params.imageUrl;

    if (!imageUrl && params.query) {
      if (!pexels) {
        return { content: [{ type: 'text' as const, text: 'Error: PEXELS_API_KEY not configured. Set it in .env or environment.' }] };
      }
      const result = await pexels.getPhotoUrl(params.query, params.imageSize || 'large');
      if (!result) {
        return { content: [{ type: 'text' as const, text: `No photos found for query: "${params.query}"` }] };
      }
      imageUrl = result.url;
    }

    if (!imageUrl) {
      return { content: [{ type: 'text' as const, text: 'Error: Provide either query (for Pexels search) or imageUrl.' }] };
    }

    const response = await bridge.send('place_image', { ...params, imageUrl });
    return formatResult(response);
  },
);

// ── Read tools ──────────────────────────────────────────────────────

server.tool(
  'get_selection',
  'Get information about the currently selected nodes in Figma.',
  {},
  async () => formatResult(await bridge.send('get_selection')),
);

server.tool(
  'get_node_tree',
  'Get the node hierarchy of a specific node or the current page.',
  {
    nodeId: z.string().optional().describe('Node ID to inspect (defaults to current page)'),
    depth: z.number().optional().describe('How many levels deep to traverse (default 3)'),
  },
  async (params) => formatResult(await bridge.send('get_node_tree', params)),
);

// ── Plan/Status tool ────────────────────────────────────────────────

server.tool(
  'send_plan',
  'Send a plan of upcoming steps to the Figma plugin UI for progress tracking. Call this before executing a multi-step design operation.',
  {
    steps: z.array(z.object({
      label: z.string().describe('Step description shown in the UI'),
      status: z.enum(['pending', 'in_progress', 'completed', 'error']).describe('Initial status'),
    })).describe('Array of planned steps'),
  },
  async (params) => {
    bridge.sendPlan(params.steps);
    return { content: [{ type: 'text' as const, text: 'Plan sent to plugin UI.' }] };
  },
);

server.tool(
  'update_step',
  'Update the status of a specific step in the plan displayed in the Figma plugin UI.',
  {
    index: z.number().describe('Step index (0-based)'),
    status: z.enum(['pending', 'in_progress', 'completed', 'error']).describe('New status'),
  },
  async (params) => {
    bridge.updateStep(params.index, params.status);
    return { content: [{ type: 'text' as const, text: `Step ${params.index} updated to ${params.status}.` }] };
  },
);

// ── Start ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[cursor-bridge] MCP server started (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`[cursor-bridge] Fatal: ${err}\n`);
  process.exit(1);
});
