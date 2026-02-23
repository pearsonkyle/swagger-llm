"""Tests for swagger-llm-ui package."""

import sys
import os

# Ensure we can import the source package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from swagger_llm_ui import LLMConfig, get_llm_config, setup_llm_docs
from swagger_llm_ui.plugin import get_swagger_ui_html


# ── Fixtures ─────────────────────────────────────────────────────────────────


def make_app() -> FastAPI:
    """Return a fresh FastAPI app with LLM docs set up."""
    app = FastAPI(title="Test App")
    setup_llm_docs(app)
    return app


# ── setup_llm_docs tests ──────────────────────────────────────────────────────


def test_docs_route_exists():
    """The /docs route should be reachable and return 200."""
    client = TestClient(make_app())
    response = client.get("/docs")
    assert response.status_code == 200


def test_docs_returns_html():
    """The /docs route should return an HTML content-type."""
    client = TestClient(make_app())
    response = client.get("/docs")
    assert "text/html" in response.headers["content-type"]


def test_docs_contains_plugin_scripts():
    """The docs page HTML should reference both LLM plugin JS files."""
    client = TestClient(make_app())
    html = client.get("/docs").text
    assert "llm-settings-plugin.js" in html
    assert "llm-layout-plugin.js" in html


def test_docs_contains_swagger_bundle():
    """The docs page should reference the Swagger UI bundle."""
    client = TestClient(make_app())
    html = client.get("/docs").text
    assert "swagger-ui-bundle" in html


def test_static_files_served():
    """The plugin JS files should be served from /swagger-llm-static."""
    client = TestClient(make_app())
    assert client.get("/swagger-llm-static/llm-settings-plugin.js").status_code == 200
    assert client.get("/swagger-llm-static/llm-layout-plugin.js").status_code == 200


def test_custom_docs_url():
    """setup_llm_docs should work with a custom docs_url."""
    app = FastAPI(title="Custom URL Test")
    setup_llm_docs(app, docs_url="/api-docs")
    client = TestClient(app)
    assert client.get("/api-docs").status_code == 200
    # Default /docs should not exist
    assert client.get("/docs").status_code == 404


def test_openapi_json_still_accessible():
    """The OpenAPI JSON schema should still be accessible."""
    client = TestClient(make_app())
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data


def test_docs_contains_request_interceptor():
    """The docs page should include the X-LLM-* request interceptor."""
    client = TestClient(make_app())
    html = client.get("/docs").text
    assert "requestInterceptor" in html
    assert "X-LLM-" in html


# ── get_swagger_ui_html tests ─────────────────────────────────────────────────


def test_get_swagger_ui_html_returns_html_response():
    """get_swagger_ui_html should return an HTMLResponse."""
    from fastapi.responses import HTMLResponse

    resp = get_swagger_ui_html(openapi_url="/openapi.json", title="Test")
    assert isinstance(resp, HTMLResponse)
    assert "swagger" in resp.body.decode().lower()


def test_get_swagger_ui_html_includes_title():
    """The rendered HTML should contain the provided title."""
    resp = get_swagger_ui_html(openapi_url="/openapi.json", title="My Custom Title")
    assert "My Custom Title" in resp.body.decode()


def test_get_swagger_ui_html_includes_openapi_url():
    """The rendered HTML should reference the provided OpenAPI URL."""
    resp = get_swagger_ui_html(openapi_url="/custom/openapi.json", title="T")
    assert "/custom/openapi.json" in resp.body.decode()


# ── get_llm_config dependency tests ──────────────────────────────────────────


@pytest.mark.anyio
async def test_get_llm_config_defaults():
    """get_llm_config should return defaults when no headers are present."""
    config = await get_llm_config()
    assert config.base_url == "https://api.openai.com/v1"
    assert config.api_key is None
    assert config.model_id == "gpt-4"
    assert config.max_tokens == 4096
    assert config.temperature == 0.7


@pytest.mark.anyio
async def test_get_llm_config_from_headers():
    """get_llm_config should parse header values correctly."""
    config = await get_llm_config(
        x_llm_base_url="http://localhost:11434/v1",
        x_llm_api_key="test-key",
        x_llm_model_id="llama3",
        x_llm_max_tokens="2048",
        x_llm_temperature="0.5",
    )
    assert config.base_url == "http://localhost:11434/v1"
    assert config.api_key == "test-key"
    assert config.model_id == "llama3"
    assert config.max_tokens == 2048
    assert config.temperature == 0.5


@pytest.mark.anyio
async def test_get_llm_config_invalid_numerics():
    """get_llm_config should fall back to defaults on non-numeric values."""
    config = await get_llm_config(
        x_llm_max_tokens="not-a-number",
        x_llm_temperature="bad",
    )
    assert config.max_tokens == 4096
    assert config.temperature == 0.7


def test_llm_config_via_endpoint():
    """The get_llm_config dependency should work end-to-end in a FastAPI app."""
    app = FastAPI(title="Dep Test")
    setup_llm_docs(app)

    @app.get("/cfg")
    async def cfg_endpoint(llm: LLMConfig = Depends(get_llm_config)):
        return {
            "base_url": llm.base_url,
            "model_id": llm.model_id,
            "max_tokens": llm.max_tokens,
        }

    client = TestClient(app)
    response = client.get(
        "/cfg",
        headers={
            "X-LLM-Base-Url": "http://ollama:11434/v1",
            "X-LLM-Model-Id": "mistral",
            "X-LLM-Max-Tokens": "1024",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["base_url"] == "http://ollama:11434/v1"
    assert data["model_id"] == "mistral"
    assert data["max_tokens"] == 1024


# ── LLMConfig dataclass tests ─────────────────────────────────────────────────


def test_llm_config_dataclass_defaults():
    """LLMConfig dataclass should have correct default values."""
    cfg = LLMConfig()
    assert cfg.base_url == "https://api.openai.com/v1"
    assert cfg.api_key is None
    assert cfg.model_id == "gpt-4"
    assert cfg.max_tokens == 4096
    assert cfg.temperature == 0.7


def test_llm_config_dataclass_custom_values():
    """LLMConfig dataclass should accept custom field values."""
    cfg = LLMConfig(base_url="http://local/v1", api_key="key", model_id="gpt-3.5-turbo")
    assert cfg.base_url == "http://local/v1"
    assert cfg.api_key == "key"
    assert cfg.model_id == "gpt-3.5-turbo"
