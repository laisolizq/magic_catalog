#!/usr/bin/env python3
"""Serve local card database artifacts with CORS enabled for Vite development."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path


class CorsHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()


def main() -> None:
    directory = Path(__file__).resolve().parent.parent / "artifacts" / "card-database"
    handler = partial(CorsHandler, directory=str(directory))
    server = ThreadingHTTPServer(("localhost", 8080), handler)
    print(f"Serving {directory} at http://localhost:8080")
    server.serve_forever()


if __name__ == "__main__":
    main()