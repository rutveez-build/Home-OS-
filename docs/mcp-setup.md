# Connecting Home OS to ChatGPT, Claude, or Codex

Home OS runs an MCP (Model Context Protocol) server at `/api/mcp`. Any
MCP-capable assistant can connect to it and plan meals, check the household
state, and coordinate the cook — with the same approval gates, permission
checks, and audit log as the web app and WhatsApp.

## 1. Get a token (do this first, in Home OS)

1. Open the web app, sign in, go to **Home → Connect ChatGPT, Claude, or Codex**.
   (Only owner/parent/partner roles see this link.)
2. Give the connector a label (e.g. "ChatGPT") and tap **Create**.
3. Copy the token shown — it starts with `hos_` and is shown **exactly once**.
   If you lose it, revoke it and mint a new one; it can't be retrieved again.
4. Note the **Server URL** shown on the same screen: `https://<your-domain>/api/mcp`.

Revoke a connector any time from the same screen — it takes effect
immediately, on the very next call.

## 2. Add the connector in your client

Every client needs the same two things: the **server URL** and the token as
a **Bearer** value in the `Authorization` header. Where exactly each client's
UI lives changes over time — if these steps don't match what you see, check
that client's own docs for "remote MCP server" or "custom connector."

### Claude (claude.ai or Claude Code)

- **claude.ai**: Settings → Connectors → Add connector → paste the server URL,
  choose Bearer token auth, paste your `hos_...` token.
- **Claude Code CLI**:
  ```bash
  claude mcp add home-os --url https://<your-domain>/api/mcp \
    --header "Authorization: Bearer hos_..."
  ```

### ChatGPT

Settings → Connectors → Add connector (or "Create" under Developer Mode,
depending on your plan) → paste the server URL → choose API key / Bearer
token auth → paste your `hos_...` token.

### Codex CLI

Add a remote MCP server entry to `~/.codex/config.toml`:

```toml
[mcp_servers.home-os]
url = "https://<your-domain>/api/mcp"
bearer_token = "hos_..."
```

If your installed Codex CLI version doesn't support `url`-based (remote)
servers yet, run `codex mcp --help` to check what your version supports.

## 3. Try it

Ask your assistant something like:

> "Check what's set up for my household, then plan next week's meals."

It should call `get_household_state`, then `create_meal_plan`, and show you
the draft — waiting for your explicit yes before calling `approve_meal_plan`.
It will never call `approve_meal_plan` or `send_cook_message` without you
having seen the actual content first; that's enforced by the assistant's own
instructions in each tool's description, not just convention.

## What the connector can and can't do

See `docs/assistant-tools.md` for the full list of 11 tools. In short: it can
read your household state, update preferences, draft and (with your
approval) send the cook message, build the shopping list, and read/record
feedback. It cannot place any order, and it cannot act for a different
household than the one the token was minted for — ever.
