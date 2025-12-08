import deepgram
import os

root_dir = os.path.dirname(deepgram.__file__)
print(f"Searching in {root_dir}")

target = '"Results"'

for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if target in content:
                        print(f"FOUND IN: {path}")
                        lines = content.splitlines()
                        for i, line in enumerate(lines):
                            if target in line:
                                print(f"  Line {i+1}: {line.strip()}")
            except Exception as e:
                pass
