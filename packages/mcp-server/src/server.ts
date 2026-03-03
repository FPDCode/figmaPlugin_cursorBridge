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
import { SF_SYMBOLS } from './sf-symbols.js';

const bridge = new FigmaBridge(Number(process.env.WS_PORT) || 9100);

const pexelsKey = process.env.PEXELS_API_KEY || '';
const pexels = pexelsKey ? new PexelsClient(pexelsKey) : null;

const server = new McpServer({
  name: 'cursor-bridge',
  version: '2.0.0',
});

// ── Shared Schemas ───────────────────────────────────────────────────

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
  primaryAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional().describe('Primary axis sizing'),
  counterAxisSizingMode: z.enum(['FIXED', 'AUTO']).optional().describe('Counter axis sizing'),
  primarySizing: z.enum(['FIXED', 'AUTO']).optional().describe('Alias for primaryAxisSizingMode'),
  counterSizing: z.enum(['FIXED', 'AUTO']).optional().describe('Alias for counterAxisSizingMode'),
  primaryAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']).optional(),
  counterAxisAlignItems: z.enum(['MIN', 'CENTER', 'MAX']).optional(),
  layoutWrap: z.enum(['NONE', 'WRAP']).optional().describe('Enable flex wrap'),
  counterAxisSpacing: z.number().optional().describe('Cross-axis gap when wrapping'),
}).optional();

function formatResult(response: { status: string; data?: unknown; error?: string }): { content: Array<{ type: 'text'; text: string }> } {
  if (response.status === 'error') {
    return { content: [{ type: 'text', text: `Error: ${response.error}` }] };
  }
  return { content: [{ type: 'text', text: JSON.stringify(response.data ?? { success: true }, null, 2) }] };
}

// ── Create tools ─────────────────────────────────────────────────────

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
    cornerSmoothing: z.number().min(0).max(1).optional().describe('iOS-style corner smoothing (0-1, iOS default is 0.6)'),
    clipsContent: z.boolean().optional().describe('Clip content that overflows the frame'),
    autoLayout: AutoLayoutSchema.describe('Auto-layout configuration'),
  },
  async (params) => formatResult(await bridge.send('create_frame', params)),
);

server.tool(
  'create_component',
  'Create a reusable component in Figma. Same options as create_frame plus component-specific properties.',
  {
    name: z.string().optional().describe('Component name'),
    description: z.string().optional().describe('Component description'),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional(),
    fillColor: ColorSchema.optional(),
    cornerRadius: z.number().optional(),
    cornerSmoothing: z.number().min(0).max(1).optional(),
    clipsContent: z.boolean().optional(),
    autoLayout: AutoLayoutSchema,
  },
  async (params) => formatResult(await bridge.send('create_component', params)),
);

server.tool(
  'create_instance',
  'Create an instance of a component. Use componentKey for published library components or componentId for local components.',
  {
    componentKey: z.string().optional().describe('Published component key (from library)'),
    componentId: z.string().optional().describe('Local component node ID'),
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('create_instance', params)),
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
    cornerSmoothing: z.number().min(0).max(1).optional().describe('iOS-style corner smoothing (0-1)'),
    topLeftRadius: z.number().optional(),
    topRightRadius: z.number().optional(),
    bottomRightRadius: z.number().optional(),
    bottomLeftRadius: z.number().optional(),
  },
  async (params) => formatResult(await bridge.send('create_rectangle', params)),
);

