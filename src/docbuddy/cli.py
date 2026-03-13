#!/usr/bin/env python3
"""CLI entry point for launching DocBuddy standalone webpage."""

import argparse
import http.server
import os
import sys
import webbrowser

from importlib.resources import files


def main():
    """Launch DocBuddy standalone webpage on port 8008."""
    parser = argparse.ArgumentParser(
        prog="docbuddy",
        description="Launch the DocBuddy standalone AI-enhanced API documentation page.",
        epilog="Example: docbuddy --host 127.0.0.1 --port 9000",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="localhost",
        help="Host to bind the server to (default: localhost)",
    )
    parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8008,
        help="Port to run the server on (default: 8008)",
    )

    args = parser.parse_args()

    # Use importlib.resources to find the docs directory
    docbuddy_pkg = files("docbuddy")

    # The docs directory is at the project root, one level up from src/docbuddy
    # When installed, it's in site-packages/docbuddy/../..
    docs_path = docbuddy_pkg.parent.parent / "docs"

    if not docs_path.exists():
        print(f"Error: Could not find 'docs' directory at {docs_path}", file=sys.stderr)
        sys.exit(1)

    # Serve from the project root (parent of docs) so static files are accessible
    # The index.html uses paths like /src/docbuddy/static/core.js which need the parent
    os.chdir(docs_path.parent)

    url = f"http://{args.host}:{args.port}/docs/index.html"

    print(f"Serving DocBuddy at {url}")
    print("Press Ctrl+C to stop the server")

    # Start HTTP server
    with http.server.HTTPServer(
        (args.host, args.port), http.server.SimpleHTTPRequestHandler
    ) as httpd:
        # Give it a moment for server to fully start before opening browser
        import threading

        def open_browser():
            import time

            time.sleep(0.5)
            webbrowser.open(url)

        thread = threading.Thread(target=open_browser, daemon=True)
        thread.start()

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            sys.exit(0)
