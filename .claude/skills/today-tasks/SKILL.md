# /today-tasks

Open the AI Tasks web app and display today's tasks.

## Behavior

1. Install dependencies if needed
2. Start the development server if not already running
3. Open the browser to http://localhost:5173
4. Display a summary of today's tasks using gog CLI

## Implementation

```bash
cd /home/kei/everything/work/task

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
  npm install
fi

# Check if dev server is already running
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
  npm run dev &
  sleep 3
fi

# Open browser
xdg-open http://localhost:5173 2>/dev/null &
```

## Task Summary

After launching, display a quick summary of tasks using gog:

```bash
export PATH="$HOME/.local/bin:$PATH"
source ~/.gog_env

# List all task lists, then list tasks from each
gog tasks lists list
# Then use: gog tasks list <tasklistId>
```

## Notes

- Frontend: http://localhost:5173 / Backend: http://localhost:3001
- gog CLI commands:
  - `gog tasks lists list` - show all task lists with IDs
  - `gog tasks list <tasklistId>` - list tasks in a specific list
  - `gog tasks --help` - see all available commands
