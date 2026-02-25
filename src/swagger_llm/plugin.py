"""Core plugin logic: functions to mount the custom LLM-enhanced Swagger UI docs."""

import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import httpx
from fastapi import Depends, FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader
from pydantic import BaseModel

from .dependencies import LLMConfig, get_llm_config


# Locate package static/template directories
_PACKAGE_DIR = Path(__file__).parent
_STATIC_DIR = _PACKAGE_DIR / "static"
_TEMPLATES_DIR = _PACKAGE_DIR / "templates"

# Thread-safe lock for route modification operations
_route_lock = threading.Lock()

# Track which apps have LLM docs setup to avoid duplicate routes
_llm_apps: Set[int] = set()


class _LLMChatMessage(BaseModel):
    role: str
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class LLMChatRequest(BaseModel):
    messages: List[_LLMChatMessage]
    openapi_summary: Optional[str] = None
    openapi_schema: Optional[Dict[str, Any]] = None  # Full OpenAPI schema
    enable_tools: bool = False


def get_swagger_ui_html(
    *,
    openapi_url: str,
    title: str,
    swagger_js_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
    swagger_css_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    theme_css_url: str = "/swagger-llm-static/themes/dark-theme.css",
    llm_settings_js_url: str = "/swagger-llm-static/llm-settings-plugin.js",
    llm_layout_js_url: str = "/swagger-llm-static/llm-layout-plugin.js",
    debug: bool = False,
) -> HTMLResponse:
    """Return an HTMLResponse with the custom Swagger UI + LLM settings panel.

    This is the lower-level helper for users who want to serve the page manually.
    Most users should use :func:`setup_llm_docs` instead.

    Args:
        openapi_url: URL of the OpenAPI JSON schema.
        title: Page title.
        swagger_js_url: CDN URL for Swagger UI JS.
        swagger_css_url: CDN URL for the Swagger UI CSS.
        theme_css_url: URL for the theme CSS file.
        llm_settings_js_url: URL for the LLM settings plugin JS.
        llm_layout_js_url: URL for the LLM layout plugin JS.
        debug: If True, disables template caching for development.
    """
    env = Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)), autoescape=True)

    # Disable cache if in debug mode
    if debug:
        env.auto_reload = True
        env.cache.clear()

    template = env.get_template("swagger_ui.html")
    html = template.render(
        title=title,
        openapi_url=openapi_url,
        swagger_js_url=swagger_js_url,
        swagger_css_url=swagger_css_url,
        theme_css_url=theme_css_url,
        llm_settings_js_url=llm_settings_js_url,
        llm_layout_js_url=llm_layout_js_url,
    )
    return HTMLResponse(html)


