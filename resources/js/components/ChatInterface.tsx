import React, { useState, useEffect, useRef } from 'react'
import { useRoom } from '@/contexts/RoomContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Bot,
  User,
  Shield
} from 'lucide-react'
import { RoomMessage } from '@/types'
import { format } from 'date-fns'

interface ChatInterfaceProps {
  roomId: number
}

export default function ChatInterface({ roomId }: ChatInterfaceProps) {
  const { selectedRoom, addMessage } = useRoom()
  const { currentUser } = useAuth()
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [selectedRoom?.messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!message.trim() || !currentUser || !selectedRoom) {
      return
    }

    setIsLoading(true)

    try {
      // Simulate API call to send message
      await new Promise(resolve => setTimeout(resolve, 500))

      const newMessage: RoomMessage = {
        id: Date.now(), // Temporary ID, would come from backend
        room_id: roomId,
        user_name: currentUser.name,
        role: currentUser.role as 'buyer' | 'seller' | 'gm',
        message: message.trim(),
        type: 'text',
        created_at: new Date().toISOString()
      }

      // Add message to local state (will also be received via WebSocket)
      addMessage(newMessage)

      // Clear input
      setMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !selectedRoom) return

    // Check file type and size
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed')
      return
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size must be less than 5MB')
      return
    }

    // Simulate file upload
    setIsLoading(true)

    setTimeout(() => {
      const newMessage: RoomMessage = {
        id: Date.now(),
        room_id: roomId,
        user_name: currentUser.name,
        role: currentUser.role as 'buyer' | 'seller' | 'gm',
        message: `Shared an image: ${file.name}`,
        type: 'image',
        file_path: URL.createObjectURL(file), // Temporary URL
        created_at: new Date().toISOString()
      }

      addMessage(newMessage)
      setIsLoading(false)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }, 1000)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'gm':
        return <Shield className="w-3 h-3" />
      case 'buyer':
      case 'seller':
        return <User className="w-3 h-3" />
      default:
        return <Bot className="w-3 h-3" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'gm':
        return 'bg-purple-100 text-purple-800'
      case 'buyer':
        return 'bg-blue-100 text-blue-800'
      case 'seller':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatMessageTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm')
    } catch {
      return ''
    }
  }

  if (!selectedRoom) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Loading chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0 p-4">
        <div className="space-y-4">
          {selectedRoom.messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start a conversation</p>
            </div>
          ) : (
            selectedRoom.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${
                  msg.user_name === currentUser?.name ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">
                    {msg.user_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className={`max-w-xs lg:max-w-md ${
                  msg.user_name === currentUser?.name ? 'items-end' : 'items-start'
                }`}>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-medium text-gray-900">
                      {msg.user_name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getRoleColor(msg.role)}`}
                    >
                      {getRoleIcon(msg.role)}
                      <span className="ml-1">{msg.role}</span>
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatMessageTime(msg.created_at)}
                    </span>
                  </div>

                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.user_name === currentUser?.name
                        ? 'bg-blue-600 text-white'
                        : msg.type === 'system'
                        ? 'bg-gray-100 text-gray-700 border border-gray-200'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {msg.type === 'text' ? (
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    ) : msg.type === 'image' ? (
                      <div className="space-y-2">
                        <p className="text-xs opacity-75">📷 {msg.message}</p>
                        {msg.file_path && (
                          <img
                            src={msg.file_path}
                            alt="Shared image"
                            className="rounded max-w-full h-auto"
                            loading="lazy"
                          />
                        )}
                      </div>
                    ) : (
                      <p className="italic text-xs">{msg.message}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading}
            className="flex-1"
            maxLength={1000}
          />

          <Button
            type="submit"
            size="sm"
            disabled={!message.trim() || isLoading}
            className="flex-shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            Press Enter to send • Images only • Max 5MB
          </p>
          {message.length > 800 && (
            <p className="text-xs text-orange-600">
              {message.length}/1000
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
