# DocBuddy - Project Context

## What Is This?

**DocBuddy** is a Python package that adds an AI chat assistant to FastAPI's Swagger UI `/docs` page. It replaces the default Swagger docs with a custom page featuring tabbed navigation: API Explorer, Chat, Workflow, and LLM Settings.

- **Package name:** `docbuddy` (v0.6.0)
- **License:** MIT
- **Python:** >= 3.9
- **Core dependency:** FastAPI (>= 0.95.0)

## Architecture

The package is a thin Python plugin + a client-side JavaScript application:

```
src/docbuddy/
├── __init__.py        # Public API: setup_docs(), get_swagger_ui_html()
├── plugin.py          # Core logic – route replacement, static mount, Jinja2 template rendering
├── cli.py             # CLI entry point (docbuddy command) – serves standalone.html via http.server
├── templates/
│   └── swagger_ui.html  # Jinja2 template for the /docs page
└── static/
    ├── core.js          # Shared utilities, OpenAPI schema fetching, theme logic
    ├── chat.js          # ChatPanel component – streaming LLM responses via /chat/completions
    ├── settings.js      # SettingsPanel – provider config, localStorage persistence
    ├── workflow.js      # WorkflowPanel – multi-block agent orchestration
    ├── agent.js         # Tool-calling execution (executeToolCall)
    ├── plugin.js        # DocBuddyPlugin layout – tab navigation, Swagger UI integration
    └── themes/          # light-theme.css, dark-theme.css
```

**Key design principle:** All LLM communication is **client-side only**. The browser calls the LLM provider directly (`/chat/completions`, `/models`) — no server proxy. This means CORS must be configured on the LLM side for local providers (Ollama, LM Studio, vLLM).

## Building and Running

### Install for development
```bash
pip install -e ".[dev]"
```

### Run tests
```bash
pytest tests/ -v
```

### Lint and format
```bash
pre-commit run --all-files
# Or individually:
ruff check src/docbuddy tests/
ruff format src/docbuddy tests/
mypy src/docbuddy tests/
bandit -r src/docbuddy
```

### Run the demo server
```bash
uvicorn examples.demo_server:app --reload --host 0.0.0.0 --port 3333
# Then visit /docs in browser
```

### Run standalone mode
```bash
docbuddy --port 9000
# Or: python -m docbuddy.cli --port 9000
```

## Public API

```python
from fastapi import FastAPI
from docbuddy import setup_docs, get_swagger_ui_html

app = FastAPI()
setup_docs(app)                    # One-line integration – replaces /docs
setup_docs(app, docs_url="/help")  # Custom URL
setup_docs(app, debug=True)        # Disables template caching for dev
```

- **`setup_docs(app, ...)`** — mounts the custom docs page and static files on a FastAPI app. Idempotent (safe to call multiple times).
- **`get_swagger_ui_html(...)`** — returns an `HTMLResponse` for manual use without auto-mounting.

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to `main`:

| Job | What it does |
|-----|-------------|
| **lint** | pre-commit hooks (trailing whitespace, YAML check, ruff fix+format, mypy) |
| **test** | pytest matrix across Python 3.9–3.12 with coverage reporting |
| **security-scan** | Bandit static analysis on `src/docbuddy` |
| **coverage-report** | Uploads merged coverage to Codecov (push to main only) |
| **documentation-check** | Verifies README exists, demo_server.py compiles |
| **dependency-review** | License/GHSA check on PRs (denies GPL-3.0, AGPL-3.0) |

## Testing Conventions

- Tests live in `tests/test_plugin.py` (~2070 lines, comprehensive)
- Uses `fastapi.testclient.TestClient` for HTTP-level integration tests
- JavaScript functionality is validated by fetching the served JS files and asserting key function/component names exist in the source
- Thread-safety tested via concurrent app setup with `threading.Thread`

## Coding Conventions (from pre-commit config)

| Tool | Version/Config |
|------|---------------|
| **ruff** | `--fix --exit-non-zero-on-fix` for lint, `ruff-format` for formatting |
| **mypy** | `--ignore-missing-imports`, with `fastapi>=0.95.0, jinja2>=3.0.0` as deps |
| **pre-commit-hooks** | trailing-whitespace, end-of-file-fixer, check-yaml, check-toml, check-merge-conflict, detect-private-key |

## localStorage Keys Used by Client-Side Code

| Key | Purpose |
|-----|---------|
| `docbuddy-settings` | LLM provider config (provider, baseUrl, apiKey, modelId) |
| `docbuddy-chat-history` | Chat message history |
| `docbuddy-theme` | Active theme preference |
| `docbuddy-active-tab` | Last-selected tab |
| `docbuddy-workflow` | Workflow block configuration |

## Package Distribution

- Built with **hatchling**, packaged as `src/docbuddy` wheel
- Published to PyPI via `.github/workflows/publish-to-pypi.yml`
- CLI entry point: `docbuddy = "docbuddy.cli:main"`
