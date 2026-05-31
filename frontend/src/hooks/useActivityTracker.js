import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'stocksense_activity_log';
const IDLE_TIMEOUT_MS = 60000; // 60 seconds idle threshold

const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getStoredData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { sessions: [], stats: { totalSessions: 0, totalTimeSpent: 0, totalSearches: 0, totalAnalyses: 0, mostSearchedStocks: [], peakUsageHours: [], avgSessionDuration: 0 } };
};

const persistData = (data) => {
  try {
    // Keep only the last 50 sessions to avoid localStorage bloat
    if (data.sessions.length > 50) {
      data.sessions = data.sessions.slice(-50);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore quota errors */ }
};

const recalcStats = (sessions) => {
  const totalSessions = sessions.length;
  let totalTimeSpent = 0;
  let totalSearches = 0;
  let totalAnalyses = 0;
  const stockSearchCounts = {};
  const hourCounts = {};

  sessions.forEach(s => {
    totalTimeSpent += s.totalDuration || 0;
    totalSearches += (s.searches || []).length;
    totalAnalyses += (s.analyses || []).length;

    (s.searches || []).forEach(search => {
      const q = (search.selected || search.query || '').toUpperCase();
      if (q) stockSearchCounts[q] = (stockSearchCounts[q] || 0) + 1;
    });

    if (s.loginAt) {
      const h = new Date(s.loginAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });

  const mostSearchedStocks = Object.entries(stockSearchCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const peakUsageHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => parseInt(h));

  const avgSessionDuration = totalSessions > 0 ? Math.round(totalTimeSpent / totalSessions) : 0;

  return { totalSessions, totalTimeSpent, totalSearches, totalAnalyses, mostSearchedStocks, peakUsageHours, avgSessionDuration };
};

const useActivityTracker = (isLoggedIn, loggedInUser) => {
  const [activityData, setActivityData] = useState(getStoredData);
  const sessionRef = useRef(null);
  const idleTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);
  const idleStartRef = useRef(null);
  const tickIntervalRef = useRef(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  // Persist to localStorage whenever activityData changes
  useEffect(() => {
    persistData(activityData);
  }, [activityData]);

  // Start session on login
  useEffect(() => {
    if (isLoggedIn && !sessionRef.current) {
      const newSession = {
        id: generateSessionId(),
        user: loggedInUser || 'unknown',
        loginAt: new Date().toISOString(),
        logoutAt: null,
        totalDuration: 0,
        activeDuration: 0,
        idleDuration: 0,
        focusEvents: [],
        searches: [],
        interactions: [],
        tabSwitches: [],
        modeChanges: [],
        analyses: [],
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          device: window.innerWidth <= 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop'
        }
      };
      sessionRef.current = newSession;
      lastActivityRef.current = Date.now();
      isIdleRef.current = false;

      setActivityData(prev => {
        const updated = { ...prev, sessions: [...prev.sessions, newSession] };
        updated.stats = recalcStats(updated.sessions);
        return updated;
      });

      // Start live session timer
      tickIntervalRef.current = setInterval(() => {
        if (sessionRef.current) {
          const elapsed = Math.floor((Date.now() - new Date(sessionRef.current.loginAt).getTime()) / 1000);
          setSessionElapsed(elapsed);
        }
      }, 1000);
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [isLoggedIn, loggedInUser]);

  // Idle detection
  useEffect(() => {
    if (!isLoggedIn) return;

    const resetIdleTimer = () => {
      lastActivityRef.current = Date.now();
      if (isIdleRef.current) {
        // Resumed from idle
        const idleDuration = idleStartRef.current ? Math.floor((Date.now() - idleStartRef.current) / 1000) : 0;
        if (sessionRef.current) {
          sessionRef.current.idleDuration += idleDuration;
        }
        isIdleRef.current = false;
        idleStartRef.current = null;
      }

      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        idleStartRef.current = Date.now();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [isLoggedIn]);

  // Window focus/blur tracking
  useEffect(() => {
    if (!isLoggedIn) return;

    const handleVisibilityChange = () => {
      if (!sessionRef.current) return;
      const type = document.hidden ? 'blur' : 'focus';
      sessionRef.current.focusEvents.push({ type, at: new Date().toISOString() });
      updateCurrentSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLoggedIn]);

  // Window resize tracking
  useEffect(() => {
    if (!isLoggedIn) return;
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (sessionRef.current) {
          sessionRef.current.viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            device: window.innerWidth <= 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop'
          };
          updateCurrentSession();
        }
      }, 500);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [isLoggedIn]);

  const updateCurrentSession = useCallback(() => {
    if (!sessionRef.current) return;
    setActivityData(prev => {
      const sessions = [...prev.sessions];
      const idx = sessions.findIndex(s => s.id === sessionRef.current.id);
      if (idx >= 0) {
        const now = Date.now();
        const total = Math.floor((now - new Date(sessionRef.current.loginAt).getTime()) / 1000);
        sessionRef.current.totalDuration = total;
        sessionRef.current.activeDuration = total - sessionRef.current.idleDuration;
        sessions[idx] = { ...sessionRef.current };
      }
      const updated = { ...prev, sessions };
      updated.stats = recalcStats(sessions);
      return updated;
    });
  }, []);

  // Periodic save every 30 seconds
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(updateCurrentSession, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, updateCurrentSession]);

  const endSession = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.logoutAt = new Date().toISOString();
    const total = Math.floor((Date.now() - new Date(sessionRef.current.loginAt).getTime()) / 1000);
    sessionRef.current.totalDuration = total;
    sessionRef.current.activeDuration = total - sessionRef.current.idleDuration;
    updateCurrentSession();
    sessionRef.current = null;
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
    setSessionElapsed(0);
  }, [updateCurrentSession]);

  const trackSearch = useCallback((query, selected = null) => {
    if (!sessionRef.current || !query) return;
    sessionRef.current.searches.push({
      query,
      selected: selected || query,
      at: new Date().toISOString()
    });
    updateCurrentSession();
  }, [updateCurrentSession]);

  const trackStockSelect = useCallback((stock) => {
    if (!sessionRef.current || !stock) return;
    sessionRef.current.interactions.push({
      action: 'stock_select',
      section: 'search',
      target: stock,
      at: new Date().toISOString()
    });
    updateCurrentSession();
  }, [updateCurrentSession]);

  const trackTabSwitch = useCallback((from, to) => {
    if (!sessionRef.current) return;
    sessionRef.current.tabSwitches.push({
      from,
      to,
      at: new Date().toISOString()
    });
    updateCurrentSession();
  }, [updateCurrentSession]);

  const trackModeChange = useCallback((from, to) => {
    if (!sessionRef.current) return;
    sessionRef.current.modeChanges.push({
      from,
      to,
      at: new Date().toISOString()
    });
    updateCurrentSession();
  }, [updateCurrentSession]);

  const trackAnalysis = useCallback((stock, mode) => {
    if (!sessionRef.current) return;
    sessionRef.current.analyses.push({
      stock,
      mode,
      at: new Date().toISOString()
    });
    updateCurrentSession();
  }, [updateCurrentSession]);

  const trackInteraction = useCallback((section, target, action = 'click') => {
    if (!sessionRef.current) return;
    sessionRef.current.interactions.push({
      action,
      section,
      target,
      at: new Date().toISOString()
    });
    // Don't call updateCurrentSession for every click to reduce write frequency
  }, []);

  const clearActivityLog = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionRef.current = null;
    setActivityData({ sessions: [], stats: { totalSessions: 0, totalTimeSpent: 0, totalSearches: 0, totalAnalyses: 0, mostSearchedStocks: [], peakUsageHours: [], avgSessionDuration: 0 } });
  }, []);

  return {
    activityData,
    sessionElapsed,
    currentSession: sessionRef.current,
    endSession,
    trackSearch,
    trackStockSelect,
    trackTabSwitch,
    trackModeChange,
    trackAnalysis,
    trackInteraction,
    clearActivityLog
  };
};

export default useActivityTracker;
