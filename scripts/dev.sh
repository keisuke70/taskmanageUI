#!/bin/bash
# Development server startup script
# Runs both frontend (Vite) and backend (Express) concurrently

cd "$(dirname "$0")/.."
npm run dev
