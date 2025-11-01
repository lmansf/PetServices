#!/bin/bash
# Simple script to start a local web server for testing

echo "Starting local web server on http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

# Start Python's built-in HTTP server
python3 -m http.server 8000
