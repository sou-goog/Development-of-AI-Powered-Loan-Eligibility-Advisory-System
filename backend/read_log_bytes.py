
import os

log_file = "backend_debug.log"
try:
    file_size = os.path.getsize(log_file)
    read_size = min(3000, file_size)
    
    with open(log_file, "rb") as f:
        f.seek(-read_size, 2)
        content = f.read()
        
    print(content.decode('utf-8', errors='ignore'))

except Exception as e:
    print(f"Error reading log: {e}")
