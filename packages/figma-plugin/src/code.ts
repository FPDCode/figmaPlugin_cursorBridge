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

function angleToGradientTransform(angleDeg: number): Transform {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];
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

function serializeFullNode(node: SceneNode): Record<string, unknown> {
  const props: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    visible: node.visible,
  };

  if ('opacity' in node) props.opacity = (node as BlendMixin).opacity;
  if ('blendMode' in node) props.blendMode = (node as BlendMixin).blendMode;

  if ('fills' in node) {
    try { props.fills = JSON.parse(JSON.stringify((node as GeometryMixin).fills)); } catch { props.fills = []; }
  }
  if ('strokes' in node) {
    try { props.strokes = JSON.parse(JSON.stringify((node as GeometryMixin).strokes)); } catch { props.strokes = []; }
    if ('strokeWeight' in node) props.strokeWeight = (node as GeometryMixin).strokeWeight;
    if ('strokeAlign' in node) props.strokeAlign = (node as GeometryMixin).strokeAlign;
  }

  if ('effects' in node) {
    try { props.effects = JSON.parse(JSON.stringify((node as BlendMixin).effects)); } catch { props.effects = []; }
  }

  if ('cornerRadius' in node) props.cornerRadius = (node as RectangleNode).cornerRadius;
  if ('topLeftRadius' in node) {
    const rn = node as RectangleNode;
    props.topLeftRadius = rn.topLeftRadius;
    props.topRightRadius = rn.topRightRadius;
    props.bottomRightRadius = rn.bottomRightRadius;
    props.bottomLeftRadius = rn.bottomLeftRadius;
  }
  if ('cornerSmoothing' in node) props.cornerSmoothing = (node as RectangleNode).cornerSmoothing;

  if ('constraints' in node) props.constraints = (node as ConstraintMixin).constraints;
  if ('clipsContent' in node) props.clipsContent = (node as FrameNode).clipsContent;

  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    const f = node as FrameNode;
    props.layoutMode = f.layoutMode;
    if (f.layoutMode !== 'NONE') {
      props.primaryAxisSizingMode = f.primaryAxisSizingMode;
      props.counterAxisSizingMode = f.counterAxisSizingMode;
      props.primaryAxisAlignItems = f.primaryAxisAlignItems;
      props.counterAxisAlignItems = f.counterAxisAlignItems;
      props.itemSpacing = f.itemSpacing;
      props.paddingTop = f.paddingTop;
      props.paddingRight = f.paddingRight;
      props.paddingBottom = f.paddingBottom;
      props.paddingLeft = f.paddingLeft;
      props.layoutWrap = f.layoutWrap;
      if (f.layoutWrap === 'WRAP') {
        props.counterAxisSpacing = f.counterAxisSpacing;
      }
    }
  }

  const sn = node as any;
  if (sn.layoutSizingHorizontal !== undefined) props.layoutSizingHorizontal = sn.layoutSizingHorizontal;
  if (sn.layoutSizingVertical !== undefined) props.layoutSizingVertical = sn.layoutSizingVertical;
  if (sn.layoutAlign !== undefined) props.layoutAlign = sn.layoutAlign;
  if (sn.layoutGrow !== undefined) props.layoutGrow = sn.layoutGrow;
  if (sn.minWidth !== undefined) props.minWidth = sn.minWidth;
  if (sn.maxWidth !== undefined) props.maxWidth = sn.maxWidth;
  if (sn.minHeight !== undefined) props.minHeight = sn.minHeight;
  if (sn.maxHeight !== undefined) props.maxHeight = sn.maxHeight;

  if (node.type === 'TEXT') {
    const t = node as TextNode;
    props.characters = t.characters;
    props.fontSize = t.fontSize;
    try { props.fontName = JSON.parse(JSON.stringify(t.fontName)); } catch {}
    try { props.lineHeight = JSON.parse(JSON.stringify(t.lineHeight)); } catch {}
    try { props.letterSpacing = JSON.parse(JSON.stringify(t.letterSpacing)); } catch {}
    props.textAlignHorizontal = t.textAlignHorizontal;
    props.textAlignVertical = t.textAlignVertical;
    props.textAutoResize = t.textAutoResize;
    props.textDecoration = t.textDecoration;
    props.textCase = t.textCase;
    props.paragraphSpacing = t.paragraphSpacing;
    props.textTruncation = t.textTruncation;
    props.maxLines = t.maxLines;
  }

  if (node.type === 'INSTANCE') {
    const inst = node as InstanceNode;
    if (inst.mainComponent) {
      props.mainComponentId = inst.mainComponent.id;
      props.mainComponentName = inst.mainComponent.name;
      if (inst.mainComponent.key) props.mainComponentKey = inst.mainComponent.key;
    }
    try { props.componentProperties = JSON.parse(JSON.stringify(inst.componentProperties)); } catch {}
  }

  if (node.type === 'COMPONENT') {
    const comp = node as ComponentNode;
    props.componentKey = comp.key;
    props.description = comp.description;
    try { props.componentPropertyDefinitions = JSON.parse(JSON.stringify(comp.componentPropertyDefinitions)); } catch {}
  }

  if ('children' in node) {
    props.childCount = (node as ChildrenMixin).children.length;
    props.childIds = (node as ChildrenMixin).children.map((c: SceneNode) => c.id);
  }

  return props;
}

