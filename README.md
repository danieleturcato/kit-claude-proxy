# kit-claude-proxy

**OpenAI-compatible API proxy for Claude Code CLI** — with bug fixes and improvements over `claude-max-api-proxy`.

## 🚀 Quick Start

```bash
# Install
npm install -g kit-claude-proxy

# Run (requires Claude CLI authenticated)
kit-claude-proxy

# Or with custom port
PORT=8080 kit-claude-proxy
```

## ✨ Improvements over claude-max-api-proxy

| Feature | Original | kit-claude-proxy |
|---------|----------|------------------|
| `[object Object]` bug | ❌ Present | ✅ Fixed |
| Provider-prefixed models | ❌ Missing | ✅ Supported |
| Tool calls | ❌ Not supported | ✅ Supported |
| System prompt handling | ❌ Wrapped in tags | ✅ Uses `--system` flag |
| Structured logging | ❌ Console only | ✅ Configurable levels |
| Concurrency limiting | ❌ Unlimited | ✅ Configurable |
| Graceful shutdown | ❌ Basic | ✅ Full signal handling |
| Health endpoint | ❌ Basic | ✅ With version info |

## 🔧 Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Server port |
| `HOST` | `127.0.0.1` | Server host |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `MAX_CONCURRENT` | `3` | Max concurrent requests |
| `REQUEST_TIMEOUT` | `120000` | Request timeout in ms |

## 📡 API Endpoints

- `GET /health` — Health check with version info
- `GET /v1/models` — List available models
- `POST /v1/chat/completions` — Chat completion (OpenAI-compatible)

## 🐛 Bug Fix: [object Object]

The original proxy failed when `message.content` was an array of content blocks (Anthropic format). This proxy properly extracts text from all content block types.

```typescript
// Before (broken):
content: [object Object]  // <- stringified array

// After (fixed):
content: "Actual text content here"
```

## 🛠️ Tool Calls Support

The proxy parses `<tool_calls>` blocks from Claude CLI output and converts them to OpenAI-compatible `tool_calls` format.

## 📦 Development

```bash
# Clone
git clone https://github.com/danieleturcato/kit-claude-proxy.git
cd kit-claude-proxy

# Install dependencies
npm install

# Build
npm run build

# Run
npm start

# Dev mode (watch)
npm run dev
```

## 🔒 Security

- Runs on localhost by default
- No data leaves your machine
- Uses your authenticated Claude CLI
- Supports rate limiting via `MAX_CONCURRENT`

## 📄 License

MIT

---

**Note:** This is a community tool, not officially supported by Anthropic. Requires an active Claude subscription with Claude Code CLI authenticated.
