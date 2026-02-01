# /today-tasks

Open the AI Tasks web app and display today's tasks.

## Behavior

1. Start the development server if not already running
2. Open the browser to http://localhost:5173
3. Display a summary of today's tasks using gog CLI

## Implementation

```bash
# Navigate to the task app directory
cd /home/kei/everything/work/task

# Check if dev server is already running
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  # Start dev server in background
  npm run dev &
  sleep 3
fi

# Open browser
xdg-open http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null || echo "Open http://localhost:5173 in your browser"
```

## Task Summary

After launching, display a quick summary of tasks using gog:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.gog_env 2>/dev/null

echo "=== Today's Tasks ==="
gog tasks list --json 2>/dev/null | head -20 || echo "Run 'npm run dev' in /home/kei/everything/work/task first"
```

## Notes

- The app runs on http://localhost:5173 (frontend) and http://localhost:3001 (backend)
- Uses gog CLI for Google Tasks integration
- AI chat sidebar available for task organization help
