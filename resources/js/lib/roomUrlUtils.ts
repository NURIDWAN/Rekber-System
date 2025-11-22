/**
 * Utility functions for handling encrypted room URLs in frontend
 *
 * NOTE: Frontend encryption is only for demo/fallback purposes.
 * Production should always use server-generated encrypted URLs.
 */

/**
 * Simple encryption for room ID (demo/fallback only - use server-side for production)
 */
export function encryptRoomId(roomId: number): string {
    const payload = JSON.stringify({
        room_id: roomId,
        timestamp: Date.now(),
        type: 'room_id'
    });

    // Simple base64 encoding (in production, use proper encryption)
    const encoded = btoa(payload);
    return `rm_${encoded}`;
}

/**
 * Check if an ID is encrypted
 */
export function isEncryptedId(id: string): boolean {
    return id.startsWith('rm_');
}

/**
 * Generate encrypted room URL
 */
export function generateRoomUrl(roomId: number): string {
    // Backend accepts numeric IDs; encrypted URLs are provided separately via `encrypted_urls`
    return `/rooms/${roomId}`;
}

/**
 * Generate encrypted room join URL
 */
export function generateRoomJoinUrl(roomId: number, role: 'buyer' | 'seller' = 'buyer'): string {
    return `/rooms/${roomId}/join?role=${role}`;
}

/**
 * Get room URL with fallback to encrypted if available
 */
export function getRoomUrl(room: { id: number; encrypted_urls?: { show?: string } }): string {
    // Prioritize server-generated encrypted URLs
    if (room.encrypted_urls?.show) {
        return room.encrypted_urls.show;
    }

    // Fallback to client-side generation (demo only)
    console.warn('Using fallback encryption for room URL - server should provide encrypted_urls');
    return generateRoomUrl(room.id);
}

/**
 * Get join URL with fallback to encrypted if available
 */
export function getJoinUrl(room: {
    id: number;
    available_for_buyer?: boolean;
    available_for_seller?: boolean;
    encrypted_urls?: {
        join?: string;
        join_seller?: string;
    };
}): { url: string; label: string } | null {
    const isBuyerAvailable = room.available_for_buyer;
    const isSellerAvailable = room.available_for_seller;

    if (isBuyerAvailable) {
        return {
            // Prioritize server-generated encrypted URLs
            url: room.encrypted_urls?.join || (() => {
                console.warn('Using fallback encryption for join URL - server should provide encrypted_urls');
                return generateRoomJoinUrl(room.id, 'buyer');
            })(),
            label: 'Join as Buyer'
        };
    }

    if (isSellerAvailable) {
        return {
            // Prioritize server-generated encrypted URLs
            url: room.encrypted_urls?.join_seller || (() => {
                console.warn('Using fallback encryption for join URL - server should provide encrypted_urls');
                return generateRoomJoinUrl(room.id, 'seller');
            })(),
            label: 'Join as Seller'
        };
    }

    return null;
}
