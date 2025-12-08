import deepgram
import os

root_dir = os.path.dirname(deepgram.__file__)
target_file = "__init__.py"
target_dir = os.path.join(root_dir, "clients", "live", "v1")
path = os.path.join(target_dir, target_file)

try:
    with open(path, "r", encoding="utf-8") as f:
        print(f"--- FILE: {path} ---")
        print(f.read())
except Exception as e:
    print(e)