def build_openapi_context(schema: Dict[str, Any]) -> str:
    """Build a comprehensive OpenAPI schema context for LLM chat.
    
    Converts the full OpenAPI JSON schema into a human-readable format
    that includes all endpoints, parameters, request bodies, and responses.
    
    Args:
        schema: The OpenAPI JSON schema dictionary
        
    Returns:
        A formatted string representation of the API documentation
    """
    if not schema or not isinstance(schema, dict):
        return ""
    
    lines = []
    
    # API Info
    info = schema.get("info", {})
    lines.append("# API Information")
    lines.append(f"## {info.get('title', 'Untitled API')}")
    lines.append(f"Version: {info.get('version', 'N/A')}")
    
    description = info.get("description")
    if description:
        lines.append("")
        lines.append("### Description")
        lines.append(description)
    
    # Server URLs (if any)
    servers = schema.get("servers", [])
    if servers:
        lines.append("")
        lines.append("### Base URLs")
        for server in servers:
            url = server.get("url", "")
            description = server.get("description", "")
            if description:
                lines.append(f"- {url} ({description})")
            else:
                lines.append(f"- {url}")
    
    # Paths (Endpoints)
    paths = schema.get("paths", {})
    if paths:
        lines.append("")
        lines.append("# API Endpoints")
        
        for path, path_item in paths.items():
            if not isinstance(path_item, dict):
                continue
            
            lines.append("")
            lines.append(f"## `{path}`")
            
            # Get available methods for this path
            for method in ["get", "post", "put", "patch", "delete", "head", "options"]:
                if method not in path_item:
                    continue
                    
                operation = path_item[method]
                if not isinstance(operation, dict):
                    continue
                
                verb = method.upper()
                summary = operation.get("summary", "")
                description = operation.get("description", "")
                
                lines.append(f"### {verb}")
                if summary:
                    lines.append(f"**Summary:** {summary}")
                if description:
                    lines.append(f"**Description:** {description}")
                
                # Tags
                tags = operation.get("tags", [])
                if tags:
                    lines.append(f"**Tags:** {', '.join(tags)}")
                
                # Parameters
                parameters = operation.get("parameters", [])
                if parameters:
                    lines.append("")
                    lines.append("**Parameters:**")
                    for param in parameters:
                        if not isinstance(param, dict):
                            continue
                        name = param.get("name", "unknown")
                        in_loc = param.get("in", "query")
                        required = param.get("required", False)
                        desc = param.get("description", "")
                        
                        req_str = "[required]" if required else "[optional]"
                        lines.append(f"- `{name}` ({in_loc}, {req_str}) - {desc}")
                
                # Request Body
                request_body = operation.get("requestBody", {})
                if request_body and isinstance(request_body, dict):
                    content = request_body.get("content", {})
                    if content:
                        lines.append("")
                        lines.append("**Request Body:**")
                        for content_type, media_type in content.items():
                            if not isinstance(media_type, dict):
                                continue
                            schema_def = media_type.get("schema", {})
                            if schema_def and isinstance(schema_def, dict):
                                lines.append(f"- Content-Type: `{content_type}`")
                                # Brief description of schema structure
                                if schema_def.get("type") == "object":
                                    props = schema_def.get("properties", {})
                                    if isinstance(props, dict) and len(props) > 0:
                                        prop_names = list(props.keys())[:5]  # First 5 props
                                        lines.append(f"- Properties: {', '.join(prop_names)}" + 
                                                    ("..." if len(props) > 5 else ""))
                
                # Responses
                responses = operation.get("responses", {})
                if responses:
                    lines.append("")
                    lines.append("**Responses:**")
                    for status_code, response in sorted(responses.items()):
                        if not isinstance(response, dict):
                            continue
                        description = response.get("description", "No description")
                        lines.append(f"- `{status_code}`: {description}")
    
    # Components/Schemas (definitions)
    components = schema.get("components", {})
    if components:
        schemas = components.get("schemas", {})
        if schemas:
            lines.append("")
            lines.append("# Data Models (Schemas)")
            
            for schema_name, schema_def in sorted(schemas.items())[:20]:  # Limit to first 20
                if not isinstance(schema_def, dict):
                    continue
                    
                lines.append("")
                lines.append(f"## `{schema_name}`")
                
                description = schema_def.get("description", "")
                if description:
                    lines.append(f"*{description}*")
                
                properties = schema_def.get("properties", {})
                if properties and isinstance(properties, dict):
                    lines.append("")
                    lines.append("**Properties:**")
                    for prop_name, prop_def in list(properties.items())[:10]:  # First 10
                        if not isinstance(prop_def, dict):
                            continue
                        ptype = prop_def.get("type", "any")
                        preq = prop_def.get("required", False)
                        pdesc = prop_def.get("description", "")
                        req_str = "[required]" if preq else "[optional]"
                        lines.append(f"- `{prop_name}` ({ptype}, {req_str}): {pdesc}")
    
    return "\n".join(lines)


def _endpoints_needing_llm_headers(schema: Dict[str, Any]) -> List[str]:
    """Return a list of endpoint paths whose operations declare X-LLM-* header parameters.

    This is used by the frontend to decide whether to forward LLM headers
    on a per-endpoint basis rather than sending them on every tool call.
    """
    result: List[str] = []
    paths = schema.get("paths", {}) if schema else {}

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        needs_llm = False
        for method in ("get", "post", "put", "patch", "delete"):
            op = path_item.get(method)
            if not isinstance(op, dict):
                continue
            for param in op.get("parameters", []):
                if not isinstance(param, dict):
                    continue
                if (
                    param.get("in") == "header"
                    and isinstance(param.get("name"), str)
                    and param["name"].lower().startswith("x-llm-")
                ):
                    needs_llm = True
                    break
            if needs_llm:
                break
        if needs_llm:
            result.append(path)
    return result


