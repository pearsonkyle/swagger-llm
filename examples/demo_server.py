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

from swagger_llm_ui import LLMConfig, get_llm_config, setup_llm_docs

app = FastAPI(title="swagger-llm-ui Demo", version="0.1.0")

# Mount the LLM-enhanced Swagger UI (replaces the default /docs)
setup_llm_docs(app)


# ── Models ───────────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None


# ── Endpoints ────────────────────────────────────────────────────────────────


@app.get("/health", tags=["utility"])
async def health():
    """Returns the health status of the service."""
    return {"status": "ok"}


@app.get("/models", tags=["models"])
async def list_models(llm: LLMConfig = Depends(get_llm_config)):
    """Proxy the /models endpoint of the configured LLM API."""
    url = llm.base_url.rstrip("/") + "/models"
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if llm.api_key:
        headers["Authorization"] = f"Bearer {llm.api_key}"

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            response = await client.get(url, headers=headers)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            return JSONResponse(
                content={"error": f"Request failed: {exc}"},
                status_code=502,
            )


@app.post("/chat/completions", tags=["chat"])
async def chat_completions(
    body: ChatRequest,
    llm: LLMConfig = Depends(get_llm_config),
):
    """Proxy a chat completion request to the configured LLM API.

    LLM settings (base URL, API key, model, etc.) are injected automatically
    from the X-LLM-* headers set by the Swagger UI LLM settings panel.
    """
    url = llm.base_url.rstrip("/") + "/chat/completions"
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if llm.api_key:
        headers["Authorization"] = f"Bearer {llm.api_key}"

    payload: Dict[str, Any] = {
        "model": body.model or llm.model_id,
        "messages": [m.dict() for m in body.messages],
        "max_tokens": body.max_tokens or llm.max_tokens,
        "temperature": body.temperature if body.temperature is not None else llm.temperature,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
            return JSONResponse(content=response.json(), status_code=response.status_code)
        except httpx.RequestError as exc:
            return JSONResponse(
                content={"error": f"Request failed: {exc}"},
                status_code=502,
            )
