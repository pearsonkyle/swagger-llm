"""Core plugin logic: functions to mount the custom LLM-enhanced Swagger UI docs."""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader


# Locate package static/template directories
_PACKAGE_DIR = Path(__file__).parent
_STATIC_DIR = _PACKAGE_DIR / "static"
_TEMPLATES_DIR = _PACKAGE_DIR / "templates"


def get_swagger_ui_html(
    *,
    openapi_url: str,
    title: str,
    swagger_js_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
    swagger_css_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    llm_settings_js_url: str = "/swagger-llm-static/llm-settings-plugin.js",
    llm_layout_js_url: str = "/swagger-llm-static/llm-layout-plugin.js",
) -> HTMLResponse:
    """Return an HTMLResponse with the custom Swagger UI + LLM settings panel.

    This is the lower-level helper for users who want to serve the page manually.
    Most users should use :func:`setup_llm_docs` instead.
    """
    env = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)), autoescape=True)
    template = env.get_template("swagger_ui.html")
    html = template.render(
        title=title,
        openapi_url=openapi_url,
        swagger_js_url=swagger_js_url,
        swagger_css_url=swagger_css_url,
        llm_settings_js_url=llm_settings_js_url,
        llm_layout_js_url=llm_layout_js_url,
    )
    return HTMLResponse(html)


def setup_llm_docs(
    app: FastAPI,
    *,
    docs_url: str = "/docs",
    title: Optional[str] = None,
    openapi_url: Optional[str] = None,
    swagger_js_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
    swagger_css_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
) -> None:
    """Mount the LLM-enhanced Swagger UI docs on a FastAPI application.

    This function:
    1. Disables FastAPI's default ``/docs`` route.
    2. Mounts the package's static JS files at ``/swagger-llm-static``.
    3. Registers a new ``docs_url`` route that serves the custom Swagger UI page
       with the LLM settings panel injected.

    Args:
        app: The FastAPI application instance.
        docs_url: URL path for the docs page (default ``"/docs"``).
        title: Browser tab title (defaults to ``app.title + " – LLM Docs"``).
        openapi_url: URL of the OpenAPI JSON schema (defaults to ``app.openapi_url``).
        swagger_js_url: CDN URL for the Swagger UI JS bundle.
        swagger_css_url: CDN URL for the Swagger UI CSS.
    """
    resolved_title = title or f"{app.title} – LLM Docs"
    resolved_openapi_url = openapi_url or app.openapi_url or "/openapi.json"

    # Remove any existing docs/redoc routes registered by FastAPI
    from starlette.routing import Route

    app.router.routes = [
        r for r in app.router.routes
        if not (isinstance(r, Route) and r.path in {docs_url, app.docs_url, app.redoc_url})
    ]
    app.docs_url = None
    app.redoc_url = None

    # Mount static files for the plugin JS
    app.mount(
        "/swagger-llm-static",
        StaticFiles(directory=str(_STATIC_DIR)),
        name="swagger-llm-static",
    )

    # Register the custom docs route
    @app.get(docs_url, include_in_schema=False)
    async def custom_docs() -> HTMLResponse:
        return get_swagger_ui_html(
            openapi_url=resolved_openapi_url,
            title=resolved_title,
            swagger_js_url=swagger_js_url,
            swagger_css_url=swagger_css_url,
            llm_settings_js_url="/swagger-llm-static/llm-settings-plugin.js",
            llm_layout_js_url="/swagger-llm-static/llm-layout-plugin.js",
        )
