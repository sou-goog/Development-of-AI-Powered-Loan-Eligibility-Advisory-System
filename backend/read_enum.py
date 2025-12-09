import deepgram
import os

root_dir = os.path.dirname(deepgram.__file__)
target = "class EventType"

for root, dirs, files in os.walk(root_dir):
    for file in files:
        path = os.path.join(root, file)
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
                if target in content:
                    print(f"--- FILE: {path} ---")
                    lines = content.splitlines()
                    printing = False
                    for line in lines:
                        if target in line:
                            printing = True
                        if printing:
                            print(line)
                            if line.strip() == "" and "class" not in line: # Stop after empty line
                                break
        except:
            pass
