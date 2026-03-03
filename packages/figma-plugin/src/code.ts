import type { BridgeCommand, BridgeResponse } from './types';

figma.showUI(__html__, { width: 340, height: 480, themeColors: true });

function respond(id: string, status: 'ok' | 'error', data?: unknown, error?: string) {
  const msg: BridgeResponse = { id, status, data, error };
  figma.ui.postMessage(msg);
}

function getNode(nodeId: string): SceneNode | null {
  const node = figma.getNodeById(nodeId);
  if (!node || node.removed) return null;
  if ('visible' in node) return node as SceneNode;
  return null;
}

function parseColor(r: number, g: number, b: number): RGB {
  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
}

function serializeNode(node: SceneNode): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
  if ('children' in node) {
    base.childCount = (node as ChildrenMixin).children.length;
  }
  if (node.type === 'TEXT') {
    base.characters = (node as TextNode).characters;
  }
  return base;
}

function serializeNodeTree(node: BaseNode, depth: number): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };
  if ('x' in node) base.x = (node as SceneNode).x;
  if ('y' in node) base.y = (node as SceneNode).y;
  if ('width' in node) base.width = (node as SceneNode).width;
  if ('height' in node) base.height = (node as SceneNode).height;
  if (node.type === 'TEXT') base.characters = (node as TextNode).characters;

  if ('children' in node && depth > 0) {
    base.children = (node as ChildrenMixin).children.map((c: SceneNode) =>
      serializeNodeTree(c, depth - 1)
    );
  }
  return base;
}

