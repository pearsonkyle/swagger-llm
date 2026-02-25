# Swagger LLM Plugin

> Add an AI assistant to your FastAPI `/docs` page.

This package enhances Swagger UI with an LLM-powered chat assistant and settings panel. Users configure their API credentials directly in the browser to power a client-side AI Assistant that can answer questions about your API, generate example requests, and even execute API calls on your behalf.

![](examples/example.gif)

## Features

- 🤖 LLM Settings panel (collapsible)
- 🔗 Tool-calling for API Requests
- 💾 Persistent settings via `localStorage`
- 🔒 Automatic header injection (`X-LLM-*`)
- 💬 AI chat assistant with full OpenAPI context
- 🎨 Dark/light theme support

## Installation

```bash
pip install swagger-llm
```

## Quick Start

```python
from fastapi import FastAPI
from swagger_llm_ui import setup_llm_docs

app = FastAPI()
setup_llm_docs(app)  # Replaces /docs with LLM version
```

That's it! Visit `/docs` and:
1. Configure your LLM in the top panel
2. Use the **Chat** tab to ask questions about your API

## Using the Chat Assistant

- Open the **Chat** tab
- Ask questions like:
  - "What endpoints are available?"
  - "Show me how to use /users"
  - "Generate a curl command for /health"

The assistant uses your OpenAPI schema to provide accurate answers.

## Reading LLM Config in Endpoints

```python
from fastapi import Depends
from swagger_llm_ui import LLMConfig, get_llm_config

@app.post("/chat/completions")
async def chat(body: ChatRequest, llm: LLMConfig = Depends(get_llm_config)):
    # Access configured LLM settings via llm.base_url, llm.api_key, etc.
    ...
```

## Demo Server

```bash
uvicorn examples.demo_server:app --reload
```

## Development

```bash
pip install -e ".[dev]"
pytest tests/
```