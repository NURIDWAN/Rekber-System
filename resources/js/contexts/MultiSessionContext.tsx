import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

interface SessionInfo {
  roomId: number;
  roomNumber: number;
  role: 'buyer' | 'seller';
  cookieName: string;
  userIdentifier: string;
  userName: string;
  action: string;
  timestamp: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface MultiSessionState {
  sessions: SessionInfo[];
  userIdentifier: string | null;
  activeRoomId: number | null;
  currentRole: 'buyer' | 'seller' | null;
  isLoading: boolean;
  error: string | null;
}

type MultiSessionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER_IDENTIFIER'; payload: string }
  | { type: 'ADD_SESSION'; payload: SessionInfo }
  | { type: 'REMOVE_SESSION'; payload: number } // roomId
  | { type: 'UPDATE_SESSION'; payload: { roomId: number; updates: Partial<SessionInfo> } }
  | { type: 'SET_ACTIVE_ROOM'; payload: { roomId: number; role: 'buyer' | 'seller' } }
  | { type: 'CLEAR_ALL_SESSIONS' }
  | { type: 'LOAD_SESSIONS'; payload: SessionInfo[] };

const initialState: MultiSessionState = {
  sessions: [],
  userIdentifier: null,
  activeRoomId: null,
  currentRole: null,
  isLoading: false,
  error: null,
};

function multiSessionReducer(state: MultiSessionState, action: MultiSessionAction): MultiSessionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_USER_IDENTIFIER':
      return { ...state, userIdentifier: action.payload };

    case 'ADD_SESSION':
      // Remove existing session for same room if exists
      const filteredSessions = state.sessions.filter(s => s.roomId !== action.payload.roomId);
      return {
        ...state,
        sessions: [...filteredSessions, action.payload],
        error: null,
      };

    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.roomId !== action.payload),
        // Clear active room if it was the removed one
        activeRoomId: state.activeRoomId === action.payload ? null : state.activeRoomId,
        currentRole: state.activeRoomId === action.payload ? null : state.currentRole,
      };

    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(session =>
          session.roomId === action.payload.roomId
            ? { ...session, ...action.payload.updates }
            : session
        ),
      };

    case 'SET_ACTIVE_ROOM':
      return {
        ...state,
        activeRoomId: action.payload.roomId,
        currentRole: action.payload.role,
      };

    case 'CLEAR_ALL_SESSIONS':
      return {
        ...state,
        sessions: [],
        activeRoomId: null,
        currentRole: null,
      };

    case 'LOAD_SESSIONS':
      return {
        ...state,
        sessions: action.payload,
        isLoading: false,
      };

    default:
      return state;
  }
}

interface MultiSessionContextType extends MultiSessionState {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addSession: (session: SessionInfo) => void;
  removeSession: (roomId: number) => void;
  updateSession: (roomId: number, updates: Partial<SessionInfo>) => void;
  setActiveRoom: (roomId: number, role: 'buyer' | 'seller') => void;
  clearAllSessions: () => void;
  getSessionByRoomId: (roomId: number) => SessionInfo | null;
  getActiveSession: () => SessionInfo | null;
  getOtherActiveSessions: () => SessionInfo[];
  getUserIdentifier: () => string | null;
  migrateLegacySessions: () => void;
  switchRoleInRoom: (roomId: number, newRole: 'buyer' | 'seller') => boolean;
}

const MultiSessionContext = createContext<MultiSessionContextType | undefined>(undefined);

