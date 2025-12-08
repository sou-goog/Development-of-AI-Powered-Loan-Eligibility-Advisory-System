"""
User Notification WebSocket Route
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import List
from app.utils.security import decode_token

router = APIRouter()

class UserConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                await connection.send_json(message)

user_manager = UserConnectionManager()

@router.websocket("/ws/user/{user_id}/notifications")
async def user_notifications_ws(websocket: WebSocket, user_id: int, token: str = Query(...)):
    token_data = decode_token(token)
    if not token_data:
        await websocket.close(code=1008)  # Policy Violation
        return
    # Optionally check that token_data matches user_id
    await user_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        user_manager.disconnect(user_id, websocket)

# Helper to send notification to a user from other routes
async def send_user_notification(user_id: int, data: dict):
    await user_manager.send_to_user(user_id, data)
