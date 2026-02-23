# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Run all tests
pytest tests/

# Run a single test
pytest tests/test_plugin.py::test_docs_route_exists

# Run the demo server
uvicorn examples.demo_server:app --reload

# Build the package
python -m build
```

## Architecture

`swagger-llm-ui` is a Python package that injects an LLM settings panel into FastAPI's Swagger UI. It uses a **src layout** with the package at `src/swagger_llm_ui/`.

### How it works

The package has two integration points:

1. **Python side** (`plugin.py`, `dependencies.py`): `setup_llm_docs()` removes FastAPI's default `/docs` route, mounts the package's static JS files at `/swagger-llm-static`, and registers a replacement `/docs` route that serves a custom Jinja2 HTML template. The `get_llm_config()` FastAPI dependency extracts `X-LLM-*` request headers into an `LLMConfig` dataclass.

2. **Browser side** (`static/`, `templates/`): The HTML template loads two Swagger UI plugins:
   - `llm-settings-plugin.js` — a Redux-based plugin that renders the collapsible settings panel, persists settings to `localStorage`, and handles connection testing against `/models`.
   - `llm-layout-plugin.js` — a layout plugin that places `LLMSettingsPanel` above the standard Swagger UI content.
   - The `requestInterceptor` in `swagger_ui.html` reads from `localStorage` and injects the `X-LLM-*` headers into every "Try it out" call.

### Key files

| File | Purpose |
|------|---------|
| `src/swagger_llm_ui/plugin.py` | `setup_llm_docs()` and `get_swagger_ui_html()` |
| `src/swagger_llm_ui/dependencies.py` | `LLMConfig` dataclass and `get_llm_config()` FastAPI dependency |
| `src/swagger_llm_ui/templates/swagger_ui.html` | Jinja2 template; wires up SwaggerUIBundle with both plugins and the `requestInterceptor` |
| `src/swagger_llm_ui/static/llm-settings-plugin.js` | Swagger UI plugin: Redux state, React component for the settings form |
| `src/swagger_llm_ui/static/llm-layout-plugin.js` | Swagger UI layout plugin: places the panel above the main UI |
| `examples/demo_server.py` | Working FastAPI app demonstrating both `setup_llm_docs` and `get_llm_config` |

### Header mapping

The browser injects these headers; the Python dependency reads them:

| `LLMConfig` field | Header |
|---|---|
| `base_url` | `X-LLM-Base-Url` |
| `api_key` | `X-LLM-Api-Key` |
| `model_id` | `X-LLM-Model-Id` |
| `max_tokens` | `X-LLM-Max-Tokens` |
| `temperature` | `X-LLM-Temperature` |

### Static file packaging

`pyproject.toml` uses `hatchling` with `force-include` to bundle the `static/` and `templates/` directories into the wheel. If you add new static files, they are included automatically; new subdirectories must be added to `[tool.hatch.build.targets.wheel.force-include]`.

### Testing notes

Tests use `pytest-anyio` with `asyncio_mode = "auto"` (configured in `pyproject.toml`). Async tests for `get_llm_config` are decorated with `@pytest.mark.anyio`. The test file adds `src/` to `sys.path` directly, so the package does not need to be installed to run tests.
