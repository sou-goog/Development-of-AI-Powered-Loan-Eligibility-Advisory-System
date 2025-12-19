
import os

root_dir = "app"
for root, dirs, files in os.walk(root_dir):
    for file in files:
        if file.endswith(".py"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if "59b2e085" in content or "<<<<<<<" in content:
                        print(f"CONFLICT IN: {file_path}")
            except:
                pass
