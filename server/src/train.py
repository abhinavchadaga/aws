import json
import sys
import time

progress = json.loads(sys.stdin.read())

def send_update(msg: str):
    sys.stdout.write(msg)
    sys.stdout.flush()

for i in range(1, 11):
    progress['progress'] = i * 10
    send_update(json.dumps(progress))
    time.sleep(1)

