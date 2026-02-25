"""Demo FastAPI server showcasing swagger-llm-ui integration.

Run with:
    uvicorn examples.demo_server:app --reload
Then open http://localhost:8000/docs
"""

from typing import Any, Dict, List, Optional

import httpx
from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import sys
import os

# Allow running from the repo root without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from swagger_llm import LLMConfig, get_llm_config, setup_llm_docs

app = FastAPI(
    title="Demo Server",
    version="0.3.0",
    description="""
A demonstration of the swagger-llm-plugin package with LLM-enhanced API documentation.

## Features
- Provider presets for OpenAI, Anthropic, Ollama, LM Studio, vLLM
- Interactive chat panel with SSE streaming
- Tool calling with agentic retry loop

## LLM Header Behavior
Endpoints that proxy to an LLM provider (like `/models`, `/chat/completions`, `/embeddings`)
automatically receive X-LLM-* headers from the Swagger UI LLM settings panel.

Endpoints that don't require LLM configuration (like `/health`, `/info`) will NOT receive
these headers, making their curl examples cleaner and more concise.

Configure your LLM provider settings in the "Settings" tab.
""",
)

# Mount the LLM-enhanced Swagger UI (replaces the default /docs)
setup_llm_docs(app, debug=True)


# ── Models ───────────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


# ── Utility Functions ────────────────────────────────────────────────────────


def build_llm_url(base_url: str, path: str) -> str:
    """Build a full LLM API URL from base URL and endpoint path."""
    base = base_url.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def build_headers(llm: LLMConfig) -> Dict[str, str]:
    """Build standard headers for LLM API requests."""
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if llm.api_key:
        headers["Authorization"] = f"Bearer {llm.api_key}"
    return headers


# ── Endpoints (no LLM dependency) ────────────────────────────────────────────


@app.get("/health", tags=["utility"])
async def health():
    """Health check endpoint - does not require LLM settings.
    
    Returns the health status of the service. This endpoint is used for
    basic uptime monitoring and does not interact with any LLM provider.
    """
    return {"status": "ok"}


@app.get("/info", tags=["utility"])
async def info():
    """Info endpoint - does not require LLM settings.
    
    Returns information about this demo server, including package version
    and available features. No LLM configuration is needed.
    """
    return {
        "package_version": "0.3.0",
        "features": [
            "LLM provider presets (OpenAI, Anthropic, Ollama, etc.)",
            "Connection testing with visual feedback",
            "Inline chat panel for API questions",
            "Tool calling with agentic retry loop",
        ],
    }


# ── Endpoints (require LLM config via X-LLM-* headers) ──────────────────────


@app.get("/models", tags=["models"])
async def list_models(llm: LLMConfig = Depends(get_llm_config)):
    """List available models from the configured LLM provider.
    
    Requires LLM settings (base URL, API key, model ID) to be configured
    in the Swagger UI LLM settings panel. These are automatically injected
    as X-LLM-* headers.
    """
    url = build_llm_url(llm.base_url, "/models")
    headers = build_headers(llm)

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            response = await client.get(url, headers=headers)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            return JSONResponse(
                content={"error": f"Request failed: {exc}", "url": url},
                status_code=502,
            )


@app.post("/chat/completions", tags=["chat"])
async def chat_completions(
    body: ChatRequest,
    llm: LLMConfig = Depends(get_llm_config),
):
    """Proxy a chat completion request to the configured LLM provider.
    
    Requires LLM settings to be configured in the Swagger UI LLM settings panel.
    These are automatically injected as X-LLM-* headers on requests to this endpoint.

    Example request body:
    ```json
    {
      "messages": [
        {"role": "user", "content": "Hello!"}
      ],
      "model": "gpt-4",
      "max_tokens": 100
    }
    ```
    """
    url = build_llm_url(llm.base_url, "/chat/completions")
    headers = build_headers(llm)

    payload: Dict[str, Any] = {
        "model": body.model or llm.model_id,
        "messages": [m.model_dump() for m in body.messages],
        "max_tokens": body.max_tokens or llm.max_tokens,
        "temperature": body.temperature if body.temperature is not None else llm.temperature,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            return JSONResponse(
                content={"error": f"Request failed: {exc}", "url": url},
                status_code=502,
            )

@app.post("/embeddings", tags=["embeddings"])
async def create_embeddings(
    body: Dict[str, Any],
    llm: LLMConfig = Depends(get_llm_config),
):
    """Create embeddings using the configured LLM provider.
    
    Requires LLM settings to be configured in the Swagger UI LLM settings panel.
    These are automatically injected as X-LLM-* headers on requests to this endpoint.
    """
    url = build_llm_url(llm.base_url, "/embeddings")
    headers = build_headers(llm)

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.post(url, headers=headers, json=body)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            return JSONResponse(
                content={"error": f"Request failed: {exc}", "url": url},
                status_code=502,
            )


# ── Error handlers ───────────────────────────────────────────────────────────


@app.exception_handler(502)
async def proxy_error_handler(request, exc):
    """Custom handler for proxy errors."""
    return JSONResponse(
        status_code=502,
        content={
            "error": "Proxy error",
            "message": str(exc),
            "hint": "Check your LLM provider settings in the Swagger UI panel",
        },
    )


# ── Main entry point for development ────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
