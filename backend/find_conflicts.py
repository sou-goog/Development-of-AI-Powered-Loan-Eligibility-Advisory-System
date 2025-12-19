
import os

file_path = r"app\routes\voice_realtime_v2.py"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "59b2e085" in line:
            print(f"Found hash at line {i+1}: {line.strip()}")
        if ">>>>>>>" in line:
            print(f"Found marker at line {i+1}: {line.strip()}")
        if "<<<<<<<" in line:
            print(f"Found marker at line {i+1}: {line.strip()}")
        if "=======" in line and len(line.strip()) == 7:
            print(f"Found marker at line {i+1}: {line.strip()}")
