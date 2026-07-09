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

Two different mechanisms, depending on the client:

- **claude.ai and ChatGPT** (web) speak OAuth: paste **only the server URL**.
  The client discovers `/.well-known/oauth-authorization-server`, registers
  itself, and opens a Home OS sign-in + approval page in your browser —
  the `hos_...` token from step 1 is never needed for these two, and isn't
  shown to the client directly; approving mints one behind the scenes.
- **Claude Code CLI and Codex CLI** take the server URL **and** the
  `hos_...` token directly, no browser round-trip.

### claude.ai

Settings → Connectors → Add custom connector → paste the server URL →
Claude opens a Home OS sign-in + consent screen → sign in and tap Approve.

### ChatGPT

Settings → Connectors → Add connector (turn on Developer Mode first if you
don't see it) → paste the server URL → ChatGPT opens the same sign-in +
consent screen → sign in and tap Approve.

### Claude Code CLI

```bash
claude mcp add home-os --url https://<your-domain>/api/mcp \
  --header "Authorization: Bearer hos_..."
```

### Codex CLI

Add a remote MCP server entry to `~/.codex/config.toml`:

```toml
[mcp_servers.home-os]
url = "https://<your-domain>/api/mcp"
bearer_token = "hos_..."
```

If your installed Codex CLI version doesn't support `url`-based (remote)
servers yet, run `codex mcp --help` to check what your version supports.

Every connection — OAuth-approved or CLI-pasted — ends up as the exact same
kind of row on the Connect screen's "Active connectors" list, and revokes
the same way.

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
