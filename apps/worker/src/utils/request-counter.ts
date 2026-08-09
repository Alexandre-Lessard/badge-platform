let count = 0;
let lastMinuteCount = 0;
let lastReset = Date.now();

export function incrementRequestCount() {
  count++;
}

export function getRequestsPerMinute(): number {
  const now = Date.now();
  if (now - lastReset >= 60000) {
    lastMinuteCount = count;
    count = 0;
    lastReset = now;
  }
  return lastMinuteCount;
}
