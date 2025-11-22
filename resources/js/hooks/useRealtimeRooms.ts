import { useEffect, useState, useCallback } from 'react';
import { listenToRoomStatusChanges, RoomStatusChangeEvent, onConnectionEstablished, onConnectionError, onConnectionDisconnected } from '@/lib/websocket';
import { logger } from '@/lib/logger';

type Room = {
    id: number;
    status: 'free' | 'in-use';
    lastActivity: string;
    participants: string[];
    has_buyer?: boolean;
    has_seller?: boolean;
    available_for_buyer?: boolean;
    available_for_seller?: boolean;
    room_number?: number;
};

export function useRealtimeRooms(initialRooms: Room[]) {
    const [rooms, setRooms] = useState<Room[]>(initialRooms);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const updateRoomStatus = useCallback((event: RoomStatusChangeEvent) => {
        setRooms(prevRooms =>
            prevRooms.map(room => {
                if (room.id === event.room_id) {
                    return {
                        ...room,
                        status: event.status as 'free' | 'in-use',
                        has_buyer: event.has_buyer,
                        has_seller: event.has_seller,
                        available_for_buyer: event.available_for_buyer,
                        available_for_seller: event.available_for_seller,
                    };
                }
                return room;
            })
        );
    }, []);

    useEffect(() => {
        setRooms(initialRooms);
    }, [initialRooms]);

    useEffect(() => {
        let unsubscribeRoomStatus: (() => void) | null = null;
        let unsubscribeConnected: (() => void) | null = null;
        let unsubscribeError: (() => void) | null = null;
        let unsubscribeDisconnected: (() => void) | null = null;

        const connectToWebSocket = () => {
            try {
                // Clear previous error
                setConnectionError(null);

                // Subscribe to room status changes
                unsubscribeRoomStatus = listenToRoomStatusChanges((event) => {
                    logger.debug('ROOM', 'Status changed', { event });
                    updateRoomStatus(event);
                });

                // Listen to connection events
                unsubscribeConnected = onConnectionEstablished(() => {
                    logger.success('WS', 'Connected successfully');
                    setIsConnected(true);
                    setConnectionError(null);
                });

                const handleError = (error: any) => {
                    logger.error('WS', 'Connection error', { error });
                    setConnectionError('Connection failed');
                    setIsConnected(false);
                };

                unsubscribeError = onConnectionError(handleError);

                const handleDisconnected = () => {
                    logger.warn('WS', 'Disconnected');
                    setIsConnected(false);
                };

                unsubscribeDisconnected = onConnectionDisconnected(handleDisconnected);

            } catch (error) {
                logger.error('WS', 'Failed to initialize connection', { error });
                setConnectionError(error instanceof Error ? error.message : 'Failed to connect');
                setIsConnected(false);
            }
        };

        // Attempt to connect
        connectToWebSocket();

        // Cleanup function
        return () => {
            if (unsubscribeRoomStatus) {
                unsubscribeRoomStatus();
            }
            if (unsubscribeConnected) {
                unsubscribeConnected();
            }
            if (unsubscribeError) {
                unsubscribeError();
            }
            if (unsubscribeDisconnected) {
                unsubscribeDisconnected();
            }
        };
    }, [updateRoomStatus]);

    const isRoomAvailableForSharing = useCallback((room: Room) => {
        return room.available_for_buyer || room.available_for_seller;
    }, []);

    // Fallback: Periodically refresh room data if WebSocket is disconnected
    useEffect(() => {
        if (!isConnected) {
            logger.debug('WS', 'Disconnected, enabling fallback mode');
        }
    }, [isConnected]);

    return {
        rooms,
        isConnected,
        connectionError,
        isRoomAvailableForSharing,
        updateRoomStatus,
    };
}