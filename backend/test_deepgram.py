import asyncio
import os
from deepgram import DeepgramClient

async def main():
    try:
        dg = DeepgramClient(api_key="abc")
        
        # Test if connect is a context manager
        # We need to pass a valid callback or it might error?
        # The signature says callback is optional.
        
        print("Attempting to connect...")
        # Note: 'abc' key will fail, but we want to see if the METHOD exists and returns a context manager
        # before the API error.
        
        # We need to mock the websocket connection or just check the object returned.
        # Since it returns an Iterator, it's likely a context manager.
        
        try:
            # We can't actually enter the context without a real API key/connection likely failing?
            # But let's try.
            with dg.listen.v1.connect(model="nova-2") as connection:
                print(f"Yielded object: {connection}")
                print(f"Yielded Dir: {dir(connection)}")
        except Exception as e:
            print(f"Context entry error: {e}")

    except Exception as e:
        print(f"General error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