function applyCommonFrameProps(frame: FrameNode | ComponentNode, params: Record<string, unknown>) {
  frame.name = (params.name as string) || frame.name;
  frame.resize(
    (params.width as number) || 100,
    (params.height as number) || 100
  );
  if (params.x != null) frame.x = params.x as number;
  if (params.y != null) frame.y = params.y as number;

  if (params.fillColor) {
    const c = params.fillColor as { r: number; g: number; b: number; a?: number };
    frame.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
  }

  if (params.autoLayout) {
    const al = params.autoLayout as Record<string, unknown>;
    frame.layoutMode = (al.direction as 'HORIZONTAL' | 'VERTICAL') || 'VERTICAL';
    frame.primaryAxisSizingMode = (al.primaryAxisSizingMode as 'FIXED' | 'AUTO') || (al.primarySizing as 'FIXED' | 'AUTO') || 'AUTO';
    frame.counterAxisSizingMode = (al.counterAxisSizingMode as 'FIXED' | 'AUTO') || (al.counterSizing as 'FIXED' | 'AUTO') || 'AUTO';
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
    if (al.layoutWrap) {
      frame.layoutWrap = al.layoutWrap as 'NONE' | 'WRAP';
    }
    if (al.counterAxisSpacing != null) {
      frame.counterAxisSpacing = al.counterAxisSpacing as number;
    }
  }

  if (params.cornerRadius != null) {
    frame.cornerRadius = params.cornerRadius as number;
  }
  if (params.cornerSmoothing != null) {
    frame.cornerSmoothing = params.cornerSmoothing as number;
  }
  if (params.clipsContent != null) {
    frame.clipsContent = params.clipsContent as boolean;
  }

  if (params.parentId) {
    const parent = getNode(params.parentId as string);
    if (parent && 'appendChild' in parent) {
      (parent as FrameNode).appendChild(frame);
    }
  }
}

