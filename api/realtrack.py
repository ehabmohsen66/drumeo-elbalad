import sys
import urllib.parse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from server import DrumeoRequestHandler


class handler(DrumeoRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        self.path = "/api/realtrack" + (f"?{parsed.query}" if parsed.query else "")
        return super().do_GET()
