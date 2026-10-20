# gcal-lite-mcp

A small MCP server for Google Calendar: `calendars`, `events`, `get_event`, `create_event`. It asks Google only to read calendars and to make events.

## Setup, once

1. In [Google Cloud Console](https://console.cloud.google.com/), in a project with an OAuth app (see [gmail-lite-mcp](https://github.com/nvms/gmail-lite-mcp) for setting one up), enable the **Google Calendar API**.
2. Save a **Desktop app** client's JSON to `~/.config/gcal-lite-mcp/client.json`.
3. Sign in:

   ```sh
   npx -y github:nvms/gcal-lite-mcp auth
   ```

## Use

```json
{ "mcpServers": { "calendar": { "command": "npx", "args": ["-y", "github:nvms/gcal-lite-mcp"] } } }
```
