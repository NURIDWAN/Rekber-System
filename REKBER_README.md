# Rekber Room System - Modern Frontend Implementation

A modern, real-time escrow system built with React, TypeScript, and Tailwind CSS. This implementation features 21 transaction rooms where buyers and sellers can conduct secure transactions with GM oversight.

## 🚀 Features

### Core Functionality
- **21-Room Escrow System**: Each room handles one transaction at a time
- **Three User Roles**: GM (global login), Buyer, and Seller (session-based)
- **Real-time Communication**: WebSocket-powered chat and presence detection
- **File Management**: Drag-and-drop upload for payment proofs and shipping receipts
- **Activity Tracking**: Comprehensive audit log for all room activities

### Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Modern Components**: Built with Shadcn/ui and Tailwind CSS
- **Smooth Animations**: Polished transitions and loading states
- **Accessibility**: WCAG compliant with keyboard navigation
- **Dark/Light Mode**: Automatic theme detection and switching

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Real-time Updates**: Pusher.js integration for live collaboration
- **State Management**: React Context + useReducer pattern
- **File Upload**: Drag-and-drop with progress tracking and preview
- **Authentication**: Role-based access control

## 🛠 Tech Stack

### Frontend
- **React 19.2.0** - Modern React with TypeScript
- **Tailwind CSS 4.0** - Utility-first CSS framework
- **Shadcn/ui** - Modern component library
- **Pusher.js** - Real-time WebSocket communication
- **React Dropzone** - Drag-and-drop file uploads
- **Lucide React** - Beautiful icon library
- **Inertia.js** - SPA-like navigation
- **Vite 7.0** - Fast build tool

### Backend (Laravel - Already Set Up)
- **Laravel** - PHP framework
- **MySQL/MariaDB** - Database
- **Pusher** - WebSocket service
- **File Storage** - Local/cloud storage for uploads

## 📁 Project Structure

```
resources/js/
├── components/
│   ├── ui/                  # Shadcn/ui components
│   ├── RekberProvider.tsx   # Context provider wrapper
│   ├── ChatInterface.tsx    # Real-time chat component
│   ├── JoinRoomModal.tsx    # Room joining modal
│   ├── FileUploadModal.tsx  # File upload with drag-and-drop
│   ├── ActivityTimeline.tsx # Activity feed component
│   └── ConnectionStatus.tsx # WebSocket status indicator
├── contexts/
│   ├── AuthContext.tsx      # User authentication state
│   └── RoomContext.tsx      # Room-specific state management
├── pages/
│   ├── rooms/
│   │   ├── index.tsx        # Room listing page
│   │   └── [id].tsx         # Room detail page
│   └── gm/
│       ├── login.tsx        # GM login page
│       └── dashboard.tsx    # GM admin dashboard
├── lib/
│   ├── pusher.ts           # WebSocket configuration
│   └── utils.ts            # Utility functions
└── types/
    └── index.ts            # TypeScript type definitions
```

## 🎯 User Flow

### For Buyers
1. **Select a Free Room**: Browse available rooms from the main listing
2. **Join Room**: Enter name and phone number (no registration required)
3. **Upload Payment**: Share payment proof via drag-and-drop upload
4. **Track Progress**: Monitor transaction status in real-time
5. **Confirm Receipt**: Confirm when item is received

### For Sellers
1. **Join Active Room**: Enter a room marked as "in_use"
2. **Provide Information**: Enter name and phone number
3. **Upload Shipping Receipt**: Share proof of shipment
4. **Communicate**: Chat with buyer and GM in real-time

### For GM (Game Master)
1. **Secure Login**: Access admin panel via credentials
2. **Monitor All Rooms**: Overview of all 21 rooms and their status
3. **Verify Transactions**: Review and approve payment proofs
4. **Manage Disputes**: Handle any issues that arise
5. **Reset Rooms**: Clear completed transactions

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+
- PHP 8+
- Composer
- Laravel development environment

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Install PHP dependencies
composer install

# Set up environment
cp .env.example .env
php artisan key:generate

# Run migrations
php artisan migrate

# Start Laravel development server
php artisan serve
```

### Pusher Configuration
1. Create a Pusher account at https://pusher.com
2. Update `.env` file with your Pusher credentials:
```env
PUSHER_APP_ID=your_app_id
PUSHER_APP_KEY=your_app_key
PUSHER_APP_SECRET=your_app_secret
PUSHER_HOST=localhost  # or your pusher host
PUSHER_PORT=6001
PUSHER_SCHEME=http
```

## 🎨 Design System

### Color Palette
- **Primary Blue**: `#2a4bff` - Main actions and links
- **Success Green**: `#10b981` - Success states
- **Warning Orange**: `#f59e0b` - Warnings and pending states
- **Error Red**: `#ef4444` - Error states
- **Purple**: `#8b5cf6` - GM/admin features

### Typography
- **Font Family**: 'Sora', 'Plus Jakarta Sans', sans-serif
- **Headings**: Bold weights with tight tracking
- **Body**: Medium weights for readability
- **UI Elements**: System fonts for consistency

### Components
- **Cards**: Rounded corners, subtle shadows, glassmorphism effects
- **Buttons**: Gradient backgrounds, hover animations
- **Forms**: Floating labels, validation states
- **Modals**: Backdrop blur, smooth transitions

## 🚀 Key Features Explained

### Real-time Communication
- **WebSocket Events**: Instant message delivery, presence detection
- **Connection Status**: Visual indicators for online/offline status
- **Message Types**: Text, images, and system notifications
- **User Presence**: See who's online in each room

### File Management
- **Drag-and-Drop**: Intuitive file upload interface
- **File Validation**: Type and size checking
- **Progress Tracking**: Real-time upload progress
- **Preview**: Image previews for uploaded files
- **Security**: File type restrictions and scanning

### State Management
- **Context Pattern**: Efficient state sharing across components
- **Local Storage**: Session persistence for user data
- **Optimistic Updates**: Immediate UI feedback
- **Error Handling**: Comprehensive error states and recovery

### Responsive Design
- **Mobile-First**: Progressive enhancement approach
- **Grid System**: Flexible layouts for all screen sizes
- **Touch-Friendly**: Appropriate tap targets and gestures
- **Performance**: Optimized images and lazy loading

## 🔒 Security Features

### Authentication & Authorization
- **Role-Based Access**: Different permissions for buyer/seller/GM
- **Session Management**: Secure token-based sessions
- **Input Validation**: Client and server-side validation
- **CSRF Protection**: Cross-site request forgery prevention

### File Security
- **Type Validation**: Only allowed file types accepted
- **Size Limits**: Prevent large file uploads
- **Virus Scanning**: Basic file security checks
- **Secure Storage**: Protected file storage paths

## 📱 Browser Support

- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+

## 🚀 Performance

### Optimizations
- **Code Splitting**: Lazy-loaded routes and components
- **Image Optimization**: WebP support, lazy loading
- **Bundle Analysis**: Regular size monitoring
- **Caching**: Appropriate browser and server caching

### Metrics
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🤝 Contributing

### Development Workflow
1. **Feature Branches**: Create separate branches for features
2. **Code Review**: All changes require review
3. **Testing**: Comprehensive testing required
4. **Documentation**: Update docs for new features

### Guidelines
- Follow TypeScript best practices
- Use Tailwind for styling
- Write meaningful commit messages
- Test on multiple devices and browsers

## 📞 Support

For support and questions:
- **Documentation**: Check this README and inline comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Community**: Join our developer community

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Built with ❤️ using modern web technologies for a secure, user-friendly escrow experience.