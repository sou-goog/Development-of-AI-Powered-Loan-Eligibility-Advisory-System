import asyncio
import os
from dotenv import load_dotenv
from deepgram import DeepgramClient, AsyncDeepgramClient

load_dotenv()
API_KEY = os.getenv("DEEPGRAM_API_KEY")

async def main():
    print("Inspecting AsyncDeepgramClient connection object...")
    deepgram = AsyncDeepgramClient(api_key=API_KEY)
    
    options = {
        "model": "nova-2", 
        "language": "en-US", 
        "smart_format": True, 
        "encoding": "linear16", 
        "channels": 1, 
        "sample_rate": 16000
    }

    async with deepgram.listen.v1.connect(**options) as dg_connection:
        print(f"Connection type: {type(dg_connection)}")
        print(f"Connection dir: {dir(dg_connection)}")
        
        # Check for send-like methods
        methods = [m for m in dir(dg_connection) if "send" in m.lower()]
        print(f"Methods with 'send': {methods}")
        
        print("Testing send_media...")
        try:
             res = dg_connection.send_media(b'\x00'*100)
             print(f"send_media returned: {res}")
             if asyncio.iscoroutine(res):
                 print("It is a coroutine. Awaiting...")
                 await res
                 print("Awaited successfully.")
        except Exception as e:
             print(f"Error testing send_media: {e}")

if __name__ == "__main__":
    asyncio.run(main())
