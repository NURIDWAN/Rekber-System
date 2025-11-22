import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Users } from 'lucide-react';
import WebSocketClient, { WebSocketMessage } from '../lib/websocket';

interface StreamingChatProps {
  wsClient: WebSocketClient;
  roomId: string;
  userId: string;
  userName: string;
  className?: string;
}

interface TypingUser {
  userId: string;
  userName: string;
  isTyping: boolean;
  lastSeen: Date;
}

interface VoiceCallState {
  isActive: boolean;
  isMuted: boolean;
  participants: string[];
  startTime?: Date;
}

interface VideoCallState {
  isActive: boolean;
  isEnabled: boolean;
  participants: string[];
  startTime?: Date;
}

export default function StreamingChat({
  wsClient,
  roomId,
  userId,
  userName,
  className = ''
}: StreamingChatProps) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>({});
  const [isTyping, setIsTyping] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);
  const [voiceCall, setVoiceCall] = useState<VoiceCallState>({
    isActive: false,
    isMuted: false,
    participants: []
  });
  const [videoCall, setVideoCall] = useState<VideoCallState>({
    isActive: false,
    isEnabled: false,
    participants: []
  });
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup WebSocket event listeners
  useEffect(() => {
    const handleMessage = (message: WebSocketMessage) => {
      setMessages(prev => [...prev, message]);
    };

    const handleTyping = (data: any) => {
      if (data.user_id !== userId) {
        setTypingUsers(prev => {
          const existing = prev.find(u => u.userId === data.user_id);
          if (existing) {
            return prev.map(u =>
              u.userId === data.user_id
                ? { ...u, isTyping: data.data?.is_typing, lastSeen: new Date() }
                : u
            );
          } else {
            return [...prev, {
              userId: data.user_id,
              userName: data.user_name || `User ${data.user_id}`,
              isTyping: data.data?.is_typing,
              lastSeen: new Date()
            }];
          }
        });
      }
    };

    const handleUserStatus = (data: any) => {
      if (data.activity === 'user_joined' || data.activity === 'user_left') {
        setConnectedUsers(prev => {
          if (data.activity === 'user_joined') {
            return prev.includes(data.user_id) ? prev : [...prev, data.user_id];
          } else {
            return prev.filter(id => id !== data.user_id);
          }
        });
      }
    };

    wsClient.on('message', handleMessage);
    wsClient.on('typing', handleTyping);
    wsClient.on('userStatus', handleUserStatus);

    // Load initial messages
    loadInitialMessages();

    // Cleanup typing indicators
    const typingCleanup = setInterval(() => {
      setTypingUsers(prev =>
        prev.filter(user =>
          user.isTyping && (new Date().getTime() - user.lastSeen.getTime()) < 3000
        )
      );
    }, 1000);

    return () => {
      wsClient.off('message', handleMessage);
      wsClient.off('typing', handleTyping);
      wsClient.off('userStatus', handleUserStatus);
      clearInterval(typingCleanup);
    };
  }, [wsClient, userId]);

  const loadInitialMessages = async () => {
    // This would call an API to get initial messages
    // For now, we'll use the session storage from our WebSocket service
    try {
      const response = await fetch(`/api/rooms/${roomId}/messages`);
      if (response.ok) {
        const initialMessages = await response.json();
        setMessages(initialMessages);
      }
    } catch (error) {
      console.error('Failed to load initial messages:', error);
    }
  };

  const handleSendMessage = useCallback(() => {
    if (messageInput.trim() && wsClient.isConnected()) {
      wsClient.sendMessage({
        message: messageInput.trim(),
        type: 'message'
      });
      setMessageInput('');
      stopTyping();
    }
  }, [messageInput, wsClient]);

  const handleTypingStart = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      wsClient.sendTypingIndicator(true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  }, [isTyping, wsClient]);

  const stopTyping = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      wsClient.sendTypingIndicator(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, wsClient]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      try {
        // Simulate upload progress
        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        }

        await wsClient.sendFile(file, {
          uploaded_by: userName,
          upload_time: new Date().toISOString()
        });

        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });

      } catch (error) {
        console.error('File upload failed:', error);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[file.name];
          return newProgress;
        });
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [wsClient, userName]);

  const startVoiceCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      setVoiceCall({
        isActive: true,
        isMuted: false,
        participants: [userId],
        startTime: new Date()
      });

      wsClient.sendActivity('voice_call_started', {
        participants: [userId],
        room_id: roomId
      });

    } catch (error) {
      console.error('Failed to start voice call:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  }, [wsClient, userId, roomId]);

  const endVoiceCall = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setVoiceCall({
      isActive: false,
      isMuted: false,
      participants: []
    });

    wsClient.sendActivity('voice_call_ended', {
      duration: voiceCall.startTime
        ? Math.floor((new Date().getTime() - voiceCall.startTime.getTime()) / 1000)
        : 0
    });
  }, [wsClient, voiceCall.startTime]);

  const toggleMute = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setVoiceCall(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, []);

  const startVideoCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      videoStreamRef.current = stream;

      setVideoCall({
        isActive: true,
        isEnabled: true,
        participants: [userId],
        startTime: new Date()
      });

      wsClient.sendActivity('video_call_started', {
        participants: [userId],
        room_id: roomId
      });

    } catch (error) {
      console.error('Failed to start video call:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
    }
  }, [wsClient, userId, roomId]);

  const endVideoCall = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }

    setVideoCall({
      isActive: false,
      isEnabled: false,
      participants: []
    });

    wsClient.sendActivity('video_call_ended', {
      duration: videoCall.startTime
        ? Math.floor((new Date().getTime() - videoCall.startTime.getTime()) / 1000)
        : 0
    });
  }, [wsClient, videoCall.startTime]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCallDuration = (startTime: Date) => {
    const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex flex-col h-full bg-white border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-gray-500" />
          <span className="font-medium">Chat Room {roomId}</span>
          <span className="text-sm text-gray-500">({connectedUsers.length} online)</span>
        </div>

        {/* Call controls */}
        <div className="flex items-center space-x-2">
          {voiceCall.isActive ? (
            <div className="flex items-center space-x-1">
              <span className="text-sm text-green-600">
                📞 {formatCallDuration(voiceCall.startTime!)}
              </span>
              <button
                onClick={toggleMute}
                className={`p-2 rounded ${voiceCall.isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}
                title={voiceCall.isMuted ? 'Unmute' : 'Mute'}
              >
                {voiceCall.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={endVoiceCall}
                className="p-2 bg-red-100 text-red-600 rounded"
                title="End call"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={startVoiceCall}
              className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200"
              title="Start voice call"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {videoCall.isActive ? (
            <div className="flex items-center space-x-1">
              <span className="text-sm text-blue-600">
                📹 {formatCallDuration(videoCall.startTime!)}
              </span>
              <button
                onClick={endVideoCall}
                className="p-2 bg-red-100 text-red-600 rounded"
                title="End video call"
              >
                <VideoOff className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={startVideoCall}
              className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
              title="Start video call"
            >
              <Video className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.user_id === userId ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.user_id === userId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.user_id !== userId && (
                <div className="text-xs font-semibold mb-1 opacity-75">
                  {message.user_id}
                </div>
              )}

              {message.type === 'file' && message.data ? (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-sm font-medium">{message.message}</span>
                  </div>
                  {message.data.size && (
                    <div className="text-xs opacity-75">
                      {Math.round(message.data.size / 1024)} KB
                    </div>
                  )}
                </div>
              ) : message.type === 'activity' ? (
                <div className="text-sm italic">
                  📢 {message.message}
                </div>
              ) : (
                <div className="text-sm break-words">{message.message}</div>
              )}

              <div className={`text-xs mt-1 ${message.user_id === userId ? 'text-blue-100' : 'text-gray-500'}`}>
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicators */}
        {typingUsers.filter(u => u.isTyping).length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg">
              <div className="text-sm text-gray-600">
                {typingUsers.filter(u => u.isTyping).map(u => u.userName).join(', ')}
                {typingUsers.filter(u => u.isTyping).length === 1 ? ' is' : ' are'} typing...
              </div>
              <div className="flex space-x-1 mt-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {Object.entries(uploadProgress).map(([filename, progress]) => (
          <div key={filename} className="flex justify-start">
            <div className="bg-gray-100 px-4 py-2 rounded-lg max-w-xs">
              <div className="text-sm text-gray-600 mb-1">Uploading {filename}...</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
            accept="*/*"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            onFocus={handleTypingStart}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!wsClient.isConnected()}
          />

          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !wsClient.isConnected()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {!wsClient.isConnected() && (
          <div className="mt-2 text-sm text-red-600 text-center">
            Connection lost. Messages will be queued.
          </div>
        )}
      </div>
    </div>
  );
}