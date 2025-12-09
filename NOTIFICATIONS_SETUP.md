# Real-Time Manager Notifications System

## Overview

A comprehensive real-time notification system has been implemented to notify managers immediately when new loan applications are submitted or documents are verified. The system uses WebSocket for bidirectional real-time communication.

## Architecture

### Backend Components

#### 1. **Notification Routes** (`backend/app/routes/notification_routes.py`)

**Key Features:**
- WebSocket endpoint: `/ws/manager/notifications`
- Connection Manager class handles multiple manager connections
- Automatic broadcasting to all connected managers
- Connection lifecycle management with logging
- Error handling and cleanup of disconnected clients

**Key Functions:**
```python
async def send_manager_notification(data: dict)
# Broadcasts notification to all connected managers
# Parameters:
#   - type: 'new_application' | 'application_documents_verified'
#   - full_name: Applicant name
#   - email: Applicant email
#   - loan_amount: Requested loan amount
#   - application_id: Application identifier
#   - created_at: Timestamp
```

#### 2. **Loan Routes Integration** (`backend/app/routes/loan_routes.py`)

**Notification Triggers:**

1. **New Application Submission** (Line ~150)
   - Triggered when `POST /api/loan/applications`
   - Sends applicant details to all connected managers

2. **Document Verification** (Line ~275)
   - Triggered when `PUT /api/loan/applications/{id}/verify-document`
   - Notifies managers when documents are successfully verified
   - Includes verification status in notification

### Frontend Components

#### 1. **ManagerNotifications Component** (`frontend/src/components/ManagerNotifications.jsx`)

**Key Features:**
- **Floating Bell Button**: Top-right corner with unread badge
- **Notification Panel**: Sliding panel with scrollable notification list
- **Auto-Reconnect**: Exponential backoff reconnection strategy
- **Type-Based Styling**: Different colors/icons for different notification types
- **Unread Counter**: Tracks unread notifications
- **Mark as Read**: Click notification to mark it as read
- **Dismiss & Clear**: Individual or bulk dismissal

**Notification Types:**
- `new_application`: Blue icon, shows new applicant details
- `application_documents_verified`: Green icon, shows verification confirmation
- `application_approved`: Green checkmark icon
- `application_rejected`: Red warning icon

**WebSocket Connection:**
```javascript
ws://localhost:8000/ws/manager/notifications
// or custom via REACT_APP_WS_URL env variable
```

#### 2. **ManagerDashboard Integration** (`frontend/src/components/ManagerDashboard.jsx`)

**Changes:**
- Integrated ManagerNotifications component at the top level
- Removed old notification button from header
- Added "View Details" button in notification modal
- Modal displays full applicant information on notification click

**Notification Modal Features:**
- Application type-specific title
- Applicant name, email, loan amount
- Application ID and timestamp
- Direct link to application details view
- Smooth Framer Motion animations

## User Flow

### Manager Receives Notification

1. **Manager logs in and navigates to Manager Dashboard**
   - ManagerNotifications component mounts
   - WebSocket connection established to `/ws/manager/notifications`

2. **New Loan Application is Submitted**
   - Backend receives POST to `/api/loan/applications`
   - Application is created in database
   - Notification is broadcast to all connected managers
   - Frontend receives notification via WebSocket message

3. **Frontend Shows Notification**
   - Bell icon animates with unread badge
   - Notification appears in the sliding panel
   - Auto-opens panel to show new notification
   - Notification is marked as unread (blue dot)

4. **Manager Clicks Notification**
   - Modal opens with full applicant details
   - Manager can click "View Details" to see full application
   - Or click "Close" to dismiss
   - Notification is marked as read

5. **Manager Can Dismiss or Clear**
   - Individual "Dismiss" button per notification
   - "Clear All" button in panel footer
   - Unread count updates in real-time

## WebSocket Message Format

### New Application Notification
```json
{
  "type": "new_application",
  "application_id": 5,
  "full_name": "John Doe",
  "email": "john@example.com",
  "loan_amount": 50000,
  "created_at": "2024-12-09T10:30:00.123456",
  "timestamp": "2024-12-09T10:30:01.456789"
}
```

### Document Verified Notification
```json
{
  "type": "application_documents_verified",
  "application_id": 5,
  "full_name": "John Doe",
  "email": "john@example.com",
  "loan_amount": 50000,
  "created_at": "2024-12-09T10:25:00.123456",
  "timestamp": "2024-12-09T10:31:00.456789",
  "message": "Documents verified for John Doe"
}
```

