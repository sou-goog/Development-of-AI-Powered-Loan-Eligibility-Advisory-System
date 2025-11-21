"""Simple test client that connects to the mock WebSocket server and streams
fake audio frames, printing out messages received from the server.

Run after starting the mock server:
    python3 backend/mock_client.py
"""
import asyncio
import websockets
import json


async def run_client():
    uri = "ws://localhost:8001/voice/stream"
    async with websockets.connect(uri) as ws:
        print('Connected to', uri)

        async def sender():
            # send some fake audio frames (binary)
            for i in range(6):
                fake_frame = bytes([0]) * 3200
                await ws.send(fake_frame)
                await asyncio.sleep(0.2)
            # send a control message to simulate end of session
            await ws.send(json.dumps({"type": "end_of_session"}))

        async def receiver():
            try:
                async for message in ws:
                    try:
                        obj = json.loads(message)
                        print('RECV:', obj)
                    except Exception:
                        print('RECV (raw):', message)
            except websockets.ConnectionClosed:
                print('Connection closed')

        await asyncio.gather(sender(), receiver())


if __name__ == '__main__':
    asyncio.run(run_client())
