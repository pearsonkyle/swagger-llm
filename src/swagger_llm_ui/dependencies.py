"""FastAPI dependency for extracting LLM configuration from request headers."""

from dataclasses import dataclass, field
from typing import Optional

from fastapi import Header


@dataclass
class LLMConfig:
    """LLM API configuration extracted from request headers."""

    base_url: str = "https://api.openai.com/v1"
    api_key: Optional[str] = None
    model_id: str = "gpt-4"
    max_tokens: int = 4096
    temperature: float = 0.7


async def get_llm_config(
    x_llm_base_url: Optional[str] = Header(default=None),
    x_llm_api_key: Optional[str] = Header(default=None),
    x_llm_model_id: Optional[str] = Header(default=None),
    x_llm_max_tokens: Optional[str] = Header(default=None),
    x_llm_temperature: Optional[str] = Header(default=None),
) -> LLMConfig:
    """FastAPI dependency that extracts LLM settings from X-LLM-* request headers.

    The Swagger UI LLM settings panel automatically injects these headers via a
    requestInterceptor when making API calls from the docs page.

    Usage::

        from swagger_llm_ui import get_llm_config, LLMConfig

        @app.post("/chat/completions")
        async def chat(llm: LLMConfig = Depends(get_llm_config)):
            print(llm.base_url, llm.model_id)
    """
    config = LLMConfig()

    if isinstance(x_llm_base_url, str):
        config.base_url = x_llm_base_url
    if isinstance(x_llm_api_key, str):
        config.api_key = x_llm_api_key
    if isinstance(x_llm_model_id, str):
        config.model_id = x_llm_model_id
    if isinstance(x_llm_max_tokens, str):
        try:
            config.max_tokens = int(x_llm_max_tokens)
        except ValueError:
            pass
    if isinstance(x_llm_temperature, str):
        try:
            config.temperature = float(x_llm_temperature)
        except ValueError:
            pass

    return config
