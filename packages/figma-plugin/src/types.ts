export type CommandType =
  | 'create_frame'
  | 'create_rectangle'
  | 'create_text'
  | 'create_ellipse'
  | 'set_fill'
  | 'set_text'
  | 'set_font'
  | 'set_layout'
  | 'set_corner_radius'
  | 'set_effects'
  | 'set_stroke'
  | 'move_node'
  | 'resize_node'
  | 'rename_node'
  | 'delete_node'
  | 'duplicate_node'
  | 'group_nodes'
  | 'place_image'
  | 'get_selection'
  | 'get_node_tree'
  | 'send_plan';

export interface BridgeCommand {
  id: string;
  type: CommandType;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  status: 'ok' | 'error';
  data?: unknown;
  error?: string;
}

export interface PlanStep {
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

export interface PlanMessage {
  id: string;
  type: 'send_plan';
  params: {
    steps: PlanStep[];
  };
}

export interface StatusUpdate {
  type: 'status_update';
  connectionState: 'connected' | 'disconnected' | 'reconnecting';
}

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'success';
  message: string;
}
