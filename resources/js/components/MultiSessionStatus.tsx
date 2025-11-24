import React from 'react';
import { useMultiSession } from '@/contexts/MultiSessionContext';
import { Users, User, ArrowRight, X, RefreshCw } from 'lucide-react';

interface MultiSessionStatusProps {
  currentRoomId?: number;
  onSwitchRoom?: (roomId: number, role: 'buyer' | 'seller') => void;
  showInactive?: boolean;
}

export default function MultiSessionStatus({
  currentRoomId,
  onSwitchRoom,
  showInactive = false
}: MultiSessionStatusProps) {
  const {
    sessions,
    activeRoomId,
    currentRole,
    getOtherActiveSessions,
    removeSession,
    switchRoleInRoom,
    isLoading,
  } = useMultiSession();

  const otherSessions = getOtherActiveSessions();
  const currentSession = currentRoomId ? sessions.find(s => s.roomId === currentRoomId) : null;

  if (sessions.length === 0 || isLoading) {
    return null;
  }

  const handleSwitchRoom = (roomId: number, role: 'buyer' | 'seller') => {
    if (onSwitchRoom) {
      onSwitchRoom(roomId, role);
    } else {
      // Default navigation
      window.location.href = `/rooms/${roomId}`;
    }
  };

  const handleSwitchRole = (roomId: number, currentRole: 'buyer' | 'seller') => {
    const newRole = currentRole === 'buyer' ? 'seller' : 'buyer';
    const success = switchRoleInRoom(roomId, newRole);

    if (success) {
      // Refresh the page to apply the role switch
      window.location.reload();
    }
  };

  const handleLeaveRoom = (roomId: number) => {
    if (window.confirm('Are you sure you want to leave this room?')) {
      removeSession(roomId);
      if (currentRoomId === roomId) {
        // Redirect to rooms list if leaving current room
        window.location.href = '/rooms';
      }
    }
  };

  const getRoleIcon = (role: 'buyer' | 'seller') => {
    return role === 'buyer' ? (
      <User className="w-4 h-4 text-blue-600" />
    ) : (
      <Users className="w-4 h-4 text-purple-600" />
    );
  };

  const getRoleColor = (role: 'buyer' | 'seller') => {
    return role === 'buyer' ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Active Sessions</h3>
            <span className="text-sm text-gray-500">({sessions.length})</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Current Session */}
        {currentSession && (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {getRoleIcon(currentSession.role)}
                  <div>
                    <div className="font-medium text-gray-900">
                      Room #{currentSession.roomNumber} - {currentSession.role}
                    </div>
                    <div className="text-sm text-gray-600">
                      {currentSession.userName} • Currently Active
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSwitchRole(currentSession.roomId, currentSession.role)}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="Switch role"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Other Active Sessions */}
        {otherSessions.map((session) => (
          <div key={session.roomId} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {getRoleIcon(session.role)}
                  <div>
                    <div className="font-medium text-gray-900">
                      Room #{session.roomNumber} - {session.role}
                    </div>
                    <div className="text-sm text-gray-600">
                      {session.userName} • Joined {new Date(session.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSwitchRoom(session.roomId, session.role)}
                  className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  title="Switch to this room"
                >
                  <ArrowRight className="w-3 h-3" />
                  Switch
                </button>
                <button
                  onClick={() => handleLeaveRoom(session.roomId)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Leave room"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!currentSession && otherSessions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No active sessions</p>
          </div>
        )}

        {/* Session Summary */}
        {sessions.length > 1 && (
          <div className="p-3 bg-gray-50 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Multi-session active</span>
              <span>{sessions.length} room{sessions.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {sessions.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              <span className="font-medium">Quick Actions:</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.href = '/rooms'}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Browse Rooms
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Clear all active sessions?')) {
                    window.location.href = '/rooms';
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}