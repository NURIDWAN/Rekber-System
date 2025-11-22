# URL Encryption Implementation Guide

## 🎯 Objective

Mengenkripsi semua URL yang mengandung ID dan data sensitif untuk mencegah akses tidak sah dan me-reveal room IDs.

## 🔐 What's Encrypted

### ✅ **Room URLs (NEW)**
- **`/rooms/{id}`** → `/rooms/rm_{encrypted_id}`
- **`/rooms/{id}/join?role=buyer`** → `/rooms/rm_{encrypted_id}/join?role=buyer`
- **`//rooms/{id}/enter`** → `/rooms/rm_{encrypted_id}/enter`
- **API endpoints**: `/rooms/{id}/message`, `/rooms/{id}/leave`, `/rooms/{id}/upload`

### ✅ **Join/Enter Tokens (EXISTING)**
- **`/rooms/{token}/join`** - sudah terenkripsi dengan token system
- **`/rooms/{token}/enter`** - sudah terenkripsi dengan token system

## 🛠 Implementation

### **Backend Changes**

#### 1. **RoomUrlService** (`app/Services/RoomUrlService.php`)
```php
// New methods added:
- encryptRoomId(int $roomId): string
- decryptRoomId(string $encryptedId): ?int
- generateRoomUrl(int $roomId): string
- generateRoomJoinUrl(int $roomId, string $role): string
- isEncryptedId(string $id): bool
```

#### 2. **Middleware** (`app/Http/Middleware/DecryptRoomId.php`)
- Decrypt encrypted room IDs from URLs
- Replace parameter with decrypted ID for routes
- Handle backwards compatibility with numeric IDs

#### 3. **Route Updates** (`routes/web.php`)
```php
// Added middleware to these routes:
Route::get('/rooms/{room}', ...)          ->middleware('decrypt.room')
Route::get('/rooms/{room}/join', ...)    ->middleware('decrypt.room')
Route::post('/rooms/{room}/join', ...)   ->middleware('decrypt.room')
Route::post('/rooms/{room}/message', ...) ->middleware('decrypt.room')
Route::post('/rooms/{room}/leave', ...)  ->middleware('decrypt.room')
Route::post('/rooms/{room}/upload', ...) ->middleware('decrypt.room')
Route::get('/rooms/{room}/enter', ...)   ->middleware('decrypt.room')
```

#### 4. **Middleware Registration** (`bootstrap/app.php`)
```php
'middleware->alias([
    'decrypt.room' => \App\Http\Middleware\DecryptRoomId::class,
]);
```

### **Frontend Changes**

#### 1. **Rooms List Page** (`resources/js/pages/rooms/index.tsx`)
```typescript
// Added encrypted_urls to Room type:
type Room = {
    // ... existing fields
    encrypted_urls?: {
        show: string;
        join: string;
        join_seller: string;
    };
};

// Use encrypted URLs with fallback:
const joinLink = room.available_for_buyer
    ? (room.encrypted_urls?.join || room.links?.buyer?.join)
    : room.available_for_seller
        ? (room.encrypted_urls?.join_seller || room.links?.seller?.join)
        : undefined;
```

#### 2. **RoomsNavbar Component** (`resources/js/components/RoomsNavbar.tsx`)
```typescript
// Added encryptedRoomId prop:
interface RoomsNavbarProps {
    // ... existing props
    encryptedRoomId?: string;
}

// Use encrypted URL in navigation:
const roomUrl = encryptedRoomId ? `/rooms/${encryptedRoomId}` : `/rooms/${roomNumber}`;
```

#### 3. **Room Detail Page** (`resources/js/pages/rooms/[id]/index.tsx`)
```typescript
// Added encrypted_room_id prop:
interface PageProps {
    // ... existing props
    encrypted_room_id?: string;
}

// Pass to navbar:
<RoomsNavbar encryptedRoomId={encrypted_room_id} />
```

## 🔄 URL Format

### **Encrypted Room ID Format**
```
rm_<base64_encoded_encrypted_data>
```

**Example:**
```
rm_eyJpdiI6ImNuZ3MwbnR2Y1J4TlJhQ3QvMlpLd1E9PSIsInZhbHVlIjoiSlVrcHBXdzBvdERxWmJQMUxyZWV5UT09RbnBjbGJqS3UrcWVxTyt2VTJCaHhUU1Y2SmVqNzlxZ2FIKzVqVUEiLCJtYWMiOiJlZmU3ZjFjZDQzNzQ4MzY2ZDRkZmJlYmE4ODc5OWI0MmI1NzRlNzU5YmNlZmNmNzA2YmM1ZDdjNzNkNDA4MDNiIn0=
```

### **URL Examples**

| Old URL | New Encrypted URL |
|---------|-------------------|
| `/rooms/123` | `/rooms/rm_eyJpdiI6...` |
| `/rooms/123/join?role=buyer` | `/rooms/rm_eyJpdiI6.../join?role=buyer` |
| `/rooms/123/enter` | `/rooms/rm_eyJpdiI6.../enter` |

## 🔒 Security Features

### **Room ID Encryption**
- **Method**: Laravel Crypt (AES-256-CBC)
- **Payload**: room_id + timestamp + random_key + type
- **Valid for**: 24 hours
- **Prefix**: `rm_` for identification

### **Token Encryption** (Existing)
- **Method**: Compact HMAC token
- **Payload**: room_id + role + timestamp + random_key + [+ PIN]
- **Valid for**: 5 minutes
- **Additional**: PIN protection support

### **Middleware Protection**
- **Automatic Decryption**: Decrypt encrypted IDs before route handling
- **Validation**: Verify encryption format and timestamps
- **Fallback**: Support numeric IDs for backwards compatibility

## 🛡 Backwards Compatibility

- **Numeric IDs**: Still supported for existing links
- **Gradual Migration**: Frontend uses encrypted URLs when available, falls back to legacy
- **Middleware**: Handles both encrypted and numeric IDs seamlessly

## 🧪 Testing

### **Manual Testing**
1. **Visit `/rooms`** - Check encrypted URLs in room cards
2. **Click "Join Room"** - Should use encrypted URL
3. **Enter Room** - Should redirect with encrypted ID
4. **Direct Access** - Try `/rooms/rm_...` format

### **URL Validation**
```bash
# Test encrypted URL structure
node test-url-encryption.js
```

## 🚀 Deployment

### **Environment Variables**
```env
# Ensure APP_KEY is set for encryption
APP_KEY=base64:your-app-key-here
```

### **Cache Clear**
```bash
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

## 📝 Benefits

1. **🔒 Enhanced Security**: Room IDs tidak bisa di-guess
2. **🛡 Access Control**: Hanya user dengan valid token yang bisa akses
3. **⏰ Time-based Access**: URLs expire after waktu tertentu
4. **🔄 Backwards Compatible**: Existing links tetap bekerja
5. **🎯 Targeted Protection**: Fokus pada sensitive endpoints

## 🔮 Future Enhancements

1. **Rate Limiting**: Untuk brute force protection
2. **Access Logging**: Track URL access patterns
3. **Custom Expiry**: Different expiry times untuk different use cases
4. **Geo-fencing**: Location-based URL access
5. **Device Fingerprinting**: Additional security layer