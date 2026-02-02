export interface LogEntry {
  timestamp: string;
  action: string;
  details?: any;
}

const logs: LogEntry[] = [];

export const logUserAction = (action: string, details?: any) => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    action,
    details,
  };
  logs.push(entry);
  console.log('[UserAction]', entry);
};

export const downloadLogs = () => {
  const text = logs
    .map(
      (l) =>
        `[${l.timestamp}] ${l.action}${l.details ? ' ' + JSON.stringify(l.details) : ''}`
    )
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user_logs_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