server.tool(
  'create_text',
  'Create a text node in Figma. Default font is SF Pro. Loads the font automatically.',
  {
    name: z.string().optional().describe('Node name'),
    text: z.string().describe('The text content'),
    fontFamily: z.string().optional().describe('Font family (default "SF Pro")'),
    fontStyle: z.string().optional().describe('Font style, e.g. "Regular", "Bold", "Medium" (default "Regular")'),
    fontSize: z.number().optional().describe('Font size in pixels'),
    fillColor: ColorSchema.optional().describe('Text color'),
    lineHeight: z.number().optional().describe('Line height in pixels'),
    letterSpacing: z.number().optional().describe('Letter spacing in pixels'),
    textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
    textAlignVertical: z.enum(['TOP', 'CENTER', 'BOTTOM']).optional(),
    textAutoResize: z.enum(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']).optional(),
    textDecoration: z.enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH']).optional(),
    textCase: z.enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE']).optional(),
    paragraphSpacing: z.number().optional(),
    textTruncation: z.enum(['DISABLED', 'ENDING']).optional(),
    maxLines: z.number().optional().describe('Max lines before truncation (null for unlimited)'),
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

server.tool(
  'create_vector',
  'Create a vector node with custom SVG paths in Figma.',
  {
    name: z.string().optional(),
    vectorPaths: z.array(z.object({
      windingRule: z.enum(['EVENODD', 'NONZERO']),
      data: z.string().describe('SVG path d attribute'),
    })).describe('Array of vector paths'),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fillColor: ColorSchema.optional(),
    strokeColor: ColorSchema.optional(),
    strokeWeight: z.number().optional(),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('create_vector', params)),
);

server.tool(
  'create_line',
  'Create a line in Figma.',
  {
    name: z.string().optional(),
    length: z.number().optional().describe('Line length in pixels'),
    rotation: z.number().optional().describe('Rotation in degrees (0 = horizontal)'),
    x: z.number().optional(),
    y: z.number().optional(),
    strokeColor: ColorSchema.optional(),
    strokeWeight: z.number().optional().describe('Stroke weight in pixels'),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('create_line', params)),
);

server.tool(
  'create_polygon',
  'Create a polygon (triangle, hexagon, etc.) in Figma.',
  {
    name: z.string().optional(),
    pointCount: z.number().optional().describe('Number of sides (default 3 = triangle)'),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fillColor: ColorSchema.optional(),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('create_polygon', params)),
);

server.tool(
  'create_star',
  'Create a star shape in Figma.',
  {
    name: z.string().optional(),
    pointCount: z.number().optional().describe('Number of points (default 5)'),
    innerRadius: z.number().min(0).max(1).optional().describe('Inner radius ratio (0-1, default ~0.38)'),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fillColor: ColorSchema.optional(),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('create_star', params)),
);

server.tool(
  'create_section',
  'Create an organizational section on the canvas.',
  {
    name: z.string().optional().describe('Section name'),
    width: z.number().optional(),
    height: z.number().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    fillColor: ColorSchema.optional(),
  },
  async (params) => formatResult(await bridge.send('create_section', params)),
);

server.tool(
  'insert_svg',
  'Insert an SVG string as a vector node in Figma.',
  {
    svg: z.string().describe('SVG markup string'),
    name: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    parentId: z.string().optional(),
  },
  async (params) => formatResult(await bridge.send('insert_svg', params)),
);

server.tool(
  'insert_sf_symbol',
  'Insert an SF Symbol icon by name. Uses built-in SVG lookup of common SF Symbols.',
  {
    symbolName: z.string().describe('SF Symbol name (e.g. "chevron.right", "house.fill", "gear")'),
    name: z.string().optional().describe('Node name in Figma'),
    size: z.number().optional().describe('Icon size in pixels (default 24)'),
    color: ColorSchema.optional().describe('Icon color'),
    x: z.number().optional(),
    y: z.number().optional(),
    parentId: z.string().optional(),
  },
  async (params) => {
    const svgData = SF_SYMBOLS[params.symbolName];
    if (!svgData) {
      const available = Object.keys(SF_SYMBOLS).join(', ');
      return { content: [{ type: 'text' as const, text: `SF Symbol "${params.symbolName}" not found. Available: ${available}` }] };
    }
    const size = params.size || 24;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${svgData}</svg>`;
    const result = await bridge.send('insert_svg', {
      svg,
      name: params.name || params.symbolName,
      x: params.x,
      y: params.y,
      width: size,
      height: size,
      parentId: params.parentId,
    });
    if (result.status === 'ok' && params.color) {
      const nodeId = (result.data as { nodeId: string }).nodeId;
      await bridge.send('set_fill', { nodeId, color: params.color });
    }
    return formatResult(result);
  },
);

// ── Modify tools ─────────────────────────────────────────────────────

server.tool(
  'set_fill',
  'Set the fill of a node to a solid color, gradient, or clear it.',
  {
    nodeId: z.string().describe('Target node ID'),
    color: ColorSchema.optional().describe('Solid fill color'),
    gradient: z.object({
      type: z.enum(['LINEAR', 'RADIAL']),
      angle: z.number().optional().describe('Gradient angle in degrees (0 = left-to-right, 90 = top-to-bottom)'),
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
  'Change font properties of a text node (family, style, size, color, spacing, decoration, case, truncation).',
  {
    nodeId: z.string().describe('Target text node ID'),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional().describe('e.g. "Regular", "Bold", "Medium", "SemiBold"'),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']).optional(),
    textAlignVertical: z.enum(['TOP', 'CENTER', 'BOTTOM']).optional(),
    textAutoResize: z.enum(['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']).optional(),
    textDecoration: z.enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH']).optional(),
    textCase: z.enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE']).optional(),
    paragraphSpacing: z.number().optional(),
    textTruncation: z.enum(['DISABLED', 'ENDING']).optional(),
    maxLines: z.number().optional(),
    fillColor: ColorSchema.optional().describe('Text color'),
  },
  async (params) => formatResult(await bridge.send('set_font', params)),
);

server.tool(
  'set_text_range',
  'Style a character range within a text node (bold a word, color a phrase, etc.).',
  {
    nodeId: z.string().describe('Target text node ID'),
    start: z.number().describe('Start character index (0-based)'),
    end: z.number().describe('End character index (exclusive)'),
    fontFamily: z.string().optional(),
    fontStyle: z.string().optional(),
    fontSize: z.number().optional(),
    fillColor: ColorSchema.optional(),
    textDecoration: z.enum(['NONE', 'UNDERLINE', 'STRIKETHROUGH']).optional(),
    textCase: z.enum(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE']).optional(),
    letterSpacing: z.number().optional(),
    lineHeight: z.number().optional(),
    hyperlink: z.object({
      type: z.literal('URL'),
      value: z.string(),
    }).optional(),
  },
  async (params) => formatResult(await bridge.send('set_text_range', params)),
);

server.tool(
  'set_layout',
  'Configure auto-layout on a frame (direction, gap, padding, alignment, wrap).',
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
    layoutWrap: z.enum(['NONE', 'WRAP']).optional().describe('Enable flex wrap'),
    counterAxisSpacing: z.number().optional().describe('Cross-axis gap when wrapping'),
  },
  async (params) => formatResult(await bridge.send('set_layout', params)),
);

server.tool(
  'set_sizing',
  'Set how a child node sizes itself within an auto-layout parent (fill, hug, fixed, grow, min/max).',
  {
    nodeId: z.string().describe('Target child node ID (must be inside an auto-layout frame)'),
    layoutSizingHorizontal: z.enum(['FIXED', 'FILL', 'HUG']).optional().describe('Horizontal sizing behavior'),
    layoutSizingVertical: z.enum(['FIXED', 'FILL', 'HUG']).optional().describe('Vertical sizing behavior'),
    layoutAlign: z.enum(['INHERIT', 'STRETCH']).optional().describe('Cross-axis alignment (STRETCH fills parent width/height)'),
    layoutGrow: z.number().optional().describe('Flex grow (0 = no grow, 1 = fill remaining space)'),
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
  },
  async (params) => formatResult(await bridge.send('set_sizing', params)),
);

server.tool(
  'set_corner_radius',
  'Set corner radius on a node. Supports uniform radius, per-corner radii, and iOS-style corner smoothing.',
  {
    nodeId: z.string().describe('Target node ID'),
    radius: z.number().optional().describe('Uniform corner radius in pixels'),
    topLeft: z.number().optional(),
    topRight: z.number().optional(),
    bottomRight: z.number().optional(),
    bottomLeft: z.number().optional(),
    smoothing: z.number().min(0).max(1).optional().describe('Corner smoothing (0-1, iOS default is 0.6)'),
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

server.tool(
  'set_opacity',
  'Set the opacity of a node (0-1).',
  {
    nodeId: z.string().describe('Target node ID'),
    opacity: z.number().min(0).max(1).describe('Opacity value (0 = transparent, 1 = opaque)'),
  },
  async (params) => formatResult(await bridge.send('set_opacity', params)),
);

server.tool(
  'set_visible',
  'Show or hide a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    visible: z.boolean().describe('true to show, false to hide'),
  },
  async (params) => formatResult(await bridge.send('set_visible', params)),
);

server.tool(
  'set_blend_mode',
  'Set the blend mode of a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    blendMode: z.enum([
      'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN',
      'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE',
      'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT',
      'DIFFERENCE', 'EXCLUSION',
      'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY',
    ]).describe('Blend mode'),
  },
  async (params) => formatResult(await bridge.send('set_blend_mode', params)),
);

server.tool(
  'set_constraints',
  'Set resize constraints on a node (how it responds when parent resizes).',
  {
    nodeId: z.string().describe('Target node ID'),
    horizontal: z.enum(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']).optional(),
    vertical: z.enum(['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']).optional(),
  },
  async (params) => formatResult(await bridge.send('set_constraints', params)),
);

server.tool(
  'set_clip_content',
  'Enable or disable content clipping on a frame (overflow hidden).',
  {
    nodeId: z.string().describe('Target frame node ID'),
    clip: z.boolean().describe('true to clip content, false to allow overflow'),
  },
  async (params) => formatResult(await bridge.send('set_clip_content', params)),
);

server.tool(
  'set_instance_properties',
  'Set component instance properties (text overrides, boolean toggles, instance swaps).',
  {
    nodeId: z.string().describe('Target instance node ID'),
    properties: z.record(z.union([z.string(), z.boolean()])).describe('Property name-value pairs'),
  },
  async (params) => formatResult(await bridge.send('set_instance_properties', params)),
);

server.tool(
  'set_layout_grids',
  'Set layout grids on a frame (columns, rows, or pixel grid).',
  {
    nodeId: z.string().describe('Target frame node ID'),
    grids: z.array(z.object({
      pattern: z.enum(['COLUMNS', 'ROWS', 'GRID']),
      count: z.number().optional().describe('Number of columns/rows'),
      sectionSize: z.number().optional().describe('Size of each section in pixels (for GRID)'),
      gutterSize: z.number().optional().describe('Gutter size in pixels'),
      offset: z.number().optional().describe('Offset from edge'),
      alignment: z.enum(['MIN', 'MAX', 'CENTER', 'STRETCH']).optional(),
      color: ColorSchema.optional().describe('Grid line color'),
    })).describe('Array of layout grid configurations'),
  },
  async (params) => formatResult(await bridge.send('set_layout_grids', params)),
);

// ── Style & Variable tools ───────────────────────────────────────────

server.tool(
  'apply_style',
  'Apply an existing style to a node by style ID.',
  {
    nodeId: z.string().describe('Target node ID'),
    fillStyleId: z.string().optional().describe('Paint style ID for fills'),
    strokeStyleId: z.string().optional().describe('Paint style ID for strokes'),
    textStyleId: z.string().optional().describe('Text style ID'),
    effectStyleId: z.string().optional().describe('Effect style ID'),
    gridStyleId: z.string().optional().describe('Grid style ID'),
  },
  async (params) => formatResult(await bridge.send('apply_style', params)),
);

server.tool(
  'apply_variable',
  'Bind a Figma variable to a node property.',
  {
    nodeId: z.string().describe('Target node ID'),
    field: z.string().describe('Property field to bind (e.g. "fills", "itemSpacing", "paddingTop")'),
    variableId: z.string().describe('Variable ID to bind'),
  },
  async (params) => formatResult(await bridge.send('apply_variable', params)),
);

// ── Transform tools ──────────────────────────────────────────────────

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

// ── Structural tools ─────────────────────────────────────────────────

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

server.tool(
  'set_parent',
  'Move a node into a new parent frame, optionally at a specific index.',
  {
    nodeId: z.string().describe('Node ID to move'),
    parentId: z.string().describe('New parent frame ID'),
    index: z.number().optional().describe('Insertion index (0 = first child)'),
  },
  async (params) => formatResult(await bridge.send('set_parent', params)),
);

server.tool(
  'boolean_operation',
  'Perform a boolean operation on 2+ nodes (union, subtract, intersect, exclude).',
  {
    nodeIds: z.array(z.string()).min(2).describe('Array of node IDs'),
    operation: z.enum(['union', 'subtract', 'intersect', 'exclude']).describe('Boolean operation type'),
    name: z.string().optional().describe('Name for the resulting node'),
  },
  async (params) => formatResult(await bridge.send('boolean_operation', params)),
);

server.tool(
  'flatten_node',
  'Flatten nodes into a single vector path.',
  {
    nodeIds: z.array(z.string()).min(1).describe('Array of node IDs to flatten'),
  },
  async (params) => formatResult(await bridge.send('flatten_node', params)),
);

server.tool(
  'detach_instance',
  'Detach a component instance, converting it to a regular frame.',
  {
    nodeId: z.string().describe('Instance node ID to detach'),
  },
  async (params) => formatResult(await bridge.send('detach_instance', params)),
);

// ── Image tool ───────────────────────────────────────────────────────

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

// ── Read tools ───────────────────────────────────────────────────────

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

server.tool(
  'read_node',
  'Read all properties of a node (fills, strokes, effects, layout, text, component info, etc.).',
  {
    nodeId: z.string().describe('Node ID to inspect'),
    includeChildren: z.boolean().optional().describe('Include full properties of direct children'),
  },
  async (params) => formatResult(await bridge.send('read_node', params)),
);

server.tool(
  'search_nodes',
  'Search for nodes on the current page by name, type, or partial name match.',
  {
    name: z.string().optional().describe('Exact node name'),
    nameContains: z.string().optional().describe('Partial name match (case-insensitive)'),
    type: z.string().optional().describe('Node type filter (e.g. "TEXT", "FRAME", "INSTANCE", "COMPONENT")'),
    limit: z.number().optional().describe('Max results (default 50)'),
  },
  async (params) => formatResult(await bridge.send('search_nodes', params)),
);

server.tool(
  'list_fonts',
  'List available fonts in Figma. Optionally filter by family name.',
  {
    query: z.string().optional().describe('Filter by font family name (e.g. "SF Pro", "Inter")'),
  },
  async (params) => formatResult(await bridge.send('list_fonts', params)),
);

server.tool(
  'read_local_styles',
  'Read all local styles from the file (paint, text, effect, grid styles).',
  {},
  async () => formatResult(await bridge.send('read_local_styles')),
);

server.tool(
  'read_local_variables',
  'Read all local variables and variable collections from the file.',
  {},
  async () => formatResult(await bridge.send('read_local_variables')),
);

server.tool(
  'list_local_components',
  'List all components on the current page with their keys and descriptions.',
  {},
  async () => formatResult(await bridge.send('list_local_components')),
);

// ── Page & Navigation tools ──────────────────────────────────────────

server.tool(
  'list_pages',
  'List all pages in the Figma file.',
  {},
  async () => formatResult(await bridge.send('list_pages')),
);

server.tool(
  'create_page',
  'Create a new page in the Figma file.',
  {
    name: z.string().optional().describe('Page name'),
    switchTo: z.boolean().optional().describe('Switch to the new page after creating'),
  },
  async (params) => formatResult(await bridge.send('create_page', params)),
);

server.tool(
  'switch_page',
  'Switch to a different page by ID.',
  {
    pageId: z.string().describe('Page ID to switch to'),
  },
  async (params) => formatResult(await bridge.send('switch_page', params)),
);

server.tool(
  'rename_page',
  'Rename a page.',
  {
    pageId: z.string().describe('Page ID'),
    name: z.string().describe('New page name'),
  },
  async (params) => formatResult(await bridge.send('rename_page', params)),
);

server.tool(
  'set_selection',
  'Set the current selection in Figma.',
  {
    nodeIds: z.array(z.string()).describe('Array of node IDs to select'),
  },
  async (params) => formatResult(await bridge.send('set_selection', params)),
);

server.tool(
  'zoom_to_node',
  'Scroll and zoom the viewport to show specific nodes.',
  {
    nodeId: z.string().optional().describe('Single node ID to zoom to'),
    nodeIds: z.array(z.string()).optional().describe('Multiple node IDs to fit in view'),
  },
  async (params) => formatResult(await bridge.send('zoom_to_node', params)),
);

// ── Export tool ───────────────────────────────────────────────────────

server.tool(
  'export_node',
  'Export a node as PNG, SVG, JPG, or PDF (returns base64).',
  {
    nodeId: z.string().describe('Node ID to export'),
    format: z.enum(['PNG', 'SVG', 'JPG', 'PDF']).optional().describe('Export format (default PNG)'),
    scale: z.number().optional().describe('Scale factor for raster formats (default 2)'),
  },
  async (params) => formatResult(await bridge.send('export_node', params)),
);

// ── Plugin Data tools ────────────────────────────────────────────────

server.tool(
  'set_plugin_data',
  'Store custom metadata on a node (persists with the file).',
  {
    nodeId: z.string().describe('Target node ID'),
    key: z.string().describe('Data key'),
    value: z.string().describe('Data value (string)'),
  },
  async (params) => formatResult(await bridge.send('set_plugin_data', params)),
);

server.tool(
  'get_plugin_data',
  'Read custom metadata from a node.',
  {
    nodeId: z.string().describe('Target node ID'),
    key: z.string().describe('Data key'),
  },
  async (params) => formatResult(await bridge.send('get_plugin_data', params)),
);

// ── Plan/Status tools ────────────────────────────────────────────────

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

// ── Batch tool ───────────────────────────────────────────────────────

server.tool(
  'batch',
  'Execute multiple commands in a single round trip. Wraps all operations in one undo group.',
  {
    commands: z.array(z.object({
      type: z.string().describe('Command type (e.g. "create_frame", "set_fill")'),
      params: z.record(z.unknown()).describe('Command parameters'),
    })).describe('Array of commands to execute sequentially'),
  },
  async (params) => formatResult(await bridge.send('batch', {
    commands: params.commands.map((c, i) => ({ id: `batch_${i}`, type: c.type, params: c.params })),
  }, 60_000)),
);

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('[cursor-bridge] MCP server started (stdio) — v2.0.0\n');
}

main().catch((err) => {
  process.stderr.write(`[cursor-bridge] Fatal: ${err}\n`);
  process.exit(1);
});
