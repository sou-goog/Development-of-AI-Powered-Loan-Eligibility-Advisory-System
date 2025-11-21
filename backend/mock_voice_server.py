"""Mock realtime voice WebSocket server for demo purposes.

This server simulates the behavior of the real /voice/stream endpoint without
requiring Vosk/Ollama/Piper. It's intended so you can quickly see the output
and message flow.

Run with:
    uvicorn backend.mock_voice_server:app --port 8001
"""
import asyncio
import json
import base64
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()


@app.websocket('/voice/stream')
async def mock_voice_stream(ws: WebSocket):
    await ws.accept()
    print('Client connected to mock voice stream')
    try:
        # Start a background task to send simulated AI tokens / audio
        async def producer():
            # Simulate partial transcripts
            await asyncio.sleep(0.5)
            await ws.send_text(json.dumps({"type": "partial_transcript", "data": "My name is"}))
            await asyncio.sleep(0.8)
            await ws.send_text(json.dumps({"type": "partial_transcript", "data": "My name is Alice"}))
            await asyncio.sleep(0.3)
            await ws.send_text(json.dumps({"type": "final_transcript", "data": "My name is Alice"}))

            # Simulate AI streaming tokens
            tokens = ["Hello ", "Alice. ", "I see your monthly income is ", "5000", ". "]
            for t in tokens:
                await asyncio.sleep(0.4)
                await ws.send_text(json.dumps({"type": "ai_token", "data": t}))
            # Simulate audio chunk (small WAV header + silence) as base64
            fake_wav = b'RIFF....WAVEfmt ' + bytes(100)
            b64 = base64.b64encode(fake_wav).decode('ascii')
            await ws.send_text(json.dumps({"type": "audio_chunk", "data": b64}))

            # Simulate extracted structured data and eligibility
            await asyncio.sleep(0.5)
            await ws.send_text(json.dumps({"type": "structured_update", "data": {"name": "Alice", "monthly_income": 5000, "credit_score": 720, "loan_amount": 20000}}))
            await asyncio.sleep(0.3)
            await ws.send_text(json.dumps({"type": "eligibility_result", "data": 0.87}))

        producer_task = asyncio.create_task(producer())

        # Echo incoming binary frame sizes for demo
        while True:
            msg = await ws.receive()
            if msg.get('type') == 'websocket.receive':
                if 'bytes' in msg and msg['bytes'] is not None:
                    print('Received audio bytes len=', len(msg['bytes']))
                elif 'text' in msg and msg['text'] is not None:
                    print('Received text control:', msg['text'])
            elif msg.get('type') == 'websocket.disconnect':
                break

    except WebSocketDisconnect:
        print('Client disconnected')
    finally:
        try:
            await ws.close()
        except Exception:
            pass
