
import os

log_file = "backend_debug.log"
if not os.path.exists(log_file):
    print("Log file not found.")
    exit()

with open(log_file, "r") as f:
    lines = f.readlines()

# Find last occurrence of "Traceback"
start_idx = -1
for i in range(len(lines) - 1, -1, -1):
    if "Traceback" in lines[i]:
        start_idx = i
        break

if start_idx != -1:
    print("".join(lines[start_idx:start_idx+30]))
else:
    print("No traceback found in last lines.")