async function handleCommand(cmd: BridgeCommand): Promise<void> {
  const { id, type, params } = cmd;

  try {
    switch (type) {

      // ── Create tools ───────────────────────────────────────────────

      case 'create_frame': {
        const frame = figma.createFrame();
        frame.name = (params.name as string) || 'Frame';
        applyCommonFrameProps(frame, params);
        respond(id, 'ok', { nodeId: frame.id });
        break;
      }

      case 'create_component': {
        const component = figma.createComponent();
        component.name = (params.name as string) || 'Component';
        applyCommonFrameProps(component, params);
        if (params.description) {
          component.description = params.description as string;
        }
        respond(id, 'ok', { nodeId: component.id, key: component.key });
        break;
      }

      case 'create_instance': {
        let component: ComponentNode;
        if (params.componentKey) {
          component = await figma.importComponentByKeyAsync(params.componentKey as string);
        } else if (params.componentId) {
          const found = getNode(params.componentId as string);
          if (!found || found.type !== 'COMPONENT') {
            respond(id, 'error', undefined, `Component ${params.componentId} not found`);
            break;
          }
          component = found as ComponentNode;
        } else {
          respond(id, 'error', undefined, 'Provide componentKey or componentId');
          break;
        }
        const instance = component.createInstance();
        if (params.name) instance.name = params.name as string;
        if (params.x != null) instance.x = params.x as number;
        if (params.y != null) instance.y = params.y as number;
        if (params.width != null || params.height != null) {
          instance.resize(
            (params.width as number) || instance.width,
            (params.height as number) || instance.height
          );
        }
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(instance);
          }
        }
        respond(id, 'ok', { nodeId: instance.id });
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
          rect.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.cornerRadius != null) rect.cornerRadius = params.cornerRadius as number;
        if (params.cornerSmoothing != null) rect.cornerSmoothing = params.cornerSmoothing as number;
        if (params.topLeftRadius != null) rect.topLeftRadius = params.topLeftRadius as number;
        if (params.topRightRadius != null) rect.topRightRadius = params.topRightRadius as number;
        if (params.bottomRightRadius != null) rect.bottomRightRadius = params.bottomRightRadius as number;
        if (params.bottomLeftRadius != null) rect.bottomLeftRadius = params.bottomLeftRadius as number;
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
        const fontFamily = (params.fontFamily as string) || 'SF Pro';
        const fontStyle = (params.fontStyle as string) || 'Regular';

        await figma.loadFontAsync({ family: 'SF Pro', style: 'Regular' }).catch(() =>
          figma.loadFontAsync({ family: 'Inter', style: 'Regular' })
        );
        if (fontFamily !== 'SF Pro' || fontStyle !== 'Regular') {
          await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
        }

        text.fontName = { family: fontFamily, style: fontStyle };
        text.name = (params.name as string) || 'Text';
        text.characters = (params.text as string) || '';

        if (params.fontSize != null) text.fontSize = params.fontSize as number;

        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          text.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }

        if (params.lineHeight != null) {
          text.lineHeight = { value: params.lineHeight as number, unit: 'PIXELS' };
        }
        if (params.letterSpacing != null) {
          text.letterSpacing = { value: params.letterSpacing as number, unit: 'PIXELS' };
        }
        if (params.textAlignHorizontal) {
          text.textAlignHorizontal = params.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
        }
        if (params.textAlignVertical) {
          text.textAlignVertical = params.textAlignVertical as 'TOP' | 'CENTER' | 'BOTTOM';
        }
        if (params.textAutoResize) {
          text.textAutoResize = params.textAutoResize as 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
        }
        if (params.textDecoration) {
          text.textDecoration = params.textDecoration as 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
        }
        if (params.textCase) {
          text.textCase = params.textCase as 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
        }
        if (params.paragraphSpacing != null) {
          text.paragraphSpacing = params.paragraphSpacing as number;
        }
        if (params.textTruncation) {
          text.textTruncation = params.textTruncation as 'DISABLED' | 'ENDING';
        }
        if (params.maxLines != null) {
          text.maxLines = params.maxLines as number | null;
        }
        if (params.hyperlink) {
          text.hyperlink = params.hyperlink as HyperlinkTarget;
        }

        if (params.x != null) text.x = params.x as number;
        if (params.y != null) text.y = params.y as number;

        if (params.width != null) {
          text.resize(params.width as number, text.height);
          if (!params.textAutoResize) {
            text.textAutoResize = 'HEIGHT';
          }
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
          ellipse.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
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

      case 'create_vector': {
        const vector = figma.createVector();
        vector.name = (params.name as string) || 'Vector';
        if (params.vectorPaths) {
          vector.vectorPaths = params.vectorPaths as VectorPaths;
        }
        if (params.width != null && params.height != null) {
          vector.resize(params.width as number, params.height as number);
        }
        if (params.x != null) vector.x = params.x as number;
        if (params.y != null) vector.y = params.y as number;
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          vector.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.strokeColor) {
          const c = params.strokeColor as { r: number; g: number; b: number; a?: number };
          vector.strokes = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.strokeWeight != null) vector.strokeWeight = params.strokeWeight as number;
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(vector);
          }
        }
        respond(id, 'ok', { nodeId: vector.id });
        break;
      }

      case 'create_line': {
        const line = figma.createLine();
        line.name = (params.name as string) || 'Line';
        if (params.length != null) {
          line.resize(params.length as number, 0);
        }
        if (params.rotation != null) line.rotation = params.rotation as number;
        if (params.x != null) line.x = params.x as number;
        if (params.y != null) line.y = params.y as number;
        if (params.strokeColor) {
          const c = params.strokeColor as { r: number; g: number; b: number; a?: number };
          line.strokes = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.strokeWeight != null) line.strokeWeight = params.strokeWeight as number;
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(line);
          }
        }
        respond(id, 'ok', { nodeId: line.id });
        break;
      }

      case 'create_polygon': {
        const polygon = figma.createPolygon();
        polygon.name = (params.name as string) || 'Polygon';
        if (params.pointCount != null) polygon.pointCount = params.pointCount as number;
        polygon.resize(
          (params.width as number) || 100,
          (params.height as number) || 100
        );
        if (params.x != null) polygon.x = params.x as number;
        if (params.y != null) polygon.y = params.y as number;
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          polygon.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(polygon);
          }
        }
        respond(id, 'ok', { nodeId: polygon.id });
        break;
      }

      case 'create_star': {
        const star = figma.createStar();
        star.name = (params.name as string) || 'Star';
        if (params.pointCount != null) star.pointCount = params.pointCount as number;
        if (params.innerRadius != null) star.innerRadius = params.innerRadius as number;
        star.resize(
          (params.width as number) || 100,
          (params.height as number) || 100
        );
        if (params.x != null) star.x = params.x as number;
        if (params.y != null) star.y = params.y as number;
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          star.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(star);
          }
        }
        respond(id, 'ok', { nodeId: star.id });
        break;
      }

      case 'create_section': {
        const section = figma.createSection();
        section.name = (params.name as string) || 'Section';
        if (params.width != null && params.height != null) {
          section.resizeWithoutConstraints(params.width as number, params.height as number);
        }
        if (params.x != null) section.x = params.x as number;
        if (params.y != null) section.y = params.y as number;
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          section.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        respond(id, 'ok', { nodeId: section.id });
        break;
      }

      case 'insert_svg': {
        const svgString = params.svg as string;
        if (!svgString) { respond(id, 'error', undefined, 'svg string is required'); break; }
        const svgNode = figma.createNodeFromSvg(svgString);
        svgNode.name = (params.name as string) || 'SVG';
        if (params.x != null) svgNode.x = params.x as number;
        if (params.y != null) svgNode.y = params.y as number;
        if (params.width != null && params.height != null) {
          svgNode.resize(params.width as number, params.height as number);
        }
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(svgNode);
          }
        }
        respond(id, 'ok', { nodeId: svgNode.id });
        break;
      }

      // ── Modify tools ───────────────────────────────────────────────

      case 'set_fill': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('fills' in node)) { respond(id, 'error', undefined, 'Node does not support fills'); break; }
        const fillNode = node as GeometryMixin;
        if (params.color) {
          const c = params.color as { r: number; g: number; b: number; a?: number };
          fillNode.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        } else if (params.gradient) {
          const g = params.gradient as {
            type: 'LINEAR' | 'RADIAL';
            angle?: number;
            stops: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
          };
          const transform = g.angle != null
            ? angleToGradientTransform(g.angle)
            : [[1, 0, 0], [0, 1, 0]] as Transform;
          fillNode.fills = [{
            type: `GRADIENT_${g.type}` as 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL',
            gradientStops: g.stops.map(s => ({
              position: s.position,
              color: { ...parseColor(s.color.r, s.color.g, s.color.b), a: s.color.a ?? 1 },
            })),
            gradientTransform: transform,
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
        if (params.textAlignVertical) {
          textNode.textAlignVertical = params.textAlignVertical as 'TOP' | 'CENTER' | 'BOTTOM';
        }
        if (params.textDecoration) {
          textNode.textDecoration = params.textDecoration as 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
        }
        if (params.textCase) {
          textNode.textCase = params.textCase as 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
        }
        if (params.textAutoResize) {
          textNode.textAutoResize = params.textAutoResize as 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
        }
        if (params.paragraphSpacing != null) {
          textNode.paragraphSpacing = params.paragraphSpacing as number;
        }
        if (params.textTruncation) {
          textNode.textTruncation = params.textTruncation as 'DISABLED' | 'ENDING';
        }
        if (params.maxLines != null) {
          textNode.maxLines = params.maxLines as number | null;
        }
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          textNode.fills = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
        }
        respond(id, 'ok', { nodeId: textNode.id });
        break;
      }

      case 'set_text_range': {
        const node = getNode(params.nodeId as string);
        if (!node || node.type !== 'TEXT') {
          respond(id, 'error', undefined, `Text node ${params.nodeId} not found`);
          break;
        }
        const textNode = node as TextNode;
        const start = params.start as number;
        const end = params.end as number;

        if (params.fontFamily || params.fontStyle) {
          const family = (params.fontFamily as string) || (textNode.fontName as FontName).family;
          const style = (params.fontStyle as string) || (textNode.fontName as FontName).style;
          await figma.loadFontAsync({ family, style });
          textNode.setRangeFontName(start, end, { family, style });
        }
        if (params.fontSize != null) textNode.setRangeFontSize(start, end, params.fontSize as number);
        if (params.fillColor) {
          const c = params.fillColor as { r: number; g: number; b: number; a?: number };
          textNode.setRangeFills(start, end, [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }]);
        }
        if (params.textDecoration) {
          textNode.setRangeTextDecoration(start, end, params.textDecoration as TextDecoration);
        }
        if (params.textCase) {
          textNode.setRangeTextCase(start, end, params.textCase as TextCase);
        }
        if (params.letterSpacing != null) {
          textNode.setRangeLetterSpacing(start, end, { value: params.letterSpacing as number, unit: 'PIXELS' });
        }
        if (params.lineHeight != null) {
          textNode.setRangeLineHeight(start, end, { value: params.lineHeight as number, unit: 'PIXELS' });
        }
        if (params.hyperlink) {
          textNode.setRangeHyperlink(start, end, params.hyperlink as HyperlinkTarget);
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
        if (params.layoutWrap) {
          frame.layoutWrap = params.layoutWrap as 'NONE' | 'WRAP';
        }
        if (params.counterAxisSpacing != null) {
          frame.counterAxisSpacing = params.counterAxisSpacing as number;
        }
        respond(id, 'ok', { nodeId: frame.id });
        break;
      }

      case 'set_sizing': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const sn = node as any;
        if (params.layoutSizingHorizontal) sn.layoutSizingHorizontal = params.layoutSizingHorizontal;
        if (params.layoutSizingVertical) sn.layoutSizingVertical = params.layoutSizingVertical;
        if (params.layoutAlign) sn.layoutAlign = params.layoutAlign;
        if (params.layoutGrow != null) sn.layoutGrow = params.layoutGrow;
        if (params.minWidth != null) sn.minWidth = params.minWidth;
        if (params.maxWidth != null) sn.maxWidth = params.maxWidth;
        if (params.minHeight != null) sn.minHeight = params.minHeight;
        if (params.maxHeight != null) sn.maxHeight = params.maxHeight;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_corner_radius': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('cornerRadius' in node)) {
          respond(id, 'error', undefined, 'Node does not support corner radius');
          break;
        }
        const rn = node as RectangleNode;
        if (params.radius != null) rn.cornerRadius = params.radius as number;
        if (params.topLeft != null) rn.topLeftRadius = params.topLeft as number;
        if (params.topRight != null) rn.topRightRadius = params.topRight as number;
        if (params.bottomRight != null) rn.bottomRightRadius = params.bottomRight as number;
        if (params.bottomLeft != null) rn.bottomLeftRadius = params.bottomLeft as number;
        if (params.smoothing != null) rn.cornerSmoothing = params.smoothing as number;
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
          strokeNode.strokes = [{ type: 'SOLID', color: parseColor(c.r, c.g, c.b), opacity: c.a ?? 1 }];
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

      case 'set_opacity': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (params.opacity != null) (node as BlendMixin).opacity = params.opacity as number;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_visible': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        node.visible = params.visible as boolean;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_blend_mode': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        (node as BlendMixin).blendMode = params.blendMode as BlendMode;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_constraints': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('constraints' in node)) {
          respond(id, 'error', undefined, 'Node does not support constraints');
          break;
        }
        const cn = node as ConstraintMixin;
        cn.constraints = {
          horizontal: (params.horizontal as ConstraintType) || cn.constraints.horizontal,
          vertical: (params.vertical as ConstraintType) || cn.constraints.vertical,
        };
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_clip_content': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (!('clipsContent' in node)) {
          respond(id, 'error', undefined, 'Node does not support clipsContent');
          break;
        }
        (node as FrameNode).clipsContent = params.clip as boolean;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'set_instance_properties': {
        const node = getNode(params.nodeId as string);
        if (!node || node.type !== 'INSTANCE') {
          respond(id, 'error', undefined, `Instance node ${params.nodeId} not found`);
          break;
        }
        const instance = node as InstanceNode;
        const properties = params.properties as Record<string, string | boolean>;
        instance.setProperties(properties);
        respond(id, 'ok', { nodeId: instance.id });
        break;
      }

      case 'set_layout_grids': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        if (node.type !== 'FRAME' && node.type !== 'COMPONENT') {
          respond(id, 'error', undefined, 'Node does not support layout grids');
          break;
        }
        (node as FrameNode).layoutGrids = params.grids as LayoutGrid[];
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      // ── Style & Variable tools ─────────────────────────────────────

      case 'apply_style': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const sn = node as any;
        if (params.fillStyleId && 'fillStyleId' in node) sn.fillStyleId = params.fillStyleId;
        if (params.strokeStyleId && 'strokeStyleId' in node) sn.strokeStyleId = params.strokeStyleId;
        if (params.textStyleId && 'textStyleId' in node) sn.textStyleId = params.textStyleId;
        if (params.effectStyleId && 'effectStyleId' in node) sn.effectStyleId = params.effectStyleId;
        if (params.gridStyleId && 'gridStyleId' in node) sn.gridStyleId = params.gridStyleId;
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'apply_variable': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const field = params.field as string;
        const variableId = params.variableId as string;
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) { respond(id, 'error', undefined, `Variable ${variableId} not found`); break; }
        (node as any).setBoundVariable(field, variable);
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      // ── Transform tools ────────────────────────────────────────────

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

      // ── Structural tools ───────────────────────────────────────────

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

      case 'set_parent': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const newParent = getNode(params.parentId as string);
        if (!newParent || !('appendChild' in newParent)) {
          respond(id, 'error', undefined, `Parent ${params.parentId} not found or cannot have children`);
          break;
        }
        const parentFrame = newParent as FrameNode;
        if (params.index != null) {
          parentFrame.insertChild(params.index as number, node);
        } else {
          parentFrame.appendChild(node);
        }
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'boolean_operation': {
        const nodeIds = params.nodeIds as string[];
        const nodes: SceneNode[] = [];
        for (const nid of nodeIds) {
          const n = getNode(nid);
          if (n) nodes.push(n);
        }
        if (nodes.length < 2) {
          respond(id, 'error', undefined, 'Need at least 2 nodes for boolean operation');
          break;
        }
        const op = params.operation as string;
        let result: SceneNode;
        switch (op) {
          case 'union': result = figma.union(nodes, figma.currentPage); break;
          case 'subtract': result = figma.subtract(nodes, figma.currentPage); break;
          case 'intersect': result = figma.intersect(nodes, figma.currentPage); break;
          case 'exclude': result = figma.exclude(nodes, figma.currentPage); break;
          default:
            respond(id, 'error', undefined, `Unknown operation: ${op}`);
            return;
        }
        if (params.name) result.name = params.name as string;
        respond(id, 'ok', { nodeId: result.id });
        break;
      }

      case 'flatten_node': {
        const nodeIds = params.nodeIds as string[];
        const nodes: SceneNode[] = [];
        for (const nid of nodeIds) {
          const n = getNode(nid);
          if (n) nodes.push(n);
        }
        if (nodes.length === 0) {
          respond(id, 'error', undefined, 'No valid nodes to flatten');
          break;
        }
        const flat = figma.flatten(nodes);
        respond(id, 'ok', { nodeId: flat.id });
        break;
      }

      case 'detach_instance': {
        const node = getNode(params.nodeId as string);
        if (!node || node.type !== 'INSTANCE') {
          respond(id, 'error', undefined, `Instance node ${params.nodeId} not found`);
          break;
        }
        const detached = (node as InstanceNode).detachInstance();
        respond(id, 'ok', { nodeId: detached.id });
        break;
      }

      // ── Image tool ─────────────────────────────────────────────────

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
        if (params.cornerRadius != null) rect.cornerRadius = params.cornerRadius as number;
        if (params.parentId) {
          const parent = getNode(params.parentId as string);
          if (parent && 'appendChild' in parent) {
            (parent as FrameNode).appendChild(rect);
          }
        }
        respond(id, 'ok', { nodeId: rect.id, width: targetW, height: targetH });
        break;
      }

      // ── Read tools ─────────────────────────────────────────────────

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

      case 'read_node': {
        const nodeId = params.nodeId as string;
        const node = getNode(nodeId);
        if (!node) { respond(id, 'error', undefined, `Node ${nodeId} not found`); break; }
        const includeChildren = params.includeChildren as boolean;
        const result = serializeFullNode(node);
        if (includeChildren && 'children' in node) {
          result.children = (node as ChildrenMixin).children.map((c: SceneNode) => serializeFullNode(c));
        }
        respond(id, 'ok', result);
        break;
      }

      case 'search_nodes': {
        const allNodes = figma.currentPage.findAll(node => {
          if (params.type && node.type !== params.type) return false;
          if (params.name && node.name !== params.name) return false;
          if (params.nameContains && !node.name.toLowerCase().includes((params.nameContains as string).toLowerCase())) return false;
          return true;
        });
        const limit = (params.limit as number) || 50;
        respond(id, 'ok', {
          nodes: allNodes.slice(0, limit).map(serializeNode),
          total: allNodes.length,
        });
        break;
      }

      case 'list_fonts': {
        const fonts = await figma.listAvailableFontsAsync();
        const query = (params.query as string || '').toLowerCase();
        const filtered = query
          ? fonts.filter(f => f.fontName.family.toLowerCase().includes(query))
          : fonts.slice(0, 500);
        const families = new Map<string, string[]>();
        for (const f of filtered) {
          if (!families.has(f.fontName.family)) families.set(f.fontName.family, []);
          families.get(f.fontName.family)!.push(f.fontName.style);
        }
        const result: Array<{ family: string; styles: string[] }> = [];
        for (const [family, styles] of families) {
          result.push({ family, styles });
        }
        respond(id, 'ok', { fonts: result, count: result.length });
        break;
      }

      case 'read_local_styles': {
        const paintStyles = figma.getLocalPaintStyles().map(s => ({
          id: s.id, name: s.name, key: s.key, type: 'PAINT',
          paints: JSON.parse(JSON.stringify(s.paints)),
        }));
        const textStyles = figma.getLocalTextStyles().map(s => ({
          id: s.id, name: s.name, key: s.key, type: 'TEXT',
          fontName: s.fontName, fontSize: s.fontSize,
          lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
          textDecoration: s.textDecoration, textCase: s.textCase,
        }));
        const effectStyles = figma.getLocalEffectStyles().map(s => ({
          id: s.id, name: s.name, key: s.key, type: 'EFFECT',
          effects: JSON.parse(JSON.stringify(s.effects)),
        }));
        const gridStyles = figma.getLocalGridStyles().map(s => ({
          id: s.id, name: s.name, key: s.key, type: 'GRID',
          grids: JSON.parse(JSON.stringify(s.layoutGrids)),
        }));
        respond(id, 'ok', { paintStyles, textStyles, effectStyles, gridStyles });
        break;
      }

      case 'read_local_variables': {
        const variables = await figma.variables.getLocalVariablesAsync();
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const varData = variables.map(v => ({
          id: v.id, name: v.name, key: v.key,
          resolvedType: v.resolvedType,
          valuesByMode: v.valuesByMode,
          variableCollectionId: v.variableCollectionId,
        }));
        const colData = collections.map(c => ({
          id: c.id, name: c.name, key: c.key,
          modes: c.modes,
          variableIds: c.variableIds,
        }));
        respond(id, 'ok', { variables: varData, collections: colData });
        break;
      }

      case 'list_local_components': {
        const components = figma.currentPage.findAllWithCriteria({ types: ['COMPONENT'] }) as ComponentNode[];
        const result = components.map(c => ({
          id: c.id,
          name: c.name,
          key: c.key,
          description: c.description,
          width: c.width,
          height: c.height,
        }));
        respond(id, 'ok', { components: result, count: result.length });
        break;
      }

      // ── Page & Navigation tools ────────────────────────────────────

      case 'list_pages': {
        const pages = figma.root.children.map(p => ({
          id: p.id,
          name: p.name,
          childCount: p.children.length,
          isCurrent: p.id === figma.currentPage.id,
        }));
        respond(id, 'ok', { pages, count: pages.length });
        break;
      }

      case 'create_page': {
        const page = figma.createPage();
        page.name = (params.name as string) || 'New Page';
        if (params.switchTo) {
          figma.currentPage = page;
        }
        respond(id, 'ok', { pageId: page.id, name: page.name });
        break;
      }

      case 'switch_page': {
        const pageId = params.pageId as string;
        const page = figma.getNodeById(pageId);
        if (!page || page.type !== 'PAGE') {
          respond(id, 'error', undefined, `Page ${pageId} not found`);
          break;
        }
        figma.currentPage = page as PageNode;
        respond(id, 'ok', { pageId: page.id, name: page.name });
        break;
      }

      case 'rename_page': {
        const pageId = params.pageId as string;
        const page = figma.getNodeById(pageId);
        if (!page || page.type !== 'PAGE') {
          respond(id, 'error', undefined, `Page ${pageId} not found`);
          break;
        }
        (page as PageNode).name = (params.name as string) || page.name;
        respond(id, 'ok', { pageId: page.id, name: page.name });
        break;
      }

      case 'set_selection': {
        const nodeIds = params.nodeIds as string[];
        const nodes: SceneNode[] = [];
        for (const nid of nodeIds) {
          const n = getNode(nid);
          if (n) nodes.push(n);
        }
        figma.currentPage.selection = nodes;
        respond(id, 'ok', { selectedCount: nodes.length });
        break;
      }

      case 'zoom_to_node': {
        const nodeIds = params.nodeIds as string[] | undefined;
        const singleId = params.nodeId as string | undefined;
        const ids = nodeIds || (singleId ? [singleId] : []);
        const nodes: SceneNode[] = [];
        for (const nid of ids) {
          const n = getNode(nid);
          if (n) nodes.push(n);
        }
        if (nodes.length === 0) {
          respond(id, 'error', undefined, 'No valid nodes to zoom to');
          break;
        }
        figma.viewport.scrollAndZoomIntoView(nodes);
        respond(id, 'ok', { zoomedTo: nodes.map(n => n.id) });
        break;
      }

      // ── Export tool ────────────────────────────────────────────────

      case 'export_node': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const format = (params.format as 'PNG' | 'SVG' | 'JPG' | 'PDF') || 'PNG';
        const scale = (params.scale as number) || 2;
        const bytes = await (node as ExportMixin).exportAsync({
          format,
          ...(format !== 'SVG' && format !== 'PDF' ? { constraint: { type: 'SCALE', value: scale } } : {}),
        } as ExportSettings);
        const base64 = figma.base64Encode(bytes);
        respond(id, 'ok', { base64, format, size: bytes.byteLength });
        break;
      }

      // ── Plugin Data tools ──────────────────────────────────────────

      case 'set_plugin_data': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        node.setPluginData(params.key as string, params.value as string);
        respond(id, 'ok', { nodeId: node.id });
        break;
      }

      case 'get_plugin_data': {
        const node = getNode(params.nodeId as string);
        if (!node) { respond(id, 'error', undefined, `Node ${params.nodeId} not found`); break; }
        const value = node.getPluginData(params.key as string);
        respond(id, 'ok', { nodeId: node.id, key: params.key, value });
        break;
      }

      // ── Plan tool ──────────────────────────────────────────────────

      case 'send_plan': {
        figma.ui.postMessage({
          type: 'plan_update',
          steps: params.steps,
        });
        respond(id, 'ok');
        break;
      }

      // ── Batch tool ─────────────────────────────────────────────────

      case 'batch': {
        const commands = params.commands as BridgeCommand[];
        if (!commands || commands.length === 0) {
          respond(id, 'error', undefined, 'No commands provided');
          break;
        }
        const results: Array<{ type: string; status: string; data?: unknown; error?: string }> = [];
        for (const cmd of commands) {
          try {
            await handleCommand({ ...cmd, id: cmd.id || id });
          } catch (err) {
            results.push({
              type: cmd.type,
              status: 'error',
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        respond(id, 'ok', { batchSize: commands.length });
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