async function handleCommand(cmd: BridgeCommand) {
  const { id, type, params } = cmd;

  try {
    switch (type) {
      case 'create_frame': {
        const frame = figma.createFrame();
        frame.name = (params.name as string) || 'Frame';
        frame.resize(
          (params.width as number) || 100,
          (params.height as number) || 100
        );
        if (params.x != null) frame.x = params.x as number;
        if (params.y != null) frame.y = params.y as number;

        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number };
          frame.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b) }];
        }

        if (params.autoLayout) {
          const al = params.autoLayout as Record<string, unknown>;
          frame.layoutMode = (al.direction as 'HORIZONTAL' | 'VERTICAL') || 'VERTICAL';
          frame.primaryAxisSizingMode = (al.primarySizing as 'FIXED' | 'AUTO') || 'AUTO';
          frame.counterAxisSizingMode = (al.counterSizing as 'FIXED' | 'AUTO') || 'AUTO';
          if (al.gap != null) frame.itemSpacing = al.gap as number;
          if (al.paddingTop != null) frame.paddingTop = al.paddingTop as number;
          if (al.paddingRight != null) frame.paddingRight = al.paddingRight as number;
          if (al.paddingBottom != null) frame.paddingBottom = al.paddingBottom as number;
          if (al.paddingLeft != null) frame.paddingLeft = al.paddingLeft as number;
          if (al.padding != null) {
            const p = al.padding as number;
            frame.paddingTop = p;
            frame.paddingRight = p;
            frame.paddingBottom = p;
            frame.paddingLeft = p;
          }
          if (al.primaryAxisAlignItems) {
            frame.primaryAxisAlignItems = al.primaryAxisAlignItems as 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
          }
          if (al.counterAxisAlignItems) {
            frame.counterAxisAlignItems = al.counterAxisAlignItems as 'MIN' | 'CENTER' | 'MAX';
          }
        }

        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(frame);
          }
        }

        if (params.cornerRadius != null) {
          frame.cornerRadius = params.cornerRadius as number;
        }

        respond(id, 'ok', { nodeId: frame.id });
        break;
      }

      case 'create_rectangle': {
        const rect = figma.createRectangle();
        rect.name = (params.name as string) || 'Rectangle';
        rect.resize(
          (params.width as number) || 100,
          (params.height as number) || 100
        );
        if (params.x != null) rect.x = params.x as number;
        if (params.y != null) rect.y = params.y as number;

        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          rect.fills = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        }

        if (params.cornerRadius != null) {
          rect.cornerRadius = params.cornerRadius as number;
        }

        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(rect);
          }
        }

        respond(id, 'ok', { nodeId: rect.id });
        break;
      }

      case 'create_text': {
        const text = figma.createText();
        const fontFamily = (params.fontFamily as string) || 'Inter';
        const fontStyle = (params.fontStyle as string) || 'Regular';

        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        if (fontFamily !== 'Inter' || fontStyle !== 'Regular') {
          await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        }

        text.fontName = { family: fontFamily, style: fontStyle };
        text.name = (params.name as string) || 'Text';
        text.characters = (params.text as string) || '';

        if (params.fontSize != null) text.fontSize = params.fontSize as number;

        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          text.fills = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        }

        if (params.lineHeight != null) {
          const lh = params.lineHeight as number;
          text.lineHeight = { value: lh, unit: 'PIXELS' };
        }

        if (params.letterSpacing != null) {
          text.letterSpacing = { value: params.letterSpacing as number, unit: 'PIXELS' };
        }

        if (params.textAlignHorizontal) {
          text.textAlignHorizontal = params.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
        }

        if (params.x != null) text.x = params.x as number;
        if (params.y != null) text.y = params.y as number;

        if (params.width != null) {
          text.resize(params.width as number, text.height);
          text.textAutoResize = 'HEIGHT';
        }

        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(text);
          }
        }

        respond(id, 'ok', { nodeId: text.id });
        break;
      }

      case 'create_ellipse': {
        const ellipse = figma.createEllipse();
        ellipse.name = (params.name as string) || 'Ellipse';
        ellipse.resize(
          (params.width as number) || 100,
          (params.height as number) || 100
        );
        if (params.x != null) ellipse.x = params.x as number;
        if (params.y != null) ellipse.y = params.y as number;

        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          ellipse.fills = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        }

        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(ellipse);
          }
        }

        respond(id, 'ok', { nodeId: ellipse.id });
        break;
      }

      case 'set_fill': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('fills' in node)) { respond(id, 'error', undefined, 'Node does not support fills'); break; }

        const fillNode = node as GeometryMixin;
        if (params.color) {
          const c = params.color as { r: number; g: number; b: number; a?: number };
          fillNode.fills = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        } else if (params.gradient) {
          const g = params.gradient as {
            type: 'LINEAR' | 'RADIAL';
            stops: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
          };
          fillNode.fills = [{
            type: `GRADIENT_${g.type}` as 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL',
            gradientStops: g.stops.map(s => ({
              position: s.position,
              color: { ...parseColor(s.color.r, s.color.g, s.color.b), a: s.color.a ?? 1 },
            })),
            gradientTransform: [[1, 0, 0], [0, 1, 0]],
          }];
        } else if (params.visible === false) {
          fillNode.fills = [];
        }

        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_text': {
        const node = getNode(params.nodeId as string);
        if (!node || node.type !== 'TEXT') {
          respond(id, 'error', undefined, `Text node ${params.nodeId} not found`);
          break;
        }
        const textNode = node as TextNode;
        const fontName = textNode.fontName as FontName;
        await figma.loadFontAsync(fontName);
        textNode.characters = (params.text as string) || '';
        respond(id, 'ok', { nodeId: textNode.id });
        break;
      }

      case 'set_font': {
        const node = getNode(params.nodeId as string);
        if (!node || node.type !== 'TEXT') {
          respond(id, 'error', undefined, `Text node ${params.nodeId} not found`);
          break;
        }
        const textNode = node as TextNode;
        const family = (params.fontFamily as string) || (textNode.fontName as FontName).family;
        const style = (params.fontStyle as string) || (textNode.fontName as FontName).style;
        await figma.loadFontAsync({ family, style });
        textNode.fontName = { family, style };

        if (params.fontSize != null) textNode.fontSize = params.fontSize as number;
        if (params.lineHeight != null) {
          textNode.lineHeight = { value: params.lineHeight as number, unit: 'PIXELS' };
        }
        if (params.letterSpacing != null) {
          textNode.letterSpacing = { value: params.letterSpacing as number, unit: 'PIXELS' };
        }
        if (params.textAlignHorizontal) {
          textNode.textAlignHorizontal = params.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
        }
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          textNode.fills = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        }

        respond(id, 'ok', { nodeId: textNode.id });
        break;
      }

      case 'set_layout': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (node.type !== 'FRAME' && node.type !== 'COMPONENT') {
          respond(id, 'error', undefined, 'Node does not support auto-layout');
          break;
        }
        const frame = node as FrameNode;

        if (params.direction) {
          frame.layoutMode = params.direction as 'HORIZONTAL' | 'VERTICAL';
        }
        if (params.gap != null) frame.itemSpacing = params.gap as number;
        if (params.padding != null) {
          const p = params.padding as number;
          frame.paddingTop = p;
          frame.paddingRight = p;
          frame.paddingBottom = p;
          frame.paddingLeft = p;
        }
        if (params.paddingTop != null) frame.paddingTop = params.paddingTop as number;
        if (params.paddingRight != null) frame.paddingRight = params.paddingRight as number;
        if (params.paddingBottom != null) frame.paddingBottom = params.paddingBottom as number;
        if (params.paddingLeft != null) frame.paddingLeft = params.paddingLeft as number;
        if (params.primaryAxisSizingMode) {
          frame.primaryAxisSizingMode = params.primaryAxisSizingMode as 'FIXED' | 'AUTO';
        }
        if (params.counterAxisSizingMode) {
          frame.counterAxisSizingMode = params.counterAxisSizingMode as 'FIXED' | 'AUTO';
        }
        if (params.primaryAxisAlignItems) {
          frame.primaryAxisAlignItems = params.primaryAxisAlignItems as 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
        }
        if (params.counterAxisAlignItems) {
          frame.counterAxisAlignItems = params.counterAxisAlignItems as 'MIN' | 'CENTER' | 'MAX';
        }

        respond(id, 'ok', { nodeId: frame.id });
        break;
      }

      case 'set_corner_radius': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('cornerRadius' in node)) {
          respond(id, 'error', undefined, 'Node does not support corner radius');
          break;
        }
        (node as RectangleNode).cornerRadius = params.radius as number;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_effects': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('effects' in node)) {
          respond(id, 'error', undefined, 'Node does not support effects');
          break;
        }

        const effects: Effect[] = [];
        const effectList = params.effects as Array<Record<string, unknown>>;
        for (const e of effectList) {
          if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
            const c = (e.color as { r: number; g: number; b: number; a?: number }) || { r: 0, g: 0, b: 0, a: 0.25 };
            effects.push({
              type: e.type as 'DROP_SHADOW' | 'INNER_SHADOW',
              color: { ...parseColor(c.r, c.g, c.b), a: c.a ?? 0.25 },
              offset: { x: (e.offsetX as number) || 0, y: (e.offsetY as number) || 4 },
              radius: (e.radius as number) || 8,
              spread: (e.spread as number) || 0,
              visible: true,
              blendMode: 'NORMAL',
            });
          } else if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
            effects.push({
              type: e.type as 'LAYER_BLUR' | 'BACKGROUND_BLUR',
              radius: (e.radius as number) || 4,
              visible: true,
            });
          }
        }

        (node as FrameNode).effects = effects;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_stroke': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('strokes' in node)) {
          respond(id, 'error', undefined, 'Node does not support strokes');
          break;
        }

        const strokeNode = node as GeometryMixin;
        if (params.color) {
          const c = params.color as { r: number; g: number; b: number; a?: number };
          strokeNode.strokes = [{
            type: 'SOLID',
            color: parseColor(c.r, c.g, c.b),
            opacity: c.a ?? 1,
          }];
        }
        if (params.weight != null && 'strokeWeight' in node) {
          (node as GeometryMixin).strokeWeight = params.weight as number;
        }
        if (params.align && 'strokeAlign' in node) {
          (node as GeometryMixin).strokeAlign = params.align as 'INSIDE' | 'OUTSIDE' | 'CENTER';
        }

        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'move_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (params.x != null) node.x = params.x as number;
        if (params.y != null) node.y = params.y as number;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'resize_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        node.resize(
          (params.width as number) || node.width,
          (params.height as number) || node.height
        );
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'rename_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        node.name = (params.name as string) || node.name;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'delete_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        node.remove();
        respond(id, 'ok');
        break;
      }

      case 'duplicate_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const clone = node.clone();
        if (params.offsetX != null) clone.x += params.offsetX as number;
        if (params.offsetY != null) clone.y += params.offsetY as number;
        respond(id, 'ok', { nodeId: clone.id });
        break;
      }

      case 'group_nodes': {
        const nodeIds = params.nodeIds as string[];
        const nodes: SceneNode[] = [];
        for (const nid of nodeIds) {
          const n = getNode(nid);
          if (n) nodes.push(n);
        }
        if (nodes.length < 2) {
          respond(id, 'error', undefined, 'Need at least 2 nodes to group');
          break;
        }
        const group = figma.group(nodes, figma.currentPage);
        if (params.name) group.name = params.name as string;
        respond(id, 'ok', { nodeId: group.id });
        break;
      }

      case 'place_image': {
        const imageUrl = params.imageUrl as string;
        if (!imageUrl) {
          respond(id, 'error', undefined, 'imageUrl is required');
          break;
        }
        const image = await figma.createImageAsync(imageUrl);
        const { width: imgW, height: imgH } = await image.getSizeAsync();
        const targetW = (params.width as number) || imgW;
        const targetH = (params.height as number) || imgH;

        const rect = figma.createRectangle();
        rect.name = (params.name as string) || 'Image';
        rect.resize(targetW, targetH);
        rect.fills = [{
          type: 'IMAGE',
          imageHash: image.hash,
          scaleMode: (params.scaleMode as 'FILL' | 'FIT' | 'CROP' | 'TILE') || 'FILL',
        }];

        if (params.x != null) rect.x = params.x as number;
        if (params.y != null) rect.y = params.y as number;

        if (params.cornerRadius != null) {
          rect.cornerRadius = params.cornerRadius as number;
        }

        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(rect);
          }
        }

        respond(id, 'ok', { nodeId: rect.id, width: targetW, height: targetH });
        break;
      }

      case 'get_selection': {
        const selection = figma.currentPage.selection;
        const nodes = selection.map(serializeNode);
        respond(id, 'ok', { nodes, count: nodes.length });
        break;
      }

      case 'get_node_tree': {
        const targetId = params.nodeId as string | undefined;
        const depth = (params.depth as number) ?? 3;
        let target: BaseNode;

        if (targetId) {
          const found = figma.getNodeById(targetId);
          if (!found) { respond(id, 'error', undefined, `Node ${targetId} not found`); break; }
          target = found;
        } else {
          target = figma.currentPage;
        }

        respond(id, 'ok', serializeNodeTree(target, depth));
        break;
      }

      case 'send_plan': {
        figma.ui.postMessage({
          type: 'plan_update',
          steps: params.steps,
        });
        respond(id, 'ok');
        break;
      }

      default:
        respond(id, 'error', undefined, `Unknown command: ${type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    respond(id, 'error', undefined, message);
  }
}

figma.ui.on('message', (msg: BridgeCommand) => {
  if (msg.id && msg.type) {
    handleCommand(msg);
  }
});
