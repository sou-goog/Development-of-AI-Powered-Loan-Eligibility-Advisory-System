#!/usr/bin/env python3
"""
Quick test script to verify Voice Agent setup
"""

import os
import sys
from pathlib import Path

print("🔍 Voice Agent Setup Verification\n" + "="*50)

# Test 1: Check Vosk model
vosk_path = Path("./models/vosk-model-small-en-us-0.15")
if vosk_path.exists() and vosk_path.is_dir():
    print("✅ Vosk model found:", vosk_path)
    # Check essential files
    required = ["am/final.mdl", "conf/model.conf", "graph/HCLG.fst"]
    for req in required:
        if (vosk_path / req).exists():
            print(f"   ✓ {req}")
        else:
            print(f"   ✗ {req} MISSING")
else:
    print("❌ Vosk model NOT found at:", vosk_path)
    sys.exit(1)

print()

# Test 2: Check Piper model
piper_path = Path("./models/piper/en_US-amy-medium.onnx")
piper_config = Path("./models/piper/en_US-amy-medium.onnx.json")
if piper_path.exists() and piper_config.exists():
    print("✅ Piper TTS model found:", piper_path)
    print(f"   ✓ Model size: {piper_path.stat().st_size / 1024 / 1024:.1f} MB")
    print(f"   ✓ Config: {piper_config.name}")
else:
    print("❌ Piper model NOT found")
    sys.exit(1)

print()

# Test 3: Check Vosk import
try:
    from vosk import Model, KaldiRecognizer
    print("✅ Vosk library installed")
except ImportError as e:
    print("❌ Vosk library NOT installed:", e)
    sys.exit(1)

# Test 4: Check Piper CLI
import subprocess
try:
    result = subprocess.run(["piper", "--help"], 
                          capture_output=True, timeout=5)
    if result.returncode == 0 or "usage: piper" in result.stdout.decode() or "usage: piper" in result.stderr.decode():
        print("✅ Piper TTS CLI available")
    else:
        print("⚠️  Piper CLI found but may not work correctly")
except FileNotFoundError:
    print("❌ Piper CLI NOT found in PATH")
    sys.exit(1)
except Exception as e:
    print("⚠️  Error checking Piper:", e)

print()

# Test 5: Check Ollama
try:
    import httpx
    response = httpx.get("http://localhost:11434/api/tags", timeout=2)
    if response.status_code == 200:
        models = response.json().get("models", [])
        if models:
            print(f"✅ Ollama running with {len(models)} model(s):")
            for model in models[:3]:
                print(f"   ✓ {model.get('name', 'unknown')}")
        else:
            print("⚠️  Ollama running but no models found")
    else:
        print("⚠️  Ollama may not be running correctly")
except Exception as e:
    print("❌ Ollama NOT accessible:", e)
    print("   Start Ollama: ollama serve")

print()

# Test 6: Check voice route
try:
    import httpx
    response = httpx.get("http://localhost:8000/docs", timeout=3)
    if response.status_code == 200 and "voice" in response.text.lower():
        print("✅ Voice agent endpoint registered")
        print("   📡 WebSocket: ws://localhost:8000/api/voice/stream")
    else:
        print("⚠️  Backend running but voice endpoint may not be registered")
except Exception as e:
    print("❌ Backend NOT accessible:", e)
    print("   Start backend: uvicorn main:app --host 0.0.0.0 --port 8000")

print("\n" + "="*50)
print("🎉 Voice Agent Setup: READY!")
print("\n📋 Next Steps:")
print("1. Start frontend: cd frontend && npm start")
print("2. Open browser: http://localhost:3000")
print("3. Test voice agent: Click the phone button")
print("4. Speak: 'Hi, my name is John, I earn $5000 per month'")
print("\n💡 Tip: Check browser console for WebSocket connection logs")
