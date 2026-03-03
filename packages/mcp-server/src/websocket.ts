import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export interface BridgeCommand {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export interface BridgeResponse {
  id: string;
  status: 'ok' | 'error';
  data?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (response: BridgeResponse) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class FigmaBridge {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private port: number;

  constructor(port = 9100) {
    this.port = port;
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      if (this.client && this.client.readyState === WebSocket.OPEN) {
        this.client.close(1000, 'replaced by new connection');
      }
      this.client = ws;
      this.log('Figma plugin connected');

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as BridgeResponse;
          const req = this.pending.get(msg.id);
          if (req) {
            clearTimeout(req.timer);
            this.pending.delete(msg.id);
            req.resolve(msg);
          }
        } catch {
          this.log('Failed to parse message from plugin');
        }
      });

      ws.on('close', () => {
        if (this.client === ws) {
          this.client = null;
          this.log('Figma plugin disconnected');
          this.rejectAllPending('Plugin disconnected');
        }
      });

      ws.on('error', (err) => {
        this.log(`WebSocket error: ${err.message}`);
      });
    });

    this.wss.on('listening', () => {
      this.log(`WebSocket server listening on port ${this.port}`);
    });
  }

  get isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  async send(type: string, params: Record<string, unknown> = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<BridgeResponse> {
    if (!this.isConnected) {
      return {
        id: '',
        status: 'error',
        error: 'Figma plugin is not connected. Open the Cursor Bridge plugin in Figma Desktop.',
      };
    }

    const id = randomUUID();
    const command: BridgeCommand = { id, type, params };

    return new Promise<BridgeResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({
          id,
          status: 'error',
          error: `Command timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.client!.send(JSON.stringify(command));
    });
  }

  sendPlan(steps: Array<{ label: string; status: string }>) {
    if (!this.isConnected) return;
    this.client!.send(JSON.stringify({
      type: 'plan_update',
      steps,
    }));
  }

  updateStep(index: number, status: string) {
    if (!this.isConnected) return;
    this.client!.send(JSON.stringify({
      type: 'step_update',
      index,
      status,
    }));
  }

  private rejectAllPending(reason: string) {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.resolve({ id, status: 'error', error: reason });
    }
    this.pending.clear();
  }

  async close() {
    this.rejectAllPending('Server shutting down');
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    return new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  private log(msg: string) {
    process.stderr.write(`[cursor-bridge] ${msg}\n`);
  }
}