## Configuration

### Environment Variables

**Frontend** (`.env` or `.env.local`):
```bash
# Optional: Custom WebSocket URL (defaults to window.location.host)
REACT_APP_WS_URL=ws://your-domain.com/ws/manager/notifications
```

### Backend Requirements

The following dependencies are already included:
- FastAPI with WebSocket support
- Asyncio for async operations
- SQLAlchemy for ORM

## Features

### ✅ Real-Time Updates
- Instant notification delivery via WebSocket
- No polling or page refresh needed
- Multiple managers can be notified simultaneously

### ✅ Connection Management
- Automatic connection pooling
- Handles disconnections gracefully
- Auto-reconnect with exponential backoff (max 5 attempts)
- Detailed logging for debugging

### ✅ UI/UX
- Material Design inspired
- Smooth animations with Framer Motion
- Responsive design
- Unread badge counter
- Type-based color coding

### ✅ Robustness
- Error handling for network issues
- Fallback for WebSocket failures
- Graceful degradation

## Testing

### Test New Application Notification

1. **Open Manager Dashboard**
   - Browser shows notification bell in top-right corner
   - Unread count should be 0

2. **Submit a New Loan Application**
   - From applicant dashboard or API call
   - Within seconds, manager should receive notification

3. **Verify Notification Appearance**
   - Bell icon shows unread badge
   - Notification panel slides open (auto)
   - Notification displays applicant details

4. **Test Interaction**
   - Click notification → modal opens
   - Click "View Details" → opens application details
   - Click "Dismiss" → removes from list
   - Bell unread count updates

### Test Document Verification Notification

1. **In an existing application**, upload required documents
   - Aadhar/PAN card (identity)
   - Bank statement (financial)

2. **After verification completes**
   - Manager receives "Documents Verified" notification
   - Green icon with checkmark
   - Shows verification status message

### Test WebSocket Connection

```bash
# Backend logs (check for):
# "Manager connected. Total connections: 1"
# "Broadcasting notification to X managers"

# Frontend console (check for):
# "✓ Connected to manager notifications"
# "📨 Received notification: {...}"
```

## Troubleshooting

### Notifications Not Arriving

1. **Check WebSocket Connection**
   ```javascript
   // In browser console
   // Look for "✓ Connected to manager notifications" log
   ```

2. **Check Backend Logs**
   ```bash
   # Should see manager connection and broadcast messages
   ```

3. **Verify Network**
   - WebSocket URL is correct
   - Firewall allows WebSocket connections
   - No proxy blocking WebSocket upgrade

### Reconnection Issues

1. **Check Backend Availability**
   ```bash
   curl http://localhost:8000/docs  # Should return 200
   ```

2. **Monitor Console Logs**
   - Shows reconnection attempts
   - Exponential backoff timing

3. **Manual Reconnect**
   - Refresh page to reset connection
   - Manager component will reconnect

## Performance Considerations

- **Connection Limits**: Currently no limit on simultaneous connections (configurable)
- **Message Throughput**: Can handle many notifications per second
- **Memory**: One connection per manager (small overhead)
- **Scalability**: For distributed systems, use Redis pub/sub backend

## Future Enhancements

1. **Notification Persistence**
   - Store notifications in database
   - Show history when manager reconnects

2. **Notification Preferences**
   - Managers can customize notification types
   - Mute certain notification categories

3. **Email Notifications**
   - Also send email for important updates
   - Optional push notifications

4. **Advanced Filtering**
   - Filter by loan amount, status, etc.
   - Custom notification rules

5. **Notification Actions**
   - Approve/Reject directly from notification
   - Add quick notes to application

## Files Modified

1. **Backend**
   - `backend/app/routes/notification_routes.py` - Enhanced notification system
   - `backend/app/routes/loan_routes.py` - Added notification triggers
   - `backend/main.py` - Already includes notification router

2. **Frontend**
   - `frontend/src/components/ManagerNotifications.jsx` - Rebuilt with modern UI
   - `frontend/src/components/ManagerDashboard.jsx` - Integrated notifications

## Security Notes

- WebSocket connections are server-initiated (no client auth needed in this version)
- For production, implement authentication/authorization for WebSocket connections
- Notifications contain only application metadata (no sensitive data like bank details)
- All connections are logged for audit purposes

## Support

For issues or questions, check:
1. Browser DevTools Console for frontend errors
2. Backend logs for connection issues
3. Network tab for WebSocket handshake details
4. README.md for general setup instructions
