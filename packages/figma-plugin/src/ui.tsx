import { render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { PlanStep, LogEntry } from './types';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const WS_URL = 'ws://localhost:9100';
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 30000;

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-99), { timestamp: Date.now(), level, message }]);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const isReconnect = reconnectAttemptRef.current > 0;
    setConnectionState(isReconnect ? 'reconnecting' : 'connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
      addLog('success', 'Connected to Cursor Bridge');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'plan_update') {
          setPlanSteps(data.steps || []);
          return;
        }

        if (data.type === 'step_update' && data.index != null) {
          setPlanSteps(prev => {
            const next = [...prev];
            if (next[data.index]) {
              next[data.index] = { ...next[data.index], status: data.status };
            }
            return next;
          });
          return;
        }

        parent.postMessage({ pluginMessage: data }, '*');
        addLog('info', `→ ${data.type || 'command'}`);
      } catch {
        addLog('error', 'Failed to parse message from bridge');
      }
    };

    ws.onclose = () => {
      setConnectionState('disconnected');
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      addLog('error', 'Connection error');
    };
  }, [addLog]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    reconnectAttemptRef.current += 1;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(1.5, reconnectAttemptRef.current - 1),
      RECONNECT_MAX_MS
    );

    setConnectionState('reconnecting');
    addLog('info', `Reconnecting in ${Math.round(delay / 1000)}s...`);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, addLog]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  useEffect(() => {
    window.onmessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (msg && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));

        if (msg.status === 'ok') {
          addLog('success', `✓ completed`);
        } else if (msg.status === 'error') {
          addLog('error', `✗ ${msg.error || 'failed'}`);
        }
      }
    };

    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect, addLog]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const completedSteps = planSteps.filter(s => s.status === 'completed').length;
  const totalSteps = planSteps.length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={{
            ...styles.statusDot,
            backgroundColor: connectionState === 'connected' ? '#1bc47d'
              : connectionState === 'reconnecting' || connectionState === 'connecting' ? '#f5a623'
              : '#f45252',
          }} />
          <span style={styles.headerTitle}>Cursor Bridge</span>
        </div>
        <button
          style={styles.headerBtn}
          onClick={() => connectionState === 'connected' ? disconnect() : connect()}
        >
          {connectionState === 'connected' ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Plan progress */}
      {planSteps.length > 0 && (
        <div style={styles.planSection}>
          <div style={styles.planHeader}>
            <span style={styles.planTitle}>Progress</span>
            <span style={styles.planCount}>{completedSteps}/{totalSteps}</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: totalSteps > 0 ? `${(completedSteps / totalSteps) * 100}%` : '0%',
            }} />
          </div>
          <div style={styles.stepList}>
            {planSteps.map((step, i) => (
              <div key={i} style={styles.stepItem}>
                <span style={styles.stepIcon}>
                  {step.status === 'completed' ? '✓'
                    : step.status === 'in_progress' ? '⟳'
                    : step.status === 'error' ? '✗'
                    : '○'}
                </span>
                <span style={{
                  ...styles.stepLabel,
                  opacity: step.status === 'pending' ? 0.5 : 1,
                  textDecoration: step.status === 'completed' ? 'line-through' : 'none',
                  color: step.status === 'error' ? '#f45252' : 'var(--figma-color-text)',
                }}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      <div style={styles.logSection}>
        <div style={styles.logHeader}>Activity</div>
        <div style={styles.logList}>
          {logs.length === 0 && (
            <div style={styles.emptyLog}>Waiting for connection...</div>
          )}
          {logs.map((log, i) => (
            <div key={i} style={{
              ...styles.logItem,
              color: log.level === 'error' ? '#f45252'
                : log.level === 'success' ? '#1bc47d'
                : 'var(--figma-color-text-secondary)',
            }}>
              <span style={styles.logTime}>
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, Record<string, string | number>> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '12px',
    backgroundColor: 'var(--figma-color-bg)',
    color: 'var(--figma-color-text)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid var(--figma-color-border)',
    flexShrink: '0',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: '0',
  },
  headerTitle: {
    fontWeight: '600',
    fontSize: '13px',
  },
  headerBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid var(--figma-color-border)',
    background: 'var(--figma-color-bg-secondary)',
    color: 'var(--figma-color-text)',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: '500',
  },
  planSection: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--figma-color-border)',
    flexShrink: '0',
  },
  planHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  planTitle: {
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: '0.7',
  },
  planCount: {
    fontSize: '11px',
    opacity: '0.7',
  },
  progressBar: {
    height: '4px',
    backgroundColor: 'var(--figma-color-bg-tertiary)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1bc47d',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '140px',
    overflowY: 'auto',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  stepIcon: {
    width: '14px',
    textAlign: 'center',
    fontSize: '11px',
    flexShrink: '0',
  },
  stepLabel: {
    fontSize: '12px',
  },
  logSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
    minHeight: '0',
    padding: '10px 12px',
  },
  logHeader: {
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    opacity: '0.7',
    marginBottom: '6px',
    flexShrink: '0',
  },
  logList: {
    flex: '1',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  logItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    lineHeight: '1.5',
  },
  logTime: {
    opacity: '0.4',
    flexShrink: '0',
    fontFamily: 'monospace',
    fontSize: '10px',
  },
  emptyLog: {
    opacity: '0.4',
    fontStyle: 'italic',
    padding: '8px 0',
  },
};

render(<App />, document.getElementById('root')!);
