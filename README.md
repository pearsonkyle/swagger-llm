# swagger-llm-ui

> Add an LLM configuration panel to your FastAPI Swagger UI docs page.

`swagger-llm-ui` injects a collapsible **LLM Settings** panel at the top of your
FastAPI `/docs` page.  Users fill in their OpenAI-compatible API details (base URL,
API key, model, etc.) directly in the browser.  Those settings are saved to
`localStorage` and automatically forwarded as `X-LLM-*` request headers on every
"Try it out" call, so your FastAPI endpoints can read them without any extra work.

---

## Features

- 🤖 **LLM Settings Panel** – collapsible dark-themed form embedded in Swagger UI
- 🔗 **Connection tester** – hits the `/models` endpoint to verify credentials
- 💾 **Persistent** – settings survive page reloads via `localStorage`
- 🔒 **Header injection** – all Try-it-out calls carry `X-LLM-*` headers
- ⚡ **FastAPI dependency** – `get_llm_config()` extracts config from headers with one line

---

## Installation

```bash
pip install swagger-llm-ui
```

---

## Quick Start

```python
from fastapi import FastAPI
from swagger_llm_ui import setup_llm_docs

app = FastAPI(title="My API")

# Replace the default /docs with the LLM-enhanced version
setup_llm_docs(app)
```

That's it.  Open `http://localhost:8000/docs` and you'll see the LLM Settings panel
at the top of the page.

---

## Reading LLM Config in Your Endpoints

```python
from fastapi import Depends
from swagger_llm_ui import LLMConfig, get_llm_config

@app.post("/chat/completions")
async def chat(body: ChatRequest, llm: LLMConfig = Depends(get_llm_config)):
    # llm.base_url, llm.api_key, llm.model_id, llm.max_tokens, llm.temperature
    # are all populated from the X-LLM-* headers injected by the browser panel
    ...
```

---

## Configuration Options

### `setup_llm_docs(app, ...)`

| Parameter | Default | Description |
|-----------|---------|-------------|
| `docs_url` | `"/docs"` | URL path for the docs page |
| `title` | `"{app.title} – LLM Docs"` | Browser tab title |
| `openapi_url` | `app.openapi_url` | URL of the OpenAPI JSON schema |
| `swagger_js_url` | jsDelivr CDN | Swagger UI JS bundle URL |
| `swagger_css_url` | jsDelivr CDN | Swagger UI CSS URL |

### `LLMConfig` fields

| Field | Default | Header |
|-------|---------|--------|
| `base_url` | `"https://api.openai.com/v1"` | `X-LLM-Base-Url` |
| `api_key` | `None` | `X-LLM-Api-Key` |
| `model_id` | `"gpt-4"` | `X-LLM-Model-Id` |
| `max_tokens` | `4096` | `X-LLM-Max-Tokens` |
| `temperature` | `0.7` | `X-LLM-Temperature` |

---

## Demo Server

```bash
uvicorn examples.demo_server:app --reload
```

---

## Development

```bash
pip install -e ".[dev]"
pytest tests/
```

---

## License

MIT
