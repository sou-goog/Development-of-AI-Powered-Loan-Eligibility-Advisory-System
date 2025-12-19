
import os
import glob

for root, dirs, files in os.walk("."):
    for file in files:
        if file.endswith(".pyc"):
            try:
                os.remove(os.path.join(root, file))
                print(f"Deleted {file}")
            except Exception as e:
                print(f"Failed to delete {file}: {e}")
    for dir in dirs:
        if dir == "__pycache__":
            try:
                os.rmdir(os.path.join(root, dir))
                print(f"Removed {dir} in {root}")
            except:
                pass
