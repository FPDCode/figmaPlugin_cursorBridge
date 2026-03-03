export type CommandType =
  // Create tools
  | 'create_frame'
  | 'create_rectangle'
  | 'create_text'
  | 'create_ellipse'
  | 'create_component'
  | 'create_instance'
  | 'create_vector'
  | 'create_line'
  | 'create_polygon'
  | 'create_star'
  | 'create_section'
  // Modify tools
  | 'set_fill'
  | 'set_text'
  | 'set_font'
  | 'set_layout'
  | 'set_sizing'
  | 'set_corner_radius'
  | 'set_effects'
  | 'set_stroke'
  | 'set_opacity'
  | 'set_visible'
  | 'set_blend_mode'
  | 'set_constraints'
  | 'set_clip_content'
  | 'set_text_range'
  | 'set_instance_properties'
  | 'set_layout_grids'
  // Style & variable tools
  | 'apply_style'
  | 'apply_variable'
  // Transform tools
  | 'move_node'
  | 'resize_node'
  | 'rename_node'
  // Structural tools
  | 'delete_node'
  | 'duplicate_node'
  | 'group_nodes'
  | 'set_parent'
  | 'boolean_operation'
  | 'flatten_node'
  | 'detach_instance'
  // Image & vector tools
  | 'place_image'
  | 'insert_svg'
  // Read tools
  | 'get_selection'
  | 'get_node_tree'
  | 'read_node'
  | 'search_nodes'
  | 'list_fonts'
  | 'read_local_styles'
  | 'read_local_variables'
  | 'list_local_components'
  // Page & navigation tools
  | 'list_pages'
  | 'create_page'
  | 'switch_page'
  | 'rename_page'
  | 'set_selection'
  | 'zoom_to_node'
  // Export tool
  | 'export_node'
  // Plugin data tools
  | 'set_plugin_data'
  | 'get_plugin_data'
  // Plan/status tools
  | 'send_plan'
  // Batch tool
  | 'batch';

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
