export interface AnalyticsEventInput {
  eventType: string;
  projectId?: string | null;
  scenarioVersion?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  nodeId?: string | null;
  buttonId?: string | null;
  targetNodeId?: string | null;
  source?: string | null;
  durationMs?: number | null;
  playbackTimeSec?: number | null;
  progressPct?: number | null;
  timestamp?: string;
  meta?: Record<string, unknown>;
}

const VISITOR_ID_STORAGE_KEY = 'amen_analytics_visitor_id';
const ANALYTICS_EVENTS_ENDPOINT = '/api/analytics/events';

let cachedVisitorId: string | null = null;

const generateId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e9).toString(36)}`;

const getStoredVisitorId = () => {
  if (cachedVisitorId) {
    return cachedVisitorId;
  }

  try {
    const storedValue = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (storedValue && storedValue.trim()) {
      cachedVisitorId = storedValue.trim();
      return cachedVisitorId;
    }
  } catch {
    // ignore localStorage failures
  }

  const generatedValue = generateId('visitor');
  cachedVisitorId = generatedValue;

  try {
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, generatedValue);
  } catch {
    // ignore localStorage failures
  }

  return generatedValue;
};

const sendEvents = async (events: AnalyticsEventInput[]) => {
  if (!events.length) {
    return;
  }

  const payload = JSON.stringify({ events });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(ANALYTICS_EVENTS_ENDPOINT, blob);
      if (sent) {
        return;
      }
    } catch {
      // fallback to fetch
    }
  }

  await fetch(ANALYTICS_EVENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: payload,
    keepalive: true,
  });
};

const enrichEvent = (event: AnalyticsEventInput): AnalyticsEventInput => ({
  ...event,
  visitorId: event.visitorId || getStoredVisitorId(),
  timestamp: event.timestamp || new Date().toISOString(),
});

export const analyticsService = {
  getVisitorId: getStoredVisitorId,
  createSessionId: (prefix = 'session') => generateId(prefix),
  async track(event: AnalyticsEventInput) {
    try {
      await sendEvents([enrichEvent(event)]);
    } catch {
      // analytics is best-effort
    }
  },
  async trackBatch(events: AnalyticsEventInput[]) {
    try {
      await sendEvents(events.map(enrichEvent));
    } catch {
      // analytics is best-effort
    }
  },
};

export default analyticsService;