def build_api_request_tool(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Build an OpenAI function calling tool definition from the OpenAPI schema.

    Extracts all GET and POST endpoints and returns a tool definition that
    the LLM can use to make API requests on behalf of the user.

    Args:
        schema: The OpenAPI JSON schema dictionary

    Returns:
        An OpenAI-format tool definition dict with an extra
        ``_llm_header_paths`` key listing endpoints that need X-LLM-* headers.
    """
    endpoints = []
    methods_enum = set()
    paths = schema.get("paths", {}) if schema else {}

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method in ("get", "post"):
            if method not in path_item:
                continue
            op = path_item[method]
            if not isinstance(op, dict):
                continue
            summary = op.get("summary", "")
            desc = f"{method.upper()} {path}"
            if summary:
                desc += f" — {summary}"
            endpoints.append(desc)
            methods_enum.add(method.upper())

    if not methods_enum:
        methods_enum = {"GET", "POST"}

    endpoint_list = "\n".join(f"- {e}" for e in endpoints) if endpoints else "No endpoints found."

    llm_paths = _endpoints_needing_llm_headers(schema)

    return {
        "type": "function",
        "function": {
            "name": "api_request",
            "description": (
                "Execute an HTTP request against the API. "
                "Available endpoints:\n" + endpoint_list
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "method": {
                        "type": "string",
                        "enum": sorted(methods_enum),
                        "description": "HTTP method",
                    },
                    "path": {
                        "type": "string",
                        "description": "API endpoint path, e.g. /users/{id}",
                    },
                    "query_params": {
                        "type": "object",
                        "description": "Query string parameters as key-value pairs",
                        "additionalProperties": True,
                    },
                    "path_params": {
                        "type": "object",
                        "description": "Path parameters to substitute in the URL template",
                        "additionalProperties": True,
                    },
                    "body": {
                        "type": "object",
                        "description": "JSON request body (for POST requests)",
                        "additionalProperties": True,
                    },
                },
                "required": ["method", "path"],
            },
        },
        # Private metadata — not sent to the LLM but used by the frontend
        "_llm_header_paths": llm_paths,
    }


def setup_llm_docs(
    app: FastAPI,
    *,
    docs_url: str = "/docs",
    title: Optional[str] = None,
    openapi_url: Optional[str] = None,
    swagger_js_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
    swagger_css_url: str = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
    theme_css_url: str = "/swagger-llm-static/themes/dark-theme.css",
    debug: bool = False,
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
        debug: If True, enables debug mode with template auto-reload (default False).
    """
    resolved_title = title or f"{app.title} – LLM Docs"
    resolved_openapi_url = openapi_url or app.openapi_url or "/openapi.json"

    # Use thread lock for route modification to avoid race conditions
    with _route_lock:
        # Check if this app already has LLM docs setup to avoid duplicates
        app_id = id(app)
        if app_id in _llm_apps:
            return

        # Safely remove any existing docs/redoc routes registered by FastAPI
        from starlette.routing import Route

        # Filter routes while avoiding concurrent modification issues
        original_routes = list(app.router.routes)
        
        # Build set of paths to remove - handle potential None values
        paths_to_remove = {docs_url}
        if app.docs_url:
            paths_to_remove.add(app.docs_url)
        if app.redoc_url:
            paths_to_remove.add(app.redoc_url)
            
        app.router.routes = [
            r for r in original_routes
            if not (isinstance(r, Route) and r.path in paths_to_remove)
        ]
        app.docs_url = None
        app.redoc_url = None

        # Mark this app as having LLM docs setup
        _llm_apps.add(app_id)

    # Mount static files for the plugin JS (outside lock to avoid blocking)
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
            theme_css_url="/swagger-llm-static/themes/dark-theme.css",
            llm_settings_js_url="/swagger-llm-static/llm-settings-plugin.js",
            llm_layout_js_url="/swagger-llm-static/llm-layout-plugin.js",
            debug=debug,
        )

    # Register the /llm-chat proxy endpoint (SSE streaming)
    @app.post("/llm-chat", include_in_schema=False)
    async def llm_chat(
        body: LLMChatRequest,
        llm: LLMConfig = Depends(get_llm_config),
    ):
        """Proxy chat requests to the configured LLM with streaming SSE."""
        import json as _json

        url = llm.base_url.rstrip("/") + "/chat/completions"
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if llm.api_key:
            headers["Authorization"] = f"Bearer {llm.api_key}"

        # Build messages with OpenAPI system context
        messages: List[Dict[str, Any]] = []

        # Build comprehensive OpenAPI context
        openapi_context = ""
        if body.openapi_schema:
            # Use full schema if provided
            openapi_context = build_openapi_context(body.openapi_schema)
        elif body.openapi_summary:
            # Fall back to summary if schema not provided
            openapi_context = body.openapi_summary

        system_content = ""
        if openapi_context:
            system_content = (
                "You are a helpful API assistant. The user is looking at an API "
                "documentation page for an OpenAPI-compliant REST API. Here is the full "
                "OpenAPI schema/context for this API:\n\n"
                + openapi_context
                + "\n\nUse this schema to answer questions about the API. When appropriate, "
                "provide example curl commands or code snippets based on the endpoint definitions. "
                "If asked about a specific endpoint, refer to its parameters, request body, "
                "and response schemas defined in the OpenAPI spec."
            )

        if body.enable_tools:
            tool_instructions = (
                "\n\nYou have access to the `api_request` tool to execute API calls. "
                "When the user asks you to call an endpoint, use the tool instead of "
                "just showing a curl command. If a tool call returns an error, you may "
                "retry with corrected parameters (up to 3 times)."
            )
            system_content = (system_content or "You are a helpful API assistant.") + tool_instructions

        if system_content:
            messages.append({"role": "system", "content": system_content})

        for msg in body.messages:
            m: Dict[str, Any] = {"role": msg.role}
            if msg.content is not None:
                m["content"] = msg.content
            if msg.tool_calls is not None:
                m["tool_calls"] = msg.tool_calls
            if msg.tool_call_id is not None:
                m["tool_call_id"] = msg.tool_call_id
            # tool role messages require content
            if msg.role == "tool" and msg.content is None:
                m["content"] = ""
            messages.append(m)

        payload: Dict[str, Any] = {
            "model": llm.model_id,
            "messages": messages,
            "max_tokens": llm.max_tokens,
            "temperature": llm.temperature,
            "stream": True,
        }

        # Inject tool definition when enabled
        if body.enable_tools and body.openapi_schema:
            tool_def = build_api_request_tool(body.openapi_schema)
            payload["tools"] = [tool_def]
            payload["tool_choice"] = "auto"

        async def stream_response():
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code != 200:
                            error_text = await response.aread()
                            yield f"data: {_json.dumps({'error': f'HTTP {response.status_code}', 'details': error_text.decode()})}\n\n"
                            return

                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    yield "data: [DONE]\n\n"
                                else:
                                    try:
                                        chunk = _json.loads(data)
                                        yield f"data: {_json.dumps(chunk)}\n\n"
                                    except _json.JSONDecodeError:
                                        yield f"data: {data}\n\n"
            except httpx.RequestError as exc:
                yield f"data: {_json.dumps({'error': 'Request failed', 'details': str(exc), 'url': url})}\n\n"

        return StreamingResponse(stream_response(), media_type="text/event-stream")

    # Register the /llm/models endpoint for connection testing
    @app.get("/llm/models", include_in_schema=False)
    async def llm_models(llm: LLMConfig = Depends(get_llm_config)):
        """List available models from the configured LLM provider.
        
        Used for connection testing to verify credentials are valid.
        """
        url = llm.base_url.rstrip("/") + "/models"
        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if llm.api_key:
            headers["Authorization"] = f"Bearer {llm.api_key}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers)
                if response.status_code != 200:
                    return {
                        "error": f"HTTP {response.status_code}",
                        "details": response.text[:500]
                    }
                return response.json()
        except httpx.RequestError as exc:
            return {"error": "Request failed", "details": str(exc)}
