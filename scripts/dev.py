"""Start both development servers; activate backend's virtual environment first."""

import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("Install Node.js and run npm ci in frontend/ first.")
    children = []
    try:
        children.append(
            subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                ],
                cwd=ROOT / "backend",
                start_new_session=os.name != "nt",
            )
        )
        children.append(
            subprocess.Popen(
                [npm, "run", "dev", "--", "--host", "127.0.0.1"],
                cwd=ROOT / "frontend",
                start_new_session=os.name != "nt",
                env={
                    **os.environ,
                    "VITE_DATA_MODE": "api",
                    "VITE_API_BASE_URL": "/api",
                },
            )
        )
        print(
            "Open http://127.0.0.1:5173. Press Ctrl+C to stop both services.",
            flush=True,
        )
        while all(child.poll() is None for child in children):
            time.sleep(0.25)
        if any(child.poll() not in (None, 0) for child in children):
            raise SystemExit("A development service exited; inspect its output above.")
    except KeyboardInterrupt:
        pass
    finally:
        for child in children:
            if os.name != "nt":
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
            elif child.poll() is None:
                subprocess.run(
                    ["taskkill", "/PID", str(child.pid), "/T", "/F"],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()


if __name__ == "__main__":
    main()