export function MultiSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(multiSessionReducer, initialState);

  // Load sessions and user identifier on mount
  useEffect(() => {
    loadStoredData();
  }, []);

  // Persist sessions to localStorage whenever they change
  useEffect(() => {
    if (state.sessions.length > 0) {
      localStorage.setItem('rekber_sessions', JSON.stringify(state.sessions));
    }
  }, [state.sessions]);

  // Cleanup expired sessions periodically
  useEffect(() => {
    const interval = setInterval(cleanupExpiredSessions, 60000); // Every minute
    return () => clearInterval(interval);
  }, [state.sessions]);

  const loadStoredData = () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Load user identifier from cookie
      const userIdentifier = getCookieValue('rekber_user_identifier');
      if (userIdentifier) {
        dispatch({ type: 'SET_USER_IDENTIFIER', payload: userIdentifier });
      }

      // Load sessions from localStorage
      const storedSessions = localStorage.getItem('rekber_sessions');
      if (storedSessions) {
        const sessions = JSON.parse(storedSessions);

        // Filter out sessions older than 24 hours
        const validSessions = sessions.filter((session: SessionInfo) => {
          const sessionTime = new Date(session.timestamp);
          const now = new Date();
          const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 24;
        });

        dispatch({ type: 'LOAD_SESSIONS', payload: validSessions });

        // Also update cookies for valid sessions
        validSessions.forEach((session: SessionInfo) => {
          updateSessionCookie(session);
        });
      }

      // Migrate legacy sessions if needed
      migrateLegacySessions();

    } catch (error) {
      console.error('Failed to load session data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load session data' });
    }
  };

  const cleanupExpiredSessions = () => {
    const now = new Date();
    state.sessions.forEach(session => {
      const sessionTime = new Date(session.timestamp);
      const hoursDiff = (now.getTime() - sessionTime.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        // Remove session and cookie
        removeSession(session.roomId);
        deleteCookie(session.cookieName);
      }
    });
  };

  const getCookieValue = (name: string): string | null => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  };

  const deleteCookie = (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  const updateSessionCookie = (session: SessionInfo) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (60 * 120 * 1000)); // 2 hours

    document.cookie = `${session.cookieName}=${getCookieValue(session.cookieName)};` +
      `expires=${expires.toUTCString()};` +
      `path=/;` +
      `SameSite=Lax;` +
      (window.location.protocol === 'https:' ? 'Secure;' : '');
  };

  const migrateLegacySessions = () => {
    try {
      // Check for legacy cookie format
      const legacyCookies = document.cookie.split(';').filter(cookie =>
        cookie.trim().startsWith('room_session_') &&
        !cookie.trim().startsWith('room_session_token')
      );

      if (legacyCookies.length > 0) {
        console.log('Found legacy sessions, migrating...');
        // Legacy session migration would be handled by backend
        // Here we just clear old cookies to avoid conflicts
        legacyCookies.forEach(cookie => {
          const cookieName = cookie.split('=')[0].trim();
          if (cookieName !== 'rekber_user_identifier') {
            deleteCookie(cookieName);
          }
        });
      }
    } catch (error) {
      console.error('Failed to migrate legacy sessions:', error);
    }
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

  const addSession = (session: SessionInfo) => {
    dispatch({ type: 'ADD_SESSION', payload: session });
  };

  const removeSession = (roomId: number) => {
    const session = getSessionByRoomId(roomId);
    if (session) {
      deleteCookie(session.cookieName);
    }
    dispatch({ type: 'REMOVE_SESSION', payload: roomId });
  };

  const updateSession = (roomId: number, updates: Partial<SessionInfo>) => {
    dispatch({ type: 'UPDATE_SESSION', payload: { roomId, updates } });
  };

  const setActiveRoom = (roomId: number, role: 'buyer' | 'seller') => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: { roomId, role } });
  };

  const clearAllSessions = () => {
    // Clear all session cookies
    state.sessions.forEach(session => {
      deleteCookie(session.cookieName);
    });

    // Clear localStorage
    localStorage.removeItem('rekber_sessions');

    dispatch({ type: 'CLEAR_ALL_SESSIONS' });
  };

  const getSessionByRoomId = (roomId: number): SessionInfo | null => {
    return state.sessions.find(session => session.roomId === roomId) || null;
  };

  const getActiveSession = (): SessionInfo | null => {
    if (!state.activeRoomId) return null;
    return getSessionByRoomId(state.activeRoomId);
  };

  const getOtherActiveSessions = (): SessionInfo[] => {
    if (!state.activeRoomId) return state.sessions;
    return state.sessions.filter(session => session.roomId !== state.activeRoomId);
  };

  const getUserIdentifier = (): string | null => {
    return state.userIdentifier || getCookieValue('rekber_user_identifier');
  };

  const switchRoleInRoom = (roomId: number, newRole: 'buyer' | 'seller'): boolean => {
    const session = getSessionByRoomId(roomId);
    if (!session || session.role === newRole) {
      return false;
    }

    // Update the session with new role
    const updatedSession = {
      ...session,
      role: newRole,
      cookieName: `rekber_session_${roomId}_${newRole}_${session.userIdentifier.substring(0, 8)}`,
      action: 'role_switch',
      timestamp: new Date().toISOString(),
    };

    // Remove old cookie
    deleteCookie(session.cookieName);

    // Update session
    updateSession(roomId, updatedSession);

    // Update active room if this is the active session
    if (state.activeRoomId === roomId) {
      setActiveRoom(roomId, newRole);
    }

    return true;
  };

  const value: MultiSessionContextType = {
    ...state,
    setLoading,
    setError,
    addSession,
    removeSession,
    updateSession,
    setActiveRoom,
    clearAllSessions,
    getSessionByRoomId,
    getActiveSession,
    getOtherActiveSessions,
    getUserIdentifier,
    migrateLegacySessions,
    switchRoleInRoom,
  };

  return (
    <MultiSessionContext.Provider value={value}>
      {children}
    </MultiSessionContext.Provider>
  );
}

export function useMultiSession() {
  const context = useContext(MultiSessionContext);
  if (context === undefined) {
    throw new Error('useMultiSession must be used within a MultiSessionProvider');
  }
  return context;
}

export default MultiSessionContext;