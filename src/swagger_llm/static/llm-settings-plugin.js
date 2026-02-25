// LLM Settings Swagger UI Plugin
// Adds statePlugins.llmSettings and components.LLMSettingsPanel

(function () {
  "use strict";

  // ── LLM Provider configurations ─────────────────────────────────────────────
  var LLM_PROVIDERS = {
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1' },
    ollama: { name: 'Ollama', url: 'http://localhost:11434/v1' },
    lmstudio: { name: 'LM Studio', url: 'http://localhost:1234/v1' },
    vllm: { name: 'vLLM', url: 'http://localhost:8000/v1' },
    azure: { name: 'Azure OpenAI', url: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT' },
    custom: { name: 'Custom', url: '' }
  };

  // ── Markdown parser initialization (marked.js) ────────────────────────────
  var marked = null;
  function initMarked() {
    if (marked) return marked;
    
    // Load marked.js from CDN if not already loaded
    if (typeof window.marked !== 'undefined') {
      marked = window.marked;
      return marked;
    }
    
    // Create script element to load marked.js
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked@9/marked.min.js';
    script.async = true;
    document.head.appendChild(script);
    
    // Wait for marked to load
    var promise = new Promise(function(resolve) {
      var checkLoaded = function() {
        if (window.marked) {
          marked = window.marked;
          resolve(marked);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
    });
    
    return promise;
  }

  // ── Parse Markdown safely ─────────────────────────────────────────────────
  function parseMarkdown(text) {
    if (!text || typeof text !== 'string') return '';

    // Sanitize: strip dangerous tags and attributes
    var sanitized = text
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[^>]*>/gi, '')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');

    try {
      if (marked) {
        var html = marked.parse(sanitized);
        // Strip event handler attributes and javascript: URLs from parsed output
        html = html
          .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
          .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src=""');
        return html;
      }
    } catch (e) {
      console.error('Markdown parsing error:', e);
    }

    // Fallback: simple line break conversion
    return sanitized.replace(/\n/g, '<br>');
  }

  // ── Theme default configurations ─────────────────────────────────────────────
  var THEME_DEFINITIONS = {
    dark: {
      name: 'Dark',
      primary: '#1d4ed8',
      primaryHover: '#1e40af',
      secondary: '#2d3748',
      accent: '#718096',
      background: '#0f172a',
      panelBg: '#1f2937',
      headerBg: '#111827',
      borderColor: '#4a5568',
      textPrimary: '#f7fafc',
      textSecondary: '#cbd5e0',
      inputBg: '#1f2937',
    },
    light: {
      name: 'Light',
      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      secondary: '#e2e8f0',
      accent: '#718096',
      background: '#f7fafc',
      panelBg: '#ffffff',
      headerBg: '#edf2f7',
      borderColor: '#cbd5e0',
      textPrimary: '#1a202c',
      textSecondary: '#4a5568',
      inputBg: '#f7fafc',
    }
  };

  var THEME_STORAGE_KEY = "swagger-llm-theme";
  var SETTINGS_STORAGE_KEY = "swagger-llm-settings";
  var CHAT_HISTORY_KEY = "swagger-llm-chat-history";
  var TOOL_SETTINGS_KEY = "swagger-llm-tool-settings";

  // ── Theme loading/saving functions ─────────────────────────────────────────
  function loadTheme() {
    try {
      var raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        // Validate theme is a valid key in THEME_DEFINITIONS
        if (parsed.theme && THEME_DEFINITIONS[parsed.theme]) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load theme from localStorage:', e);
    }
    // Return default if invalid or not found
    return { theme: 'dark', customColors: {} };
  }

  function saveTheme(themeData) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeData));
    } catch (e) {
      // ignore
    }
  }

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveToStorage(state) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }

  function loadChatHistory() {
    try {
      var raw = localStorage.getItem(CHAT_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveChatHistory(messages) {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-20))); // Keep last 20
    } catch (e) {
      // ignore
    }
  }

  // ── Tool settings persistence ───────────────────────────────────────────────
  function loadToolSettings() {
    try {
      var raw = localStorage.getItem(TOOL_SETTINGS_KEY);
      return raw ? JSON.parse(raw) : { enableTools: false, autoExecute: false, apiKey: '' };
    } catch (e) {
      return { enableTools: false, autoExecute: false, apiKey: '' };
    }
  }

  function saveToolSettings(settings) {
    try {
      localStorage.setItem(TOOL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }

// ── Action types ────────────────────────────────────────────────────────────
  var SET_BASE_URL = "LLM_SET_BASE_URL";
  var SET_API_KEY = "LLM_SET_API_KEY";
  var SET_MODEL_ID = "LLM_SET_MODEL_ID";
  var SET_MAX_TOKENS = "LLM_SET_MAX_TOKENS";
  var SET_TEMPERATURE = "LLM_SET_TEMPERATURE";
  var SET_CONNECTION_STATUS = "LLM_SET_CONNECTION_STATUS";
  var SET_PROVIDER = "LLM_SET_PROVIDER";
  var SET_SETTINGS_OPEN = "LLM_SET_SETTINGS_OPEN";
  var ADD_CHAT_MESSAGE = "LLM_ADD_CHAT_MESSAGE";
  var CLEAR_CHAT_HISTORY = "LLM_CLEAR_CHAT_HISTORY";
  var SET_OPENAPI_SCHEMA = "LLM_SET_OPENAPI_SCHEMA";
  var SET_THEME = "LLM_SET_THEME";
  var SET_CUSTOM_COLOR = "LLM_SET_CUSTOM_COLOR";

  // ── Default state ───────────────────────────────────────────────────────────
  var storedSettings = loadFromStorage();
  var storedTheme = loadTheme();

  // ── Apply theme immediately on DOM ready to prevent flash of wrong theme ───
  document.addEventListener('DOMContentLoaded', function() {
    // Apply the saved/custom theme as soon as DOM is ready
    window.applyLLMTheme(storedTheme.theme, storedTheme.customColors);
  });

  var DEFAULT_STATE = {
    baseUrl: storedSettings.baseUrl || "https://api.openai.com/v1",
    apiKey: storedSettings.apiKey || "",
    modelId: storedSettings.modelId || "gpt-4",
    maxTokens: storedSettings.maxTokens != null ? storedSettings.maxTokens : 4096,
    temperature: storedSettings.temperature != null ? storedSettings.temperature : 0.7,
    provider: storedSettings.provider || "openai",
    connectionStatus: "disconnected", // disconnected | connecting | connected | error
    settingsOpen: false,
    chatHistory: loadChatHistory(),
    lastError: "",
    theme: storedTheme.theme || "dark",
    customColors: storedTheme.customColors || {},
  };

  // ── Debounce utility ───────────────────────────────────────────────────────
  function debounce(fn, delay) {
    var timeoutId;
    return function () {
      var self = this;
      var args = arguments;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function () {
        fn.apply(self, args);
      }, delay);
    };
  }

  // ── Helper to dispatch via Swagger UI's auto-generated action dispatchers ──
  function dispatchAction(system, actionName, value) {
    var sys = system && typeof system.getSystem === 'function' ? system.getSystem() : null;
    if (sys && sys.llmSettingsActions && typeof sys.llmSettingsActions[actionName] === 'function') {
      sys.llmSettingsActions[actionName](value);
    }
  }

  // ── Reducer ─────────────────────────────────────────────────────────────────
  function llmSettingsReducer(state, action) {
    if (state === undefined) state = DEFAULT_STATE;
    switch (action.type) {
      case SET_BASE_URL:
        return Object.assign({}, state, { baseUrl: action.payload });
      case SET_API_KEY:
        return Object.assign({}, state, { apiKey: action.payload });
      case SET_MODEL_ID:
        return Object.assign({}, state, { modelId: action.payload });
      case SET_MAX_TOKENS:
        var val = action.payload;
        // Only update if it's a valid non-empty number
        if (val === '' || val === null || val === undefined) {
          return state;
        }
        var num = Number(val);
        if (!isNaN(num)) {
          return Object.assign({}, state, { maxTokens: num });
        }
        return state;
      case SET_TEMPERATURE:
        var temp = action.payload;
        if (temp === '' || temp === null || temp === undefined) {
          return state;
        }
        var numTemp = Number(temp);
        if (!isNaN(numTemp)) {
          return Object.assign({}, state, { temperature: numTemp });
        }
        return state;
      case SET_CONNECTION_STATUS:
        return Object.assign({}, state, { connectionStatus: action.payload });
      case SET_PROVIDER:
        var provider = LLM_PROVIDERS[action.payload] || LLM_PROVIDERS.custom;
        return Object.assign({}, state, {
          provider: action.payload,
          baseUrl: provider.url
        });
      case SET_SETTINGS_OPEN:
        return Object.assign({}, state, { settingsOpen: action.payload });
      case ADD_CHAT_MESSAGE:
        // state may be an Immutable Map (Swagger UI wraps reducer state)
        var existingHistory = state.get ? state.get("chatHistory") : state.chatHistory;
        // Convert Immutable List to plain array if needed
        if (existingHistory && typeof existingHistory.toJS === 'function') {
          existingHistory = existingHistory.toJS();
        }
        var newHistory = Array.isArray(existingHistory)
          ? existingHistory.concat([action.payload])
          : [action.payload];
        saveChatHistory(newHistory);
        return Object.assign({}, state, { chatHistory: newHistory });
      case CLEAR_CHAT_HISTORY:
        saveChatHistory([]);
        return Object.assign({}, state, { chatHistory: [] });
      case SET_OPENAPI_SCHEMA:
        return Object.assign({}, state, { openapiSchema: action.payload });
      case SET_THEME:
        var newTheme = action.payload;
        // Validate theme
        if (!THEME_DEFINITIONS[newTheme]) {
          console.warn('Invalid theme:', newTheme, 'Using default dark theme');
          newTheme = 'dark';
        }
        var themeDef = THEME_DEFINITIONS[newTheme] || THEME_DEFINITIONS.dark;
        // Merge custom colors with defaults for this theme
        var mergedColors = Object.assign({}, themeDef, state.customColors || {});
        saveTheme({ theme: newTheme, customColors: mergedColors });
        return Object.assign({}, state, { theme: newTheme, customColors: mergedColors });
      case SET_CUSTOM_COLOR:
        var colorKey = action.payload.key;
        var colorValue = action.payload.value;
        var newColors = Object.assign({}, state.customColors || {});
        newColors[colorKey] = colorValue;
        saveTheme({ theme: state.theme, customColors: newColors });
        return Object.assign({}, state, { customColors: newColors });
      default:
        return state;
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  var actions = {
    setBaseUrl: function (value) { return { type: SET_BASE_URL, payload: value }; },
    setApiKey: function (value) { return { type: SET_API_KEY, payload: value }; },
    setModelId: function (value) { return { type: SET_MODEL_ID, payload: value }; },
    setMaxTokens: function (value) { return { type: SET_MAX_TOKENS, payload: value }; },
    setTemperature: function (value) { return { type: SET_TEMPERATURE, payload: value }; },
    setConnectionStatus: function (value) { return { type: SET_CONNECTION_STATUS, payload: value }; },
    setProvider: function (value) { return { type: SET_PROVIDER, payload: value }; },
    setSettingsOpen: function (value) { return { type: SET_SETTINGS_OPEN, payload: value }; },
    addChatMessage: function (message) { return { type: ADD_CHAT_MESSAGE, payload: message }; },
    clearChatHistory: function () { return { type: CLEAR_CHAT_HISTORY }; },
    setOpenApiSchema: function (schema) { return { type: SET_OPENAPI_SCHEMA, payload: schema }; },
    setTheme: function (value) { return { type: SET_THEME, payload: value }; },
    setCustomColor: function (value) { return { type: SET_CUSTOM_COLOR, payload: value }; },
  };

  // ── Selectors ───────────────────────────────────────────────────────────────
  var selectors = {
    getBaseUrl: function (state) { return state.get ? state.get("baseUrl") : state.baseUrl; },
    getApiKey: function (state) { return state.get ? state.get("apiKey") : state.apiKey; },
    getModelId: function (state) { return state.get ? state.get("modelId") : state.modelId; },
    getMaxTokens: function (state) { return state.get ? state.get("maxTokens") : state.maxTokens; },
    getTemperature: function (state) { return state.get ? state.get("temperature") : state.temperature; },
    getConnectionStatus: function (state) { return state.get ? state.get("connectionStatus") : state.connectionStatus; },
    getProvider: function (state) { return state.get ? state.get("provider") : state.provider; },
    getSettingsOpen: function (state) { return state.get ? state.get("settingsOpen") : state.settingsOpen; },
    getChatHistory: function (state) { return state.get ? state.get("chatHistory") : state.chatHistory || []; },
    getOpenApiSchema: function (state) { return state.get ? state.get("openapiSchema") : state.openapiSchema; },
    getLastError: function (state) { return state.get ? state.get("lastError") : state.lastError; },
    getTheme: function (state) { return state.get ? state.get("theme") : state.theme; },
    getCustomColors: function (state) { return state.get ? state.get("customColors") : state.customColors; },
  };

  // ── Status indicator ───────────────────────────────────────────────────────
  var STATUS_EMOJI = {
    disconnected: "⚪",
    connecting: "🟡",
    connected: "🟢",
    error: "🔴",
  };

  // ── Provider badge generator ───────────────────────────────────────────────
  function getProviderBadge(providerKey) {
    var provider = LLM_PROVIDERS[providerKey] || LLM_PROVIDERS.custom;
    var className = 'llm-provider-' + (providerKey === 'custom' ? 'openai' : providerKey);
    return React.createElement(
      "span",
      { className: "llm-provider-badge " + className },
      provider.name
    );
  }

  // ── OpenAPI schema summary for chat context ────────────────────────────────
  function getSchemaSummary(schema) {
    if (!schema || typeof schema !== 'object') return '';

    var lines = [];
    var info = schema.info || {};
    lines.push('## API: ' + (info.title || 'Untitled') + ' v' + (info.version || '?'));
    if (info.description) {
      lines.push(info.description.substring(0, 500));
    }
    lines.push('');
    lines.push('## Endpoints');

    if (schema.paths) {
      Object.keys(schema.paths).forEach(function (path) {
        var methods = schema.paths[path];
        if (typeof methods !== 'object') return;

        Object.keys(methods).forEach(function (method) {
          if (method === 'parameters') return; // skip path-level params
          var spec = methods[method];
          if (typeof spec !== 'object') return;

          var line = '- ' + method.toUpperCase() + ' ' + path;
          if (spec.summary) line += ' — ' + spec.summary;
          lines.push(line);

          // Parameters
          var params = spec.parameters || [];
          if (params.length > 0) {
            var paramDescs = params.map(function (p) {
              return p.name + ' (' + (p.in || '?') + ', ' + (p.required ? 'required' : 'optional') + ')';
            });
            lines.push('  - Params: ' + paramDescs.join(', '));
          } else {
            lines.push('  - No parameters');
          }

          // Request body
          if (spec.requestBody && spec.requestBody.content) {
            var contentTypes = Object.keys(spec.requestBody.content);
            if (contentTypes.length > 0) {
              var bodySchema = spec.requestBody.content[contentTypes[0]].schema;
              if (bodySchema && bodySchema.properties) {
                var props = Object.keys(bodySchema.properties).map(function (k) {
                  var p = bodySchema.properties[k];
                  return k + ': ' + (p.type || 'any');
                });
                lines.push('  - Body: { ' + props.join(', ') + ' }');
              }
            }
          }
        });
      });
    }

    return lines.join('\n');
  }

  // ── Check if an endpoint needs X-LLM-* headers ─────────────────────────────
  function endpointNeedsLLMHeaders(schema, path) {
    if (!schema || !schema.paths) return false;
    var pathItem = schema.paths[path];
    if (!pathItem || typeof pathItem !== 'object') return false;

    var methods = ['get', 'post', 'put', 'patch', 'delete'];
    for (var i = 0; i < methods.length; i++) {
      var op = pathItem[methods[i]];
      if (!op || typeof op !== 'object') continue;
      var params = op.parameters || [];
      for (var j = 0; j < params.length; j++) {
        var p = params[j];
        if (p && p['in'] === 'header' && typeof p.name === 'string' &&
            p.name.toLowerCase().startsWith('x-llm-')) {
          return true;
        }
      }
    }
    return false;
  }

  // ── Build a curl command string from tool call args ─────────────────────────
  function buildCurlFromArgs(args, openapiSchema) {
    var method = args.method || 'GET';
    var url = args.path || '/';

    // Substitute path params
    var pathParams = args.path_params || {};
    Object.keys(pathParams).forEach(function(key) {
      url = url.replace('{' + key + '}', encodeURIComponent(pathParams[key]));
    });

    // Add query params
    var queryParams = args.query_params || {};
    var qKeys = Object.keys(queryParams);
    if (qKeys.length > 0) {
      var qs = qKeys.map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]);
      }).join('&');
      url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
    }

    var fullUrl = (typeof window !== 'undefined' && !url.startsWith('http')) ? window.location.origin + url : url;

    var parts = ['curl'];
    if (method !== 'GET') parts.push('-X ' + method);
    parts.push("'" + fullUrl + "'");

    // Add LLM headers only if endpoint needs them
    var settings = loadFromStorage();
    if (endpointNeedsLLMHeaders(openapiSchema, args.path || '/')) {
      if (settings.baseUrl) parts.push("-H 'X-LLM-Base-Url: " + settings.baseUrl + "'");
      if (settings.apiKey) parts.push("-H 'X-LLM-Api-Key: " + settings.apiKey + "'");
      if (settings.modelId) parts.push("-H 'X-LLM-Model-Id: " + settings.modelId + "'");
    }

    var toolSettings = loadToolSettings();
    if (toolSettings.apiKey) parts.push("-H 'Authorization: Bearer " + toolSettings.apiKey + "'");

    if (method === 'POST' && args.body && Object.keys(args.body).length > 0) {
      parts.push("-H 'Content-Type: application/json'");
      parts.push("-d '" + JSON.stringify(args.body) + "'");
    }

    return parts.join(' \\\n  ');
  }

  // ── Message ID counter for unique timestamps (fixes timestamp collision issue) ─
  var _messageIdCounter = 0;

  // Generate a unique message ID to prevent timestamp collisions
  function generateMessageId() {
    return Date.now() + '_' + (++_messageIdCounter);
  }

  // ── Chat panel component ───────────────────────────────────────────────────
  function ChatPanelFactory(system) {
    var React = system.React;

    return class ChatPanel extends React.Component {
      constructor(props) {
        super(props);
        this.state = {
          input: "",
          isTyping: false,
          chatHistory: loadChatHistory(),
          schemaLoading: false,
          copiedMessageId: null,
          headerHover: {},
          // Tool calling state
          pendingToolCall: null,
          editMethod: 'GET',
          editPath: '',
          editQueryParams: '{}',
          editPathParams: '{}',
          editBody: '{}',
          toolCallResponse: null,
          toolRetryCount: 0,
        };
        this.handleSend = this.handleSend.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.clearHistory = this.clearHistory.bind(this);
        this.copyToClipboard = this.copyToClipboard.bind(this);
        this.renderTypingIndicator = this.renderTypingIndicator.bind(this);
        this.formatMessageContent = this.formatMessageContent.bind(this);
        this.setHeaderHover = this.setHeaderHover.bind(this);
        this.renderMessage = this.renderMessage.bind(this);
        this.handleExecuteToolCall = this.handleExecuteToolCall.bind(this);
        this.sendToolResult = this.sendToolResult.bind(this);
        this.renderToolCallPanel = this.renderToolCallPanel.bind(this);
        this._copyTimeoutId = null;

        this._fetchAbortController = null;
        // Store the last assistant message with tool_calls for the agentic loop
        this._lastToolCallAssistantMsg = null;

        // Initialize marked.js
        initMarked();
      }

      componentDidMount() {
        this.fetchOpenApiSchema();
      }

      componentWillUnmount() {
        // Abort any pending fetch for OpenAPI schema
        if (this._fetchAbortController) {
          this._fetchAbortController.abort();
          this._fetchAbortController = null;
        }
        if (this._copyTimeoutId) {
          clearTimeout(this._copyTimeoutId);
          this._copyTimeoutId = null;
        }
      }

      fetchOpenApiSchema() {
        var self = this;
        
        // Abort any existing request
        if (this._fetchAbortController) {
          this._fetchAbortController.abort();
        }
        
        self._fetchAbortController = new AbortController();
        self.setState({ schemaLoading: true });
        
        fetch("/openapi.json", { signal: self._fetchAbortController.signal })
          .then(function (res) { return res.json(); })
          .then(function (schema) {
            // Store full schema for use in chat requests
            self._openapiSchema = schema;
            dispatchAction(system, 'setOpenApiSchema', schema);
            
            // Update localStorage with full schema for persistence
            try {
                var storedSettings = loadFromStorage();
                storedSettings.openapiSchema = schema;
                saveToStorage(storedSettings);
            } catch (e) {
                // Ignore storage errors
            }
            
            self.setState({ schemaLoading: false });
          })
          .catch(function (err) {
            if (err.name !== 'AbortError') {
              console.warn('Failed to fetch OpenAPI schema:', err);
              self.setState({ schemaLoading: false });
            }
          });
      }

      addMessage(msg) {
        this.setState(function (prev) {
          var history = prev.chatHistory || [];
          // Use the exact message ID to update instead of timestamp (fixes collision)
          if (history.length > 0 && msg.role === 'assistant' && history[history.length - 1].role === 'assistant' && history[history.length - 1].messageId === msg.messageId) {
            var updated = history.slice(0, -1).concat([msg]);
            saveChatHistory(updated);
            return { chatHistory: updated };
          }
          var updated = history.concat([msg]);
          saveChatHistory(updated);
          return { chatHistory: updated };
        });
      }

      handleInputChange(e) {
        this.setState({ input: e.target.value });
      }

      handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSend();
        }
      }

      handleCancel() {
        if (this._currentCancelToken) {
          this._currentCancelToken.abort();
        }
      }

      handleExecuteToolCall() {
        var self = this;
        var s = this.state;
        var toolSettings = loadToolSettings();
        var settings = loadFromStorage();

        // Build tool args from current edited state (may differ from LLM's original proposal)
        var executedArgs = {
          method: s.editMethod || 'GET',
          path: s.editPath || '',
        };
        try { executedArgs.query_params = JSON.parse(s.editQueryParams || '{}'); } catch (e) { executedArgs.query_params = {}; }
        try { executedArgs.path_params = JSON.parse(s.editPathParams || '{}'); } catch (e) { executedArgs.path_params = {}; }
        if (s.editMethod === 'POST') {
          try { executedArgs.body = JSON.parse(s.editBody || '{}'); } catch (e) { executedArgs.body = {}; }
        }

        // Now add the tool call message to chat history with actual executed args
        if (self._pendingToolCallMsg) {
          var toolMsg = Object.assign({}, self._pendingToolCallMsg, {
            _displayContent: 'Tool call: api_request(' + executedArgs.method + ' ' + executedArgs.path + ')',
            _toolArgs: executedArgs
          });
          // Update the tool_calls arguments to reflect edited params
          if (toolMsg.tool_calls && toolMsg.tool_calls.length > 0) {
            toolMsg.tool_calls = toolMsg.tool_calls.map(function(tc) {
              return Object.assign({}, tc, {
                function: Object.assign({}, tc.function, {
                  arguments: JSON.stringify(executedArgs)
                })
              });
            });
          }
          self.addMessage(toolMsg);
          self._pendingToolCallMsg = null;
        }

        // Build URL with path param substitution
        var url = s.editPath;
        try {
          var pathParams = JSON.parse(s.editPathParams || '{}');
          Object.keys(pathParams).forEach(function(key) {
            url = url.replace('{' + key + '}', encodeURIComponent(pathParams[key]));
          });
        } catch (e) {}

        // Add query params
        try {
          var queryParams = JSON.parse(s.editQueryParams || '{}');
          var queryKeys = Object.keys(queryParams);
          if (queryKeys.length > 0) {
            var qs = queryKeys.map(function(k) {
              return encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]);
            }).join('&');
            url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
          }
        } catch (e) {}

        // Only forward X-LLM-* headers when the endpoint declares them in its OpenAPI schema
        var fetchHeaders = {};
        var openapiSchema = self._openapiSchema || (settings.openapiSchema || null);
        var needsLLM = endpointNeedsLLMHeaders(openapiSchema, s.editPath);
        if (needsLLM) {
          if (settings.baseUrl) fetchHeaders['X-LLM-Base-Url'] = settings.baseUrl;
          if (settings.apiKey) fetchHeaders['X-LLM-Api-Key'] = settings.apiKey;
          if (settings.modelId) fetchHeaders['X-LLM-Model-Id'] = settings.modelId;
          if (settings.maxTokens != null && settings.maxTokens !== '') fetchHeaders['X-LLM-Max-Tokens'] = String(settings.maxTokens);
          if (settings.temperature != null && settings.temperature !== '') fetchHeaders['X-LLM-Temperature'] = String(settings.temperature);
        }

        // Only add auth header if a tool API key is explicitly configured
        if (toolSettings.apiKey) {
          fetchHeaders['Authorization'] = 'Bearer ' + toolSettings.apiKey;
        }

        var fetchOpts = {
          method: s.editMethod,
          headers: fetchHeaders,
        };

        // Add body and Content-Type only for POST requests
        if (s.editMethod === 'POST') {
          fetchHeaders['Content-Type'] = 'application/json';
          try {
            fetchOpts.body = s.editBody;
          } catch (e) {}
        }

        self.setState({ toolCallResponse: { status: 'loading', body: '' } });

        console.log('[Tool Call]', s.editMethod, url, fetchOpts);

        fetch(url, fetchOpts)
          .then(function(res) {
            return res.text().then(function(text) {
              var responseObj = { status: res.status, statusText: res.statusText, body: text };
              console.log('[Tool Call Response]', res.status, res.statusText, text.substring(0, 500));
              self.setState({ toolCallResponse: responseObj });
              // Auto-send result back to LLM
              self.sendToolResult(responseObj);
            });
          })
          .catch(function(err) {
            var responseObj = { status: 0, statusText: 'Network Error', body: err.message };
            console.error('[Tool Call Error]', err);
            self.setState({ toolCallResponse: responseObj });
            self.sendToolResult(responseObj);
          });
      }

      sendToolResult(responseObj) {
        var self = this;
        var s = this.state;

        // Check retry limit
        if (s.toolRetryCount >= 3) {
          var lastError = 'Status ' + responseObj.status + ' ' + (responseObj.statusText || '');
          var lastBody = (responseObj.body || '').substring(0, 500);
          var errorDetail = lastError + (lastBody ? '\n\n```\n' + lastBody + '\n```' : '');
          console.error('[Tool Call] Max retries reached. Last error:', lastError, lastBody);
          self.addMessage({
            role: 'assistant',
            content: 'Max tool call retries (3) reached. Last error: ' + errorDetail + '\n\nPlease try a different approach.',
            messageId: generateMessageId()
          });
          self.setState({ pendingToolCall: null, isTyping: false });
          return;
        }

        var toolCallId = s.pendingToolCall ? s.pendingToolCall.id : 'call_unknown';

        // Truncate response body to 4000 chars
        var truncatedBody = (responseObj.body || '').substring(0, 4000);
        var resultContent = 'Status: ' + responseObj.status + ' ' + (responseObj.statusText || '') + '\n\n' + truncatedBody;

        // Build the tool result message
        var toolResultMsg = {
          role: 'tool',
          content: resultContent,
          tool_call_id: toolCallId,
          messageId: generateMessageId(),
          _displayContent: 'Tool result: Status ' + responseObj.status
        };

        // Build API messages from current state PLUS the tool result we're about to add.
        // We can't rely on setState having applied yet, so we construct the list explicitly.
        var currentHistory = (self.state.chatHistory || []).slice();
        // The last message in history should be the assistant tool_calls message
        // (added when the tool call was detected). Append the tool result after it.
        currentHistory.push(toolResultMsg);

        var apiMessages = currentHistory.map(function(m) {
          var msg = { role: m.role };
          if (m.content != null) msg.content = m.content;
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          if (!m.tool_calls && msg.content == null) msg.content = m._displayContent || '';
          return msg;
        });

        // Now add to UI state
        self.addMessage(toolResultMsg);

        var streamMsgId = generateMessageId();
        var isError = responseObj.status < 200 || responseObj.status >= 300;
        self.setState({
          pendingToolCall: null,
          toolRetryCount: isError ? s.toolRetryCount + 1 : 0,
        });

        var fullSchema = null;
        try {
          var storedSettings = loadFromStorage();
          if (storedSettings.openapiSchema) fullSchema = storedSettings.openapiSchema;
        } catch (e) {}

        self._streamLLMResponse(apiMessages, streamMsgId, fullSchema);
      }

      // ── Error classification and user-friendly messages ─────────────────────
      _getErrorMessage(err, responseText) {
        var errorMsg = err.message || "Request failed";
        var details = "";
        
        // Try to extract details from response
        try {
          if (responseText) {
            var parsed = JSON.parse(responseText);
            if (parsed.details) details = parsed.details;
            else if (parsed.error) details = parsed.error;
          }
        } catch (e) {
          // Not JSON, might be HTML or plain text
          if (responseText && responseText.length < 500) {
            details = responseText;
          }
        }

        // Check for specific error patterns
        var lowerError = (errorMsg + ' ' + details).toLowerCase();
        
        // Network/connection errors
        if (lowerError.includes('connection refused') || 
            lowerError.includes('connect timeout') ||
            lowerError.includes('network') ||
            lowerError.includes('econnrefused') ||
            lowerError.includes('enotfound') ||
            lowerError.includes('fetch failed')) {
          return {
            title: "Connection Failed",
            message: "Could not connect to your LLM provider. Please verify your Base URL in Settings.",
            action: "Check Settings",
            needsSettings: true
          };
        }
        
        // Authentication errors (401, 403, invalid API key)
        if (lowerError.includes('401') || 
            lowerError.includes('403') || 
            lowerError.includes('unauthorized') ||
            lowerError.includes('invalid api key') ||
            lowerError.includes('authentication') ||
            lowerError.includes('api key')) {
          return {
            title: "Authentication Failed",
            message: "Your API key appears to be invalid or missing. Please check your API Key in Settings.",
            action: "Check Settings",
            needsSettings: true
          };
        }
        
        // Not found errors (404, model not found)
        if (lowerError.includes('404') || 
            lowerError.includes('not found') ||
            lowerError.includes('model')) {
          return {
            title: "Resource Not Found",
            message: "The requested resource was not found. This might mean your Model ID is incorrect or the endpoint doesn't exist.",
            action: "Check Settings",
            needsSettings: true
          };
        }
        
        // Rate limiting
        if (lowerError.includes('429') || 
            lowerError.includes('rate limit') ||
            lowerError.includes('too many requests')) {
          return {
            title: "Rate Limited",
            message: "You've sent too many requests. Please wait a moment and try again.",
            action: null,
            needsSettings: false
          };
        }
        
        // Timeout errors
        if (lowerError.includes('timeout') || 
            lowerError.includes('timed out')) {
          return {
            title: "Request Timeout",
            message: "The request took too long. The LLM provider may be busy or experiencing issues.",
            action: null,
            needsSettings: false
          };
        }
        
        // Server errors (5xx)
        if (lowerError.includes('500') || 
            lowerError.includes('502') || 
            lowerError.includes('503') ||
            lowerError.includes('504') ||
            lowerError.includes('server error')) {
          return {
            title: "Server Error",
            message: "The LLM provider's server encountered an error. This is usually a temporary issue.",
            action: null,
            needsSettings: false
          };
        }
        
        // CORS errors
        if (lowerError.includes('cors') || 
            lowerError.includes('access-control')) {
          return {
            title: "CORS Error",
            message: "Cross-origin request blocked. This is usually a configuration issue with the LLM provider.",
            action: null,
            needsSettings: false
          };
        }
        
        // Generic error - still provide helpful guidance
        return {
          title: "Request Failed",
          message: details || errorMsg,
          action: "Check Settings",
          needsSettings: true
        };
      }

      // ── Render error message in chat ────────────────────────────────────────
      _renderErrorInChat(errorInfo) {
        var self = this;
        var errorHtml = '<div class="llm-error-message">';
        errorHtml += '<div class="llm-error-title">' + errorInfo.title + '</div>';
        errorHtml += '<div class="llm-error-text">' + errorInfo.message + '</div>';
        
        if (errorInfo.needsSettings) {
          errorHtml += '<div class="llm-error-actions">';
          errorHtml += '<button class="llm-error-action-btn" onclick="window.llmOpenSettings && window.llmOpenSettings()">';
          errorHtml += '⚙️ ' + errorInfo.action;
          errorHtml += '</button></div>';
        }
        
        errorHtml += '</div>';
        
        return errorHtml;
      }

      // ── Shared streaming helper ─────────────────────────────────────────────
      _streamLLMResponse(apiMessages, streamMsgId, fullSchema) {
        var self = this;
        var settings = loadFromStorage();
        var toolSettings = loadToolSettings();

        var scrollToBottom = function() {
          var el = document.getElementById('llm-chat-messages');
          if (el) el.scrollTop = el.scrollHeight;
        };

        // Add empty assistant message immediately so it persists in chatHistory
        self.addMessage({ role: 'assistant', content: '', messageId: streamMsgId });

        self._currentCancelToken = new AbortController();
        self.setState({ isTyping: true });

        var accumulated = "";
        var currentStreamMessageId = streamMsgId;
        
        // Track response for error handling
        var lastResponseText = "";

        // Tool calls accumulator
        var accumulatedToolCalls = {};

        var finalize = function(content, saveContent, isError) {
          if (saveContent && content && content.trim() && content !== "*(cancelled)*") {
            // Check if this looks like an error message
            var isErrorMsg = isError || (content && content.toLowerCase().startsWith('error:'));
            
            if (isErrorMsg) {
              // Parse error and create user-friendly message
              var errorInfo = self._getErrorMessage({ message: content }, lastResponseText);
              var errorHtml = self._renderErrorInChat(errorInfo);
              self.addMessage({ 
                role: 'assistant', 
                content: errorHtml, 
                messageId: streamMsgId,
                isError: true 
              });
            } else {
              self.addMessage({ role: 'assistant', content: content, messageId: streamMsgId });
            }
          }
          self._currentCancelToken = null;
          self.setState({ isTyping: false });
          setTimeout(scrollToBottom, 30);
        };

        // Build request body
        var requestBody = {
          messages: apiMessages,
          openapi_schema: fullSchema,
        };
        if (toolSettings.enableTools) {
          requestBody.enable_tools = true;
        }

        fetch("/llm-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-LLM-Base-Url": settings.baseUrl || "",
            "X-LLM-Api-Key": settings.apiKey || "",
            "X-LLM-Model-Id": settings.modelId || "",
            "X-LLM-Max-Tokens": (settings.maxTokens != null && settings.maxTokens !== '') ? String(settings.maxTokens) : "",
            "X-LLM-Temperature": (settings.temperature != null && settings.temperature !== '') ? String(settings.temperature) : "",
          },
          body: JSON.stringify(requestBody),
          signal: self._currentCancelToken.signal
        })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("HTTP " + res.status + ": " + res.statusText);
            }
            var reader = res.body.getReader();
            var decoder = new TextDecoder();
            var buffer = "";

            var processChunk = function() {
              return reader.read().then(function (result) {
                if (self._currentCancelToken && self._currentCancelToken.signal.aborted) {
                  finalize(accumulated, true);
                  return;
                }
                if (result.done) {
                  finalize(accumulated || "Sorry, I couldn't get a response.", true);
                  return;
                }

                buffer += decoder.decode(result.value, { stream: true });
                var lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (var i = 0; i < lines.length; i++) {
                  var line = lines[i].trim();
                  if (!line || !line.startsWith("data: ")) continue;
                  var payload = line.substring(6);

                  if (payload === "[DONE]") {
                    finalize(accumulated || "Sorry, I couldn't get a response.", true);
                    return;
                  }

                  try {
                    var chunk = JSON.parse(payload);
                    if (chunk.error) {
                      finalize("Error: " + chunk.error + (chunk.details ? ": " + chunk.details : ""), true, true);
                      return;
                    }

                    var choice = chunk.choices && chunk.choices[0];
                    if (!choice) continue;

                    // Accumulate content deltas
                    if (choice.delta && choice.delta.content) {
                      accumulated += choice.delta.content;
                      self.setState(function (prev) {
                        var history = prev.chatHistory || [];
                        if (history.length > 0 && history[history.length - 1].role === 'assistant' &&
                            history[history.length - 1].messageId === currentStreamMessageId) {
                          var updated = history.slice(0, -1).concat([{
                            role: 'assistant',
                            content: accumulated,
                            messageId: history[history.length - 1].messageId
                          }]);
                          saveChatHistory(updated);
                          return { chatHistory: updated };
                        }
                        return {};
                      });
                      scrollToBottom();
                    }

                    // Accumulate tool_calls deltas
                    if (choice.delta && choice.delta.tool_calls) {
                      choice.delta.tool_calls.forEach(function(tc) {
                        var idx = tc.index != null ? tc.index : 0;
                        if (!accumulatedToolCalls[idx]) {
                          accumulatedToolCalls[idx] = { id: '', function: { name: '', arguments: '' } };
                        }
                        if (tc.id) accumulatedToolCalls[idx].id = tc.id;
                        if (tc.function) {
                          if (tc.function.name) accumulatedToolCalls[idx].function.name = tc.function.name;
                          if (tc.function.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
                        }
                      });
                    }

                    // Detect tool_calls finish
                    if (choice.finish_reason === "tool_calls") {
                      var toolCallsList = Object.keys(accumulatedToolCalls).map(function(k) {
                        return accumulatedToolCalls[k];
                      });

                      if (toolCallsList.length > 0) {
                        var tc = toolCallsList[0]; // Handle first tool call
                        var args = {};
                        try {
                          args = JSON.parse(tc.function.arguments || '{}');
                        } catch (e) {
                          args = {};
                        }

                        // Store the assistant message with tool_calls for later (added on Execute)
                        var assistantToolMsg = {
                          role: 'assistant',
                          content: null,
                          tool_calls: toolCallsList.map(function(t) {
                            return { id: t.id, type: 'function', function: { name: t.function.name, arguments: t.function.arguments } };
                          }),
                          messageId: streamMsgId
                        };
                        self._lastToolCallAssistantMsg = assistantToolMsg;
                        self._pendingToolCallMsg = assistantToolMsg;

                        // Remove the empty streaming placeholder from chat history
                        self.setState(function(prev) {
                          var history = (prev.chatHistory || []).filter(function(m) {
                            return m.messageId !== streamMsgId;
                          });
                          saveChatHistory(history);
                          return { chatHistory: history };
                        });

                        // Populate tool call panel
                        self.setState({
                          isTyping: false,
                          pendingToolCall: tc,
                          editMethod: args.method || 'GET',
                          editPath: args.path || '',
                          editQueryParams: JSON.stringify(args.query_params || {}, null, 2),
                          editPathParams: JSON.stringify(args.path_params || {}, null, 2),
                          editBody: JSON.stringify(args.body || {}, null, 2),
                          toolCallResponse: null,
                        });
                        self._currentCancelToken = null;

                        // Auto-execute if enabled
                        if (toolSettings.autoExecute) {
                          setTimeout(function() { self.handleExecuteToolCall(); }, 100);
                        }
                        return; // Don't continue processing
                      }
                    }
                  } catch (e) {
                    // skip unparseable chunks
                  }
                }

                return processChunk();
              });
            };

            return processChunk();
          })
          .catch(function (err) {
            if (err.name === 'AbortError') {
              finalize(accumulated, true);
            } else {
              // Mark as error to trigger user-friendly error display
              finalize("Error: " + (err.message || "Request failed"), true, true);
            }
          });

        setTimeout(scrollToBottom, 50);
      }

      handleSend() {
        if (!this.state.input.trim() || this.state.isTyping) return;

        var self = this;
        var userInput = this.state.input.trim();
        var msgId = generateMessageId();
        var streamMsgId = generateMessageId();

        // Clear input
        self._pendingToolCallMsg = null;
        self.setState({ input: "", pendingToolCall: null, toolCallResponse: null, toolRetryCount: 0 });

        // Build API messages from current history + new user message
        var userMsg = { role: 'user', content: userInput, messageId: msgId };
        var currentHistory = self.state.chatHistory || [];
        var apiMessages = currentHistory.concat([userMsg]).map(function (m) {
          var msg = { role: m.role };
          if (m.content != null) msg.content = m.content;
          if (m.tool_calls) msg.tool_calls = m.tool_calls;
          if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
          // Ensure content exists for regular messages
          if (!m.tool_calls && msg.content == null) msg.content = m._displayContent || '';
          return msg;
        });

        self.addMessage(userMsg);

        var fullSchema = null;
        try {
          var storedSettings = loadFromStorage();
          if (storedSettings.openapiSchema) fullSchema = storedSettings.openapiSchema;
        } catch (e) {}

        self._streamLLMResponse(apiMessages, streamMsgId, fullSchema);
      }

      setHeaderHover(timestamp, show) {
        var newHover = Object.assign({}, this.state.headerHover);
        if (show) {
          newHover[timestamp] = true;
        } else {
          delete newHover[timestamp];
        }
        this.setState({ headerHover: newHover });
      }

      copyToClipboard(text, messageId) {
        if (!text || !navigator.clipboard) return;
        var self = this;
        navigator.clipboard.writeText(text).then(function () {
          self.setState({ copiedMessageId: messageId });
          if (self._copyTimeoutId) clearTimeout(self._copyTimeoutId);
          self._copyTimeoutId = setTimeout(function () {
            self._copyTimeoutId = null;
            self.setState({ copiedMessageId: null });
          }, 2000);
        }).catch(function (err) {
          console.error('Failed to copy:', err);
        });
      }

      renderTypingIndicator() {
        var React = system.React;
        return React.createElement(
          "div",
          { className: "llm-typing-indicator" },
          React.createElement("span", null, "Assistant is typing"),
          React.createElement("span", { className: "llm-typing-dot", style: { animationDelay: '-0.32s' } }),
          React.createElement("span", { className: "llm-typing-dot", style: { animationDelay: '-0.16s' } }),
          React.createElement("span", { className: "llm-typing-dot" })
        );
      }

      clearHistory() {
        saveChatHistory([]);
        this.setState({ chatHistory: [] });
      }

      renderMessage(msg, idx) {
        var React = system.React;
        var self = this;
        var isUser = msg.role === 'user';
        var isTool = msg.role === 'tool';
        var isToolCallMsg = msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0;

        // Check if this is the last assistant message and we're currently typing
        var chatHistory = self.state.chatHistory || [];
        var isStreamingThisMessage = self.state.isTyping &&
          !isUser &&
          idx === chatHistory.length - 1 &&
          msg.role === 'assistant';

        // Tool call message (assistant with tool_calls, no content)
        if (isToolCallMsg) {
          var toolArgs = msg._toolArgs || {};
          var tcMethod = toolArgs.method || 'GET';
          var tcPath = toolArgs.path || '';
          var openapiSchema = null;
          try { var stored = loadFromStorage(); openapiSchema = stored.openapiSchema || null; } catch (e) {}
          var curlForMsg = buildCurlFromArgs(toolArgs, openapiSchema);
          var curlCopyId = 'tc_curl_' + (msg.messageId || idx);

          return React.createElement(
            "div",
            { key: msg.messageId || msg.timestamp, className: "llm-chat-message-wrapper" },
            React.createElement(
              "div",
              {
                className: "llm-chat-message assistant",
                style: { maxWidth: "90%", borderLeft: "3px solid #8b5cf6" }
              },
              React.createElement("div", { className: "llm-avatar assistant-avatar" }, "\uD83D\uDD27"),
              React.createElement(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                // Header with method badge
                React.createElement(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" } },
                  React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", color: "#8b5cf6" } }, "api_request"),
                  React.createElement("span", {
                    style: {
                      background: tcMethod === 'POST' ? '#f59e0b' : '#10b981',
                      color: '#fff',
                      padding: '1px 6px',
                      borderRadius: '3px',
                      fontSize: '11px',
                      fontWeight: '600',
                      fontFamily: "'Consolas', 'Monaco', monospace",
                    }
                  }, tcMethod),
                  React.createElement("span", {
                    style: { fontSize: "13px", fontFamily: "'Consolas', 'Monaco', monospace", color: "var(--theme-text-primary)" }
                  }, tcPath)
                ),
                // Curl command block
                React.createElement(
                  "div",
                  { style: { position: "relative" } },
                  React.createElement(
                    "pre",
                    {
                      style: {
                        background: "var(--theme-input-bg)",
                        border: "1px solid var(--theme-border-color)",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        fontSize: "11px",
                        fontFamily: "'Consolas', 'Monaco', monospace",
                        color: "var(--theme-text-primary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        margin: 0,
                        lineHeight: "1.4",
                        maxHeight: "120px",
                        overflowY: "auto",
                      }
                    },
                    curlForMsg
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: function() { self.copyToClipboard(curlForMsg, curlCopyId); },
                      title: "Copy curl command",
                      style: {
                        position: "absolute",
                        top: "4px",
                        right: "4px",
                        background: "var(--theme-secondary)",
                        border: "1px solid var(--theme-border-color)",
                        borderRadius: "4px",
                        color: "var(--theme-text-secondary)",
                        padding: "2px 6px",
                        cursor: "pointer",
                        fontSize: "10px",
                        transition: "all 0.15s ease",
                      }
                    },
                    self.state.copiedMessageId === curlCopyId ? "\u2705" : "\uD83D\uDCCB curl"
                  )
                ),
                // Params summary if any non-trivial params
                (toolArgs.query_params && Object.keys(toolArgs.query_params).length > 0) ||
                (toolArgs.body && Object.keys(toolArgs.body).length > 0)
                  ? React.createElement("div", { style: { marginTop: "4px", fontSize: "11px", color: "var(--theme-text-secondary)" } },
                      toolArgs.query_params && Object.keys(toolArgs.query_params).length > 0
                        ? React.createElement("span", null, "Query: " + JSON.stringify(toolArgs.query_params) + "  ")
                        : null,
                      toolArgs.body && Object.keys(toolArgs.body).length > 0
                        ? React.createElement("span", null, "Body: " + JSON.stringify(toolArgs.body))
                        : null
                    )
                  : null
              )
            )
          );
        }

        // Tool result message — show status and response body inline
        if (isTool) {
          var statusLine = msg._displayContent || 'Tool result';
          // Parse out the response body from content (format: "Status: NNN ...\n\n<body>")
          var responseBody = '';
          var statusColor = '#10b981';
          if (msg.content) {
            var parts = msg.content.split('\n\n');
            var statusPart = parts[0] || '';
            responseBody = parts.slice(1).join('\n\n');
            // Extract status code for coloring
            var statusMatch = statusPart.match(/Status:\s*(\d+)/);
            if (statusMatch) {
              var code = parseInt(statusMatch[1]);
              statusColor = (code >= 200 && code < 300) ? '#10b981' : '#f87171';
            }
          }
          // Try to pretty-print JSON
          var formattedBody = responseBody;
          try {
            var parsed = JSON.parse(responseBody);
            formattedBody = JSON.stringify(parsed, null, 2);
          } catch (e) {}

          return React.createElement(
            "div",
            { key: msg.messageId || msg.timestamp, className: "llm-chat-message-wrapper" },
            React.createElement(
              "div",
              {
                className: "llm-chat-message assistant",
                style: { maxWidth: "90%", borderLeft: "3px solid " + statusColor }
              },
              React.createElement("div", { className: "llm-avatar assistant-avatar", style: { background: "linear-gradient(135deg, " + statusColor + ", #059669)" } }, "\uD83D\uDCE1"),
              React.createElement(
                "div",
                { style: { flex: 1, minWidth: 0 } },
                React.createElement(
                  "div",
                  {
                    className: "llm-chat-message-header",
                    style: { display: "flex", justifyContent: "space-between", alignItems: "center" }
                  },
                  React.createElement("span", { style: { fontSize: "13px", fontWeight: "600", color: statusColor } }, statusLine),
                  React.createElement(
                    "button",
                    {
                      className: "llm-copy-btn",
                      onClick: function() { self.copyToClipboard(responseBody, msg.messageId); },
                      title: "Copy response",
                      style: Object.assign({}, styles.copyMessageBtn, { opacity: 1 })
                    },
                    self.state.copiedMessageId === msg.messageId ? "\u2705" : "\uD83D\uDCCB"
                  )
                ),
                formattedBody ? React.createElement(
                  "pre",
                  {
                    style: {
                      background: "var(--theme-input-bg)",
                      border: "1px solid var(--theme-border-color)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      fontSize: "11px",
                      fontFamily: "'Consolas', 'Monaco', monospace",
                      maxHeight: "200px",
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      color: "var(--theme-text-primary)",
                      margin: "6px 0 0 0",
                      lineHeight: "1.4",
                    }
                  },
                  formattedBody.substring(0, 2000)
                ) : null
              )
            )
          );
        }

        return React.createElement(
          "div",
          { key: msg.messageId || msg.timestamp, className: "llm-chat-message-wrapper" },
          React.createElement(
            "div",
            {
              className: "llm-chat-message " + (isUser ? 'user' : 'assistant'),
              style: { maxWidth: isUser ? "85%" : "90%" }
            },
            !isUser && React.createElement("div", {
              className: "llm-avatar assistant-avatar",
              title: "AI Assistant"
            }, "\uD83E\uDD16"),
            React.createElement(
              "div",
              {
                className: "llm-chat-message-header",
                onMouseEnter: function() { self.setHeaderHover(msg.messageId || msg.timestamp, true); },
                onMouseLeave: function() { self.setHeaderHover(msg.messageId || msg.timestamp, false); }
              },
              isUser
                ? React.createElement("span", { className: "llm-user-label" }, "You")
                : React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
                    React.createElement("span", { className: "llm-assistant-label" }, "Assistant"),
                    React.createElement("span", { className: "llm-chat-message-time" },
                      (msg.messageId || msg.timestamp) ? new Date(parseInt((msg.messageId || "").split('_')[0] || msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                    )
                  ),
              React.createElement(
                "button",
                {
                  className: "llm-copy-btn",
                  onClick: function() { self.copyToClipboard(msg.content, msg.messageId); },
                  title: "Copy message",
                  style: Object.assign({}, styles.copyMessageBtn, {
                    opacity: (self.state.headerHover[msg.messageId || msg.timestamp] || self.state.copiedMessageId === msg.messageId) && !isStreamingThisMessage ? 1 : 0
                  })
                },
                self.state.copiedMessageId === msg.messageId ? "\u2705" : "\uD83D\uDCCB"
              )
            ),
            React.createElement(
              "div",
              { className: "llm-chat-message-content" },
              this.formatMessageContent(msg.content, isStreamingThisMessage)
            )
          )
        );
      }

      formatMessageContent(content, isStreaming) {
        var React = system.React;
        
        // If content is empty and we're streaming, show a "streaming..." indicator
        if (!content || !content.trim()) {
          if (isStreaming) {
            return React.createElement("span", { 
              className: "llm-streaming-indicator",
              style: { fontStyle: 'italic', opacity: 0.7, fontSize: '13px', marginTop: '8px' }
            }, "Stream starting...");
          }
          return null;
        }
        
        // Parse Markdown
        var html = parseMarkdown(content);
        
        return React.createElement("div", {
          className: "llm-chat-message-text",
          style: styles.chatMessageContent,
          dangerouslySetInnerHTML: { __html: html }
        });
      }

      _buildCurlCommand() {
        var s = this.state;
        var toolSettings = loadToolSettings();
        var settings = loadFromStorage();

        // Build the resolved URL
        var url = s.editPath;
        try {
          var pathParams = JSON.parse(s.editPathParams || '{}');
          Object.keys(pathParams).forEach(function(key) {
            url = url.replace('{' + key + '}', encodeURIComponent(pathParams[key]));
          });
        } catch (e) {}

        try {
          var queryParams = JSON.parse(s.editQueryParams || '{}');
          var queryKeys = Object.keys(queryParams);
          if (queryKeys.length > 0) {
            var qs = queryKeys.map(function(k) {
              return encodeURIComponent(k) + '=' + encodeURIComponent(queryParams[k]);
            }).join('&');
            url += (url.indexOf('?') >= 0 ? '&' : '?') + qs;
          }
        } catch (e) {}

        // Use current origin for relative paths
        var fullUrl = url.startsWith('http') ? url : window.location.origin + url;

        var parts = ['curl'];
        if (s.editMethod !== 'GET') {
          parts.push('-X ' + s.editMethod);
        }
        parts.push("'" + fullUrl + "'");

        // Only include X-LLM-* headers when the endpoint declares them
        var openapiSchema = settings.openapiSchema || null;
        if (endpointNeedsLLMHeaders(openapiSchema, s.editPath)) {
          if (settings.baseUrl) parts.push("-H 'X-LLM-Base-Url: " + settings.baseUrl + "'");
          if (settings.apiKey) parts.push("-H 'X-LLM-Api-Key: " + settings.apiKey + "'");
          if (settings.modelId) parts.push("-H 'X-LLM-Model-Id: " + settings.modelId + "'");
          if (settings.maxTokens != null && settings.maxTokens !== '') parts.push("-H 'X-LLM-Max-Tokens: " + settings.maxTokens + "'");
          if (settings.temperature != null && settings.temperature !== '') parts.push("-H 'X-LLM-Temperature: " + settings.temperature + "'");
        }

        if (toolSettings.apiKey) {
          parts.push("-H 'Authorization: Bearer " + toolSettings.apiKey + "'");
        }

        if (s.editMethod === 'POST') {
          parts.push("-H 'Content-Type: application/json'");
          try {
            var body = JSON.parse(s.editBody || '{}');
            if (Object.keys(body).length > 0) {
              parts.push("-d '" + JSON.stringify(body) + "'");
            }
          } catch (e) {
            if (s.editBody && s.editBody.trim()) {
              parts.push("-d '" + s.editBody.trim() + "'");
            }
          }
        }

        return parts.join(' \\\n  ');
      }

      renderToolCallPanel() {
        var React = system.React;
        var self = this;
        var s = this.state;

        if (!s.pendingToolCall) return null;

        var panelStyle = {
          padding: "10px 12px",
          borderTop: "1px solid var(--theme-border-color)",
          background: "var(--theme-panel-bg)",
          fontSize: "13px",
        };
        var inputStyle = {
          background: "var(--theme-input-bg)",
          border: "1px solid var(--theme-border-color)",
          borderRadius: "4px",
          color: "var(--theme-text-primary)",
          padding: "5px 8px",
          fontSize: "12px",
          fontFamily: "'Consolas', 'Monaco', monospace",
          width: "100%",
          boxSizing: "border-box",
        };
        var labelStyle = { color: "var(--theme-text-secondary)", fontSize: "11px", marginBottom: "2px" };
        var headerStyle = { color: "var(--theme-text-primary)", fontSize: "13px", fontWeight: "600", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" };
        var smallBtnStyle = {
          background: "transparent",
          border: "1px solid var(--theme-border-color)",
          borderRadius: "4px",
          color: "var(--theme-text-secondary)",
          padding: "3px 8px",
          cursor: "pointer",
          fontSize: "11px",
          transition: "all 0.15s ease",
        };

        var curlCmd = self._buildCurlCommand();

        return React.createElement(
          "div",
          { style: panelStyle },
          // Header
          React.createElement("div", { style: headerStyle },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
              "\uD83D\uDD27 ",
              React.createElement("span", null, "api_request"),
              React.createElement("span", { style: { color: "var(--theme-text-secondary)", fontWeight: "400", fontSize: "12px" } },
                s.editMethod + " " + s.editPath
              )
            ),
            React.createElement(
              "div",
              { style: { display: "flex", gap: "4px" } },
              React.createElement(
                "button",
                {
                  onClick: function() {
                    navigator.clipboard.writeText(curlCmd).then(function() {
                      self.setState({ _curlCopied: true });
                      setTimeout(function() { self.setState({ _curlCopied: false }); }, 1500);
                    });
                  },
                  style: Object.assign({}, smallBtnStyle, s._curlCopied ? { color: "#10b981", borderColor: "#10b981" } : {}),
                  title: "Copy as curl"
                },
                s._curlCopied ? "\u2705" : "\uD83D\uDCCB curl"
              ),
              React.createElement(
                "button",
                {
                  onClick: function() {
                    var params = { method: s.editMethod, path: s.editPath };
                    try { var qp = JSON.parse(s.editQueryParams || '{}'); if (Object.keys(qp).length > 0) params.query_params = qp; } catch (e) {}
                    try { var pp = JSON.parse(s.editPathParams || '{}'); if (Object.keys(pp).length > 0) params.path_params = pp; } catch (e) {}
                    if (s.editMethod === 'POST') { try { params.body = JSON.parse(s.editBody || '{}'); } catch (e) { params.body = s.editBody; } }
                    navigator.clipboard.writeText(JSON.stringify(params, null, 2)).then(function() {
                      self.setState({ _jsonCopied: true });
                      setTimeout(function() { self.setState({ _jsonCopied: false }); }, 1500);
                    });
                  },
                  style: Object.assign({}, smallBtnStyle, s._jsonCopied ? { color: "#10b981", borderColor: "#10b981" } : {}),
                  title: "Copy as JSON"
                },
                s._jsonCopied ? "\u2705" : "\uD83D\uDCCB JSON"
              )
            )
          ),
          // Curl preview
          React.createElement(
            "pre",
            {
              style: {
                background: "var(--theme-input-bg)",
                border: "1px solid var(--theme-border-color)",
                borderRadius: "6px",
                padding: "8px 10px",
                fontSize: "11px",
                fontFamily: "'Consolas', 'Monaco', monospace",
                color: "var(--theme-text-primary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: "0 0 8px 0",
                lineHeight: "1.4",
                maxHeight: "120px",
                overflowY: "auto",
              }
            },
            curlCmd
          ),
          // Compact editable fields
          React.createElement("div", { style: { display: "flex", gap: "6px", marginBottom: "8px", alignItems: "flex-end" } },
            React.createElement(
              "div",
              { style: { flex: "0 0 80px" } },
              React.createElement("div", { style: labelStyle }, "Method"),
              React.createElement("select", { value: s.editMethod, onChange: function(e) { self.setState({ editMethod: e.target.value }); }, style: inputStyle },
                React.createElement("option", { value: "GET" }, "GET"),
                React.createElement("option", { value: "POST" }, "POST")
              )
            ),
            React.createElement(
              "div",
              { style: { flex: 1 } },
              React.createElement("div", { style: labelStyle }, "Path"),
              React.createElement("input", { type: "text", value: s.editPath, onChange: function(e) { self.setState({ editPath: e.target.value }); }, style: inputStyle })
            ),
            React.createElement(
              "div",
              { style: { flex: 1 } },
              React.createElement("div", { style: labelStyle }, "Query"),
              React.createElement("input", { type: "text", value: s.editQueryParams, onChange: function(e) { self.setState({ editQueryParams: e.target.value }); }, style: inputStyle, placeholder: '{}' })
            )
          ),
          // Body for POST
          s.editMethod === 'POST' && React.createElement("div", { style: { marginBottom: "8px" } },
            React.createElement("div", { style: Object.assign({}, labelStyle, { display: "flex", alignItems: "center", justifyContent: "space-between" }) }, 
              "Body",
              React.createElement("span", { style: { fontSize: "10px", color: "var(--theme-text-secondary)", fontWeight: "400" } }, "JSON")
            ),
            React.createElement("textarea", { value: s.editBody, onChange: function(e) { self.setState({ editBody: e.target.value }); }, style: Object.assign({}, inputStyle, { resize: "vertical", minHeight: "72px" }), rows: 4, placeholder: '{}' })
          ),
          // Buttons
          React.createElement(
            "div",
            { style: { display: "flex", gap: "8px" } },
            React.createElement("button", {
              onClick: self.handleExecuteToolCall,
              style: { background: "var(--theme-primary)", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "500" }
            }, "\u25B6 Execute"),
            React.createElement("button", {
              onClick: function() { self._pendingToolCallMsg = null; self.setState({ pendingToolCall: null, toolCallResponse: null }); },
              style: { background: "var(--theme-accent)", color: "#fff", border: "none", borderRadius: "4px", padding: "5px 14px", cursor: "pointer", fontSize: "12px" }
            }, "Dismiss")
          )
        );
      }

      render() {
        var React = system.React;
        var self = this;
        var chatHistory = this.state.chatHistory || [];

        return React.createElement(
          "div",
          { className: "llm-chat-container", style: styles.chatContainer },
          React.createElement(
            "div",
            { id: "llm-chat-messages", style: styles.chatMessages },
            chatHistory.length === 0
              ? React.createElement(
                  "div",
                  { style: styles.emptyChat },
                  "Ask questions about your API!\n\nExamples:\n• What endpoints are available?\n• How do I use the chat completions endpoint?\n• Generate a curl command for /health"
                )
              : chatHistory.map(this.renderMessage)
            ),
          this.state.isTyping
            ? React.createElement(
                "div",
                { style: { padding: "8px 12px", color: "var(--theme-text-secondary)", fontSize: "12px" } },
                this.renderTypingIndicator()
              )
            : null,
          // Tool call panel rendered inline in chat messages (see renderMessage)
          // Show pending tool call panel below messages if waiting for user action
          this.state.pendingToolCall && !this.state.isTyping ? this.renderToolCallPanel() : null,
          React.createElement(
            "div",
            { className: "llm-chat-input-area", style: styles.chatInputArea },
            React.createElement("textarea", {
              value: this.state.input,
              onChange: this.handleInputChange,
              onKeyDown: this.handleKeyDown,
              placeholder: "Ask about your API... (Shift+Enter for new line)",
              style: styles.chatInput,
              rows: 2
            }),
            React.createElement(
              "div",
              { style: styles.chatControls },
              // Clear button - separate from send/cancel group
              React.createElement(
                "button",
                {
                  onClick: this.clearHistory,
                  style: Object.assign({}, styles.chatButton, styles.chatButtonSecondary),
                  title: "Clear chat history"
                },
                "Clear"
              ),
              // Send/Cancel button group
              React.createElement(
                "div",
                { style: { display: "flex", gap: "8px" } },
                this.state.isTyping && React.createElement(
                  "button",
                  {
                    onClick: function() { 
                      if (self._currentCancelToken) self._currentCancelToken.abort(); 
                    },
                    style: Object.assign({}, styles.chatButton, styles.chatButtonDanger),
                    title: "Cancel streaming response"
                  },
                "❌ Cancel"
              ),
              React.createElement(
                "button",
                {
                  onClick: this.handleSend,
                  disabled: !this.state.input.trim() || this.state.isTyping,
                  style: Object.assign({}, styles.chatButton, styles.chatButtonPrimary, {
                    opacity: (!this.state.input.trim() || this.state.isTyping) ? 0.6 : 1,
                    cursor: (!this.state.input.trim() || this.state.isTyping) ? "not-allowed" : "pointer"
                  })
                },
                this.state.isTyping ? "..." : "Send"
              )
            )
          )
          )
        );
      }
    };
  }

  // ── LLMSettingsPanel component ───────────────────────────────────────────────
  function LLMSettingsPanelFactory(system) {
    var React = system.React;

    return class LLMSettingsPanel extends React.Component {
      constructor(props) {
        super(props);
        // Initialize with safe defaults from stored settings
        var s = loadFromStorage();
        var ts = loadToolSettings();
        this.state = {
          baseUrl: s.baseUrl || DEFAULT_STATE.baseUrl,
          apiKey: s.apiKey || DEFAULT_STATE.apiKey,
          modelId: s.modelId || DEFAULT_STATE.modelId,
          maxTokens: s.maxTokens != null && s.maxTokens !== '' ? s.maxTokens : DEFAULT_STATE.maxTokens,
          temperature: s.temperature != null && s.temperature !== '' ? s.temperature : DEFAULT_STATE.temperature,
          provider: s.provider || DEFAULT_STATE.provider,
          theme: DEFAULT_STATE.theme,
          customColors: DEFAULT_STATE.customColors,
          connectionStatus: "disconnected",
          settingsOpen: false,
          lastError: "",
          // Available models from connection test
          availableModels: [],
          // Tool calling settings
          enableTools: ts.enableTools || false,
          autoExecute: ts.autoExecute || false,
          toolApiKey: ts.apiKey || '',
        };
        // Create debounced save function for auto-save
        this._debouncedSave = debounce(this._saveSettings.bind(this), 300);
        this.handleTestConnection = this.handleTestConnection.bind(this);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.handleProviderChange = this.handleProviderChange.bind(this);
        this.handleBaseUrlChange = this.handleBaseUrlChange.bind(this);
        this.handleApiKeyChange = this.handleApiKeyChange.bind(this);
        this.handleModelIdChange = this.handleModelIdChange.bind(this);
        this.handleMaxTokensChange = this.handleMaxTokensChange.bind(this);
        this.handleTemperatureChange = this.handleTemperatureChange.bind(this);
        this.handleThemeChange = this.handleThemeChange.bind(this);
      }

      // Internal save method - called by debounced wrapper
      _saveSettings() {
        var settings = {
          baseUrl: this.state.baseUrl,
          apiKey: this.state.apiKey,
          modelId: this.state.modelId,
          maxTokens: this.state.maxTokens !== '' ? this.state.maxTokens : null,
          temperature: this.state.temperature !== '' ? this.state.temperature : null,
          provider: this.state.provider,
        };
        saveToStorage(settings);
        saveToolSettings({
          enableTools: this.state.enableTools,
          autoExecute: this.state.autoExecute,
          apiKey: this.state.toolApiKey,
        });
        saveTheme({ theme: this.state.theme, customColors: this.state.customColors });
      }

      // Auto-save method - called by field change handlers
      _autoSave() {
        this._debouncedSave();
      }

      componentDidMount() {
        // Reload theme from localStorage to ensure we have the latest values
        var stored = loadTheme();
        // Update state with validated theme from localStorage
        this.setState({ 
          theme: stored.theme || DEFAULT_STATE.theme, 
          customColors: stored.customColors || {} 
        });
        
        // Apply theme using requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(function() {
          window.applyLLMTheme(stored.theme || DEFAULT_STATE.theme, stored.customColors);
        });
      }

      componentDidUpdate(prevProps, prevState) {
        // Apply theme when theme or colors change
        if (prevState.theme !== this.state.theme || prevState.customColors !== this.state.customColors) {
          window.applyLLMTheme(this.state.theme, this.state.customColors);
        }
      }

      handleSaveSettings() {
        var settings = {
          baseUrl: this.state.baseUrl,
          apiKey: this.state.apiKey,
          modelId: this.state.modelId,
          maxTokens: this.state.maxTokens !== '' ? this.state.maxTokens : null,
          temperature: this.state.temperature !== '' ? this.state.temperature : null,
          provider: this.state.provider,
        };
        saveToStorage(settings);
        // Save tool calling settings
        saveToolSettings({
          enableTools: this.state.enableTools,
          autoExecute: this.state.autoExecute,
          apiKey: this.state.toolApiKey,
        });
        // Also ensure current theme is persisted to localStorage
        saveTheme({ theme: this.state.theme, customColors: this.state.customColors });
        // Don't change connection status, just save
      }

      handleTestConnection() {
        var self = this;
        var settings = {
          baseUrl: this.state.baseUrl,
          apiKey: this.state.apiKey,
          modelId: this.state.modelId,
          maxTokens: this.state.maxTokens !== '' ? this.state.maxTokens : null,
          temperature: this.state.temperature !== '' ? this.state.temperature : null,
          provider: this.state.provider,
        };
        // Update localStorage with current state values (for test)
        saveToStorage(settings);
        self.setState({ connectionStatus: "connecting", lastError: "" });
        dispatchAction(system, 'setConnectionStatus', "connecting");

        // Route through backend proxy to avoid CORS (new /llm/models endpoint)
        fetch("/llm/models", {
          method: 'GET',
          headers: {
            "Content-Type": "application/json",
            // Only include non-empty header values
            "X-LLM-Base-Url": settings.baseUrl || "",
            "X-LLM-Api-Key": settings.apiKey || "",
            "X-LLM-Model-Id": settings.modelId || "",
          }
        })
          .then(function (res) {
            if (!res.ok) {
              return res.json().catch(function() { 
                throw new Error('HTTP ' + res.status + ': ' + res.statusText); 
              });
            }
            return res.json();
          })
          .then(function (data) {
            // Check if response has error field
            if (data && data.error) {
              throw new Error(data.details || data.error);
            }
            // Extract model IDs from response
            var models = [];
            if (data && Array.isArray(data.data)) {
              models = data.data
                .map(function(m) { return m.id || m.name || ''; })
                .filter(function(id) { return id !== ''; })
                .sort();
            }
            var newState = { connectionStatus: "connected", availableModels: models };
            // Auto-select first model if current modelId is not in the list
            if (models.length > 0 && models.indexOf(self.state.modelId) === -1) {
              newState.modelId = models[0];
              dispatchAction(system, 'setModelId', models[0]);
            }
            self.setState(newState);
            dispatchAction(system, 'setConnectionStatus', "connected");
          })
          .catch(function (err) {
            var errorMsg = err.message || "Connection failed";
            self.setState({ connectionStatus: "error", lastError: errorMsg });
            dispatchAction(system, 'setConnectionStatus', "error");
          });
      }

      toggleOpen() {
        var newValue = !this.state.settingsOpen;
        this.setState({ settingsOpen: newValue });
        dispatchAction(system, 'setSettingsOpen', newValue);
      }

      handleProviderChange(e) {
        var value = e.target.value;
        var provider = LLM_PROVIDERS[value] || LLM_PROVIDERS.custom;
        this.setState({ provider: value, baseUrl: provider.url, availableModels: [], connectionStatus: "disconnected" });
        dispatchAction(system, 'setProvider', value);
        this._autoSave();
      }

      handleBaseUrlChange(e) {
        this.setState({ baseUrl: e.target.value });
        dispatchAction(system, 'setBaseUrl', e.target.value);
        this._autoSave();
      }

      handleApiKeyChange(e) {
        this.setState({ apiKey: e.target.value });
        dispatchAction(system, 'setApiKey', e.target.value);
        this._autoSave();
      }

      handleModelIdChange(e) {
        this.setState({ modelId: e.target.value });
        dispatchAction(system, 'setModelId', e.target.value);
        this._autoSave();
      }

      handleMaxTokensChange(e) {
        this.setState({ maxTokens: e.target.value });
        dispatchAction(system, 'setMaxTokens', e.target.value);
        this._autoSave();
      }

      handleTemperatureChange(e) {
        this.setState({ temperature: e.target.value });
        dispatchAction(system, 'setTemperature', e.target.value);
        this._autoSave();
      }

      handleThemeChange(e) {
        var value = e.target.value;
        this.setState({ theme: value });
        dispatchAction(system, 'setTheme', value);
        this._autoSave();
      }

      handleColorChange(colorKey, e) {
        var value = e.target.value;
        this.setState(function (prev) {
          var newColors = Object.assign({}, prev.customColors || {});
          newColors[colorKey] = value;
          return { customColors: newColors };
        });
        dispatchAction(system, 'setCustomColor', { key: colorKey, value: value });
        this._autoSave();
      }

      // Handler for enableTools checkbox
      handleEnableToolsChange(e) {
        this.setState({ enableTools: e.target.checked });
        this._autoSave();
      }

      // Handler for autoExecute checkbox
      handleAutoExecuteChange(e) {
        this.setState({ autoExecute: e.target.checked });
        this._autoSave();
      }

      // Handler for tool API key input
      handleToolApiKeyChange(e) {
        this.setState({ toolApiKey: e.target.value });
        this._autoSave();
      }

      render() {
        var self = this;
        var s = this.state;
        var React = system.React;

        var statusEmoji = STATUS_EMOJI[s.connectionStatus] || "⚪";
        var provider = LLM_PROVIDERS[s.provider] || LLM_PROVIDERS.custom;

        // Input styling (theme-aware)
        var inputStyle = {
          background: "var(--theme-input-bg)",
          border: "1px solid var(--theme-border-color)",
          borderRadius: "4px",
          color: "var(--theme-text-primary)",
          padding: "6px 10px",
          width: "100%",
          boxSizing: "border-box",
          fontSize: "13px",
        };

        var labelStyle = { color: "var(--theme-text-secondary)", fontSize: "12px", marginBottom: "4px", display: "block" };
        var fieldStyle = { marginBottom: "12px" };

        // Provider preset dropdown
        var providerOptions = Object.keys(LLM_PROVIDERS).map(function (key) {
          return React.createElement(
            "option",
            { key: key, value: key },
            LLM_PROVIDERS[key].name
          );
        });

        // Provider selection field
        var providerField = React.createElement(
          "div",
          { style: fieldStyle },
          React.createElement("label", { style: labelStyle }, "LLM Provider"),
          React.createElement(
            "select",
            {
              value: s.provider,
              onChange: this.handleProviderChange,
              style: inputStyle
            },
            providerOptions
          )
        );

        // Provider badge (no inline color overrides — CSS classes handle colors)
        var providerBadge = React.createElement(
          "span",
          { className: "llm-provider-badge llm-provider-" + (s.provider === 'custom' ? 'openai' : s.provider), style: { fontSize: "10px", padding: "2px 8px", borderRadius: "10px", marginLeft: "8px" } },
          provider.name
        );

        // Base URL field
        var baseUrlField = React.createElement(
          "div",
          { style: fieldStyle },
          React.createElement("label", { style: labelStyle }, "Base URL"),
          React.createElement("input", {
            type: "text",
            value: s.baseUrl,
            style: inputStyle,
            onChange: this.handleBaseUrlChange,
          })
        );

        var fields = React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" } },
          providerField,
          baseUrlField,
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "API Key"),
            React.createElement("input", {
              type: "password",
              value: s.apiKey,
              placeholder: "sk-...",
              style: inputStyle,
              onChange: this.handleApiKeyChange,
            })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Model ID"),
            s.availableModels.length > 0
              ? React.createElement(
                  "select",
                  {
                    value: s.modelId,
                    style: inputStyle,
                    onChange: this.handleModelIdChange,
                  },
                  s.availableModels.map(function (model) {
                    return React.createElement("option", { key: model, value: model }, model);
                  })
                )
              : React.createElement("input", {
                  type: "text",
                  value: s.modelId,
                  style: inputStyle,
                  onChange: this.handleModelIdChange,
                })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Max Tokens"),
            React.createElement("input", {
              type: "number",
              value: s.maxTokens !== '' ? s.maxTokens : "",
              min: 1,
              placeholder: "4096",
              style: inputStyle,
              onChange: this.handleMaxTokensChange,
            })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Temperature (0 – 2)"),
            React.createElement("input", {
              type: "number",
              value: s.temperature !== '' ? s.temperature : "",
              min: 0,
              max: 2,
              step: 0.1,
              placeholder: "0.7",
              style: inputStyle,
              onChange: this.handleTemperatureChange,
            })
          )
        );

        // Theme settings fields
        var themeConfig = React.createElement(
          "div",
          { style: fieldStyle },
          React.createElement("label", { style: labelStyle }, "Theme"),
          React.createElement(
            "select",
            {
              value: s.theme,
              onChange: this.handleThemeChange,
              style: inputStyle
            },
            Object.keys(THEME_DEFINITIONS).map(function (key) {
              return React.createElement(
                "option",
                { key: key, value: key },
                THEME_DEFINITIONS[key].name
              );
            })
          )
        );

        // Color picker fields
        var colorFields = React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" } },
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Primary"),
            React.createElement("input", {
              type: "color",
              value: s.customColors.primary || THEME_DEFINITIONS[s.theme].primary,
              onChange: this.handleColorChange.bind(this, 'primary'),
              style: { width: "60px", height: "32px", border: "none", cursor: "pointer" }
            })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Background"),
            React.createElement("input", {
              type: "color",
              value: s.customColors.background || THEME_DEFINITIONS[s.theme].background,
              onChange: this.handleColorChange.bind(this, 'background'),
              style: { width: "60px", height: "32px", border: "none", cursor: "pointer" }
            })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Text Primary"),
            React.createElement("input", {
              type: "color",
              value: s.customColors.textPrimary || THEME_DEFINITIONS[s.theme].textPrimary,
              onChange: this.handleColorChange.bind(this, 'textPrimary'),
              style: { width: "60px", height: "32px", border: "none", cursor: "pointer" }
            })
          )
        );

        // Tool calling settings
        var checkboxStyle = { marginRight: "8px", cursor: "pointer" };
        var checkboxLabelStyle = { color: "var(--theme-text-primary)", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center" };
        var toolCallSettings = React.createElement(
          "div",
          { style: { marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--theme-border-color)" } },
          React.createElement("h3", { style: { color: "var(--theme-text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "12px" } }, "Tool Calling (API Execution)"),
          React.createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 20px", alignItems: "start" } },
            React.createElement(
              "div",
              { style: fieldStyle },
              React.createElement(
                "label",
                { style: checkboxLabelStyle },
                React.createElement("input", {
                  type: "checkbox",
                  checked: s.enableTools,
                  onChange: this.handleEnableToolsChange,
                  style: checkboxStyle
                }),
                "Enable API Tool Calling"
              ),
              React.createElement("div", { style: { color: "var(--theme-text-secondary)", fontSize: "11px", marginTop: "4px" } },
                "Allow the LLM to execute API calls"
              )
            ),
            React.createElement(
              "div",
              { style: fieldStyle },
              React.createElement(
                "label",
                { style: checkboxLabelStyle },
                React.createElement("input", {
                  type: "checkbox",
                  checked: s.autoExecute,
                  onChange: this.handleAutoExecuteChange,
                  style: checkboxStyle,
                  disabled: !s.enableTools
                }),
                "Auto-Execute"
              ),
              React.createElement("div", { style: { color: "var(--theme-text-secondary)", fontSize: "11px", marginTop: "4px" } },
                "Execute tool calls without confirmation"
              )
            ),
            React.createElement(
              "div",
              { style: fieldStyle },
              React.createElement("label", { style: labelStyle }, "API Key for Tool Calls"),
              React.createElement("input", {
                type: "password",
                value: s.toolApiKey,
                placeholder: "Bearer token for target API",
                style: inputStyle,
                disabled: !s.enableTools,
                onChange: this.handleToolApiKeyChange
              })
            )
          )
        );

        var testButton = React.createElement(
          "button",
          {
            onClick: this.handleTestConnection,
            style: {
              background: "var(--theme-accent)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: "13px",
            },
          },
          "Test Connection"
        );

        var statusBadge = React.createElement(
          "span",
          {
            style: {
              marginLeft: "12px",
              fontSize: "13px",
              color: s.connectionStatus === "error" ? "#f87171" : "var(--theme-text-secondary)",
              verticalAlign: "middle",
            },
          },
          React.createElement(
            "span",
            { style: { marginRight: "4px" } },
            statusEmoji
          ),
          s.connectionStatus === "error"
            ? React.createElement(
                "span",
                { title: s.lastError, style: { cursor: "help", borderBottom: "1px dashed #f87171" } },
                s.lastError || "Connection failed"
              )
            : s.connectionStatus
        );

        // When used as a tab, render the full panel without collapsible header
        var bodyContent = React.createElement(
          "div",
          { style: { padding: "16px", background: "var(--theme-panel-bg)" } },
          React.createElement(
            "div",
            { style: { marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--theme-border-color)" } },
            React.createElement("h3", { style: { color: "var(--theme-text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "12px" } }, "LLM Configuration"),
            fields
          ),
          React.createElement(
            "div",
            { style: { marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid var(--theme-border-color)" } },
            React.createElement("h3", { style: { color: "var(--theme-text-primary)", fontSize: "14px", fontWeight: "600", marginBottom: "12px" } }, "Theme Settings"),
            React.createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 3fr", gap: "12px" } },
              themeConfig,
              React.createElement(
                "div",
                null,
                colorFields
              )
            )
          ),
          toolCallSettings,
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center" } },
            testButton,
            React.createElement("div", { style: { flex: 1 } }),
            statusBadge
          )
        );

        return React.createElement(
          "div",
          {
            id: "llm-settings-panel",
            style: {
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              minHeight: "400px",
            },
          },
          bodyContent
        );
      }
    };
  }

  // ── CSS styles object (uses CSS variables for theme support) ────────────────
  var styles = {
    chatContainer: {
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 90px)",
      minHeight: "300px",
    },
    chatMessages: {
      flex: 1,
      overflowY: "auto",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      scrollBehavior: "smooth",
    },
    chatMessage: {
      display: "flex",
      flexDirection: "column",
      padding: "10px 14px",
      borderRadius: "12px",
      maxWidth: "85%",
    },
    chatMessageHeader: {
      fontSize: "10px",
      marginBottom: "6px",
      opacity: 0.8,
    },
    chatMessageContent: {
      fontSize: "15px",
      lineHeight: "1.6",
    },
    copyMessageBtn: {
      background: "transparent",
      border: "none",
      color: "var(--theme-text-secondary)",
      fontSize: "14px",
      cursor: "pointer",
      padding: "2px 6px",
      borderRadius: "4px",
      opacity: 0,
      transition: "opacity 0.2s ease, color 0.2s ease",
    },
    chatInputArea: {
      borderTop: "1px solid var(--theme-border-color)",
      padding: "12px",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      flexShrink: 0,
    },
    chatInput: {
      width: "100%",
      background: "var(--theme-input-bg)",
      border: "1px solid var(--theme-border-color)",
      borderRadius: "4px",
      color: "var(--theme-text-primary)",
      padding: "10px 12px",
      fontSize: "14px",
      resize: "vertical",
      fontFamily: "'Inter', sans-serif",
      minHeight: "44px",
      maxHeight: "200px",
      overflowWrap: "break-word",
      wordWrap: "break-word",
      overflowX: "hidden",
      boxSizing: "border-box",
      lineHeight: "1.5",
    },
    chatControls: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "8px",
    },
    // Chat button styles - unified for consistency
    chatButton: {
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      transition: "all 0.2s ease",
    },
    chatButtonPrimary: {
      background: "var(--theme-primary)",
      color: "#fff",
      padding: "8px 16px",
    },
    chatButtonPrimaryHover: {
      background: "var(--theme-primary-hover)",
    },
    chatButtonDanger: {
      background: "#dc2626",
      color: "#fff",
      padding: "8px 16px",
    },
    chatButtonDangerHover: {
      background: "#b91c1c",
    },
    chatButtonSecondary: {
      background: "var(--theme-accent)",
      color: "#fff",
      padding: "8px 12px",
    },
    chatButtonSecondaryHover: {
      background: "#64748b",
    },
    // Deprecated - kept for compatibility
    smallButton: {
      background: "var(--theme-accent)",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: "10px",
    },
    sendButton: {
      background: "var(--theme-primary)",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "6px 16px",
      cursor: "pointer",
      fontSize: "12px",
    },
    emptyChat: {
      textAlign: "center",
      color: "var(--theme-text-secondary)",
      padding: "40px 20px",
      fontSize: "15px",
      whiteSpace: "pre-line",
    },
  };

  // ── CSS injection helper with guard to prevent duplicates ─────────────────
  function injectStyles(id, css) {
    if (typeof document === 'undefined') return;
    
    // Check for existing style element
    var existing = document.getElementById(id);
    if (existing) {
      // Update content if different
      if (existing.textContent !== css) {
        existing.textContent = css;
      }
      return;
    }
    
    var styleEl = document.createElement('style');
    styleEl.id = id;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  // ── CSS styles for chat bubbles, avatars, and animations (theme-aware) ─────
  var chatStyles = [
    // Chat container - full width with proper flex layout
    '.llm-chat-container { display: flex; flex-direction: column; height: 100%; min-height: 0; }',
    
    // Chat messages area - flexible height with overflow handling
    '.llm-chat-messages { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }',

    // Chat message wrapper styles
    '.llm-chat-message-wrapper { display: flex; width: 100%; margin-bottom: 8px; box-sizing: border-box; }',

    // Message bubble styles
    '.llm-chat-message { padding: 10px 14px; border-radius: 12px; max-width: 85%; position: relative; box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word; }',
    '.llm-chat-message.user { align-self: flex-end; background: var(--theme-primary); color: white; }',
    '.llm-chat-message.assistant { align-self: flex-start; background: var(--theme-secondary); color: var(--theme-text-primary); }',

    // Avatar styles
    '.llm-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-right: 8px; flex-shrink: 0; }',
    '.assistant-avatar { background: linear-gradient(135deg, #6366f1, #8b5cf6); }',
    '.llm-chat-message.assistant .llm-avatar { margin-right: 8px; }',

    // Message header (user/assistant label + time)
    '.llm-chat-message-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 11px; opacity: 0.9; flex-shrink: 0; }',
    '.llm-user-label { font-weight: 600; color: var(--theme-text-primary); }',
    '.llm-assistant-label { font-weight: 600; color: #8b5cf6; }',
    '.llm-chat-message-time { opacity: 0.7; font-size: 10px; }',

    // Copy button on messages
    '.llm-copy-btn { background: transparent; border: none; color: var(--theme-text-secondary); font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: all 0.2s ease; margin-left: 8px; }',
    '.llm-copy-btn:hover { background: var(--theme-accent); color: white; transform: scale(1.1); }',

    // Chat message text
    '.llm-chat-message-text { font-size: 15px; line-height: 1.6; word-wrap: break-word; overflow-wrap: break-word; }',
    '.llm-chat-message-text p { margin: 8px 0; }',
    '.llm-chat-message-text p:first-child { margin-top: 4px; }',
    '.llm-chat-message-text p:last-child { margin-bottom: 4px; }',

    // Streaming placeholder indicator
    '.llm-streaming-indicator { color: var(--theme-accent); font-style: italic; opacity: 0.7; font-size: 13px; margin-top: 8px; }',

    // Markdown content in messages
    '.llm-chat-message-text strong { color: var(--theme-text-primary); }',
    '.llm-chat-message-text em { font-style: italic; }',
    '.llm-chat-message-text ul { margin: 8px 0; padding-left: 24px; }',
    '.llm-chat-message-text ol { margin: 8px 0; padding-left: 24px; }',
    '.llm-chat-message-text li { margin: 4px 0; }',
    '.llm-chat-message-text blockquote { border-left: 3px solid var(--theme-accent); margin: 8px 0; padding-left: 12px; opacity: 0.9; }',
    '.llm-chat-message-text a { color: #60a5fa; text-decoration: none; }',
    '.llm-chat-message-text a:hover { text-decoration: underline; }',

    // Code blocks in messages
    '.llm-chat-message-text pre { background: var(--theme-input-bg); border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; font-family: "Consolas", "Monaco", monospace; font-size: 14px; position: relative; max-width: 100%; box-sizing: border-box; word-break: break-all; }',
    '.llm-chat-message-text code { font-family: "Consolas", "Monaco", monospace; background: rgba(0,0,0,0.15); padding: 2px 6px; border-radius: 4px; font-size: 13px; }',
    '.llm-chat-message-text pre code { background: transparent; padding: 0; }',

    // Code block header with copy button
    '.code-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--theme-border-color); }',
    '.code-block-label { color: var(--theme-text-secondary); font-size: 12px; font-weight: 600; }',
    '.code-block-copy { background: var(--theme-secondary); border: none; color: var(--theme-text-primary); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.2s; }',
    '.code-block-copy:hover { background: var(--theme-accent); color: white; }',
    '.code-block-copy.copied { background: #10b981 !important; color: white; }',

    // Scrollbar styling
    '#llm-chat-messages::-webkit-scrollbar { width: 8px; }',
    '#llm-chat-messages::-webkit-scrollbar-track { background: var(--theme-panel-bg); border-radius: 4px; }',
    '#llm-chat-messages::-webkit-scrollbar-thumb { background: var(--theme-secondary); border-radius: 4px; }',
    '#llm-chat-messages::-webkit-scrollbar-thumb:hover { background: var(--theme-accent); }',

    // Typing indicator animation
    '@keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }',
    '.llm-typing-indicator { display: inline-flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--theme-secondary); border-radius: 18px; font-size: 14px; margin-bottom: 8px; }',
    '.llm-typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--theme-text-secondary); animation: typing 1.4s infinite ease-in-out both; }',
    '.llm-typing-dot:nth-child(1) { animation-delay: -0.32s; }',
    '.llm-typing-dot:nth-child(2) { animation-delay: -0.16s; }',

    // Chat input area - full width
    '.llm-chat-input-area { width: 100%; box-sizing: border-box; flex-shrink: 0; }',
    
    // Chat input - proper text handling
    '.llm-chat-input-area textarea { width: 100%; box-sizing: border-box; overflow-x: hidden; word-wrap: break-word; }',

    // Tablet responsive (768px - 1024px)
    '@media (min-width: 769px) and (max-width: 1024px) {',
    '  .llm-chat-message { max-width: 80%; }',
    '  .llm-chat-messages { padding: 10px; }',
    '}',

    // Large desktop (above 1200px)
    '@media (min-width: 1200px) {',
    '  .llm-chat-container { max-width: 100%; }',
    '  .llm-chat-message { max-width: 75%; }',
    '}',

    // Mobile responsive styles (up to 768px)
    '@media (max-width: 768px) {',
    '  .llm-chat-message-wrapper { width: 100%; padding: 0 4px; margin-bottom: 6px; }',
    '  .llm-chat-message { max-width: 90%; padding: 8px 10px; }',
    '  .llm-avatar { width: 26px; height: 26px; font-size: 14px; margin-right: 6px; }',
    '  .llm-chat-message-text { font-size: 14px; }',
    '  .llm-typing-indicator { font-size: 13px; padding: 8px 12px; }',
    '  .llm-chat-messages { padding: 6px; gap: 6px; }',
    '  .llm-chat-message-header { font-size: 10px; }',
    '  .llm-chat-message-text pre { font-size: 12px; padding: 8px; }',
    '}',

    // Mobile landscape - adjust height for browser chrome
    '@media (max-width: 768px) and (orientation: landscape) {',
    '  .llm-chat-container { height: calc(100dvh - 40px) !important; }',
    '}',

    // Error message styles
    '.llm-error-message {',
    '  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1));',
    '  border: 1px solid rgba(239, 68, 68, 0.3);',
    '  border-radius: 8px;',
    '  padding: 12px 14px;',
    '  margin: 4px 0;',
    '}',
    '.llm-error-title {',
    '  color: #ef4444;',
    '  font-weight: 600;',
    '  font-size: 14px;',
    '  margin-bottom: 6px;',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 6px;',
    '}',
    '.llm-error-title::before {',
    '  content: "⚠️";',
    '}',
    '.llm-error-text {',
    '  color: var(--theme-text-secondary);',
    '  font-size: 13px;',
    '  line-height: 1.5;',
    '}',
    '.llm-error-actions {',
    '  margin-top: 10px;',
    '}',
    '.llm-error-action-btn {',
    '  background: var(--theme-primary);',
    '  color: white;',
    '  border: none;',
    '  border-radius: 6px;',
    '  padding: 6px 14px;',
    '  font-size: 12px;',
    '  cursor: pointer;',
    '  transition: all 0.2s ease;',
    '}',
    '.llm-error-action-btn:hover {',
    '  background: var(--theme-primary-hover);',
    '  transform: translateY(-1px);',
    '}',
  ].join('\n');
  
  // Inject chat styles into document
  injectStyles('swagger-llm-chat-styles', chatStyles);

  // ── Plugin definition ───────────────────────────────────────────────────────
  window.LLMSettingsPlugin = function (system) {
    return {
      statePlugins: {
        llmSettings: {
          actions: actions,
          reducers: { llmSettings: llmSettingsReducer },
          selectors: selectors,
        },
      },
      components: {
        LLMSettingsPanel: LLMSettingsPanelFactory(system),
        ChatPanel: ChatPanelFactory(system),
      },
    };
  };

  // ── Theme injection function ────────────────────────────────────────────────
  window.applyLLMTheme = function (themeName, customColors) {
    // Validate theme name
    var validatedTheme = THEME_DEFINITIONS[themeName] ? themeName : 'dark';
    var themeDef = THEME_DEFINITIONS[validatedTheme];

    // Merge custom colors with theme defaults
    var finalColors = Object.assign({}, themeDef, customColors);

    // Build CSS variables string
    var cssVars = [
      '--theme-primary: ' + finalColors.primary,
      '--theme-primary-hover: ' + (finalColors.primaryHover || finalColors.primary),
      '--theme-secondary: ' + finalColors.secondary,
      '--theme-accent: ' + finalColors.accent,
      '--theme-background: ' + finalColors.background,
      '--theme-panel-bg: ' + (finalColors.panelBg || finalColors.secondary),
      '--theme-header-bg: ' + (finalColors.headerBg || finalColors.background),
      '--theme-border-color: ' + (finalColors.borderColor || finalColors.secondary),
      '--theme-text-primary: ' + finalColors.textPrimary,
      '--theme-text-secondary: ' + (finalColors.textSecondary || '#6b7280'),
      '--theme-input-bg: ' + (finalColors.inputBg || finalColors.secondary),
      '--theme-provider-openai: #10a37f',
      '--theme-provider-anthropic: #d97757',
      '--theme-provider-ollama: #2b90d8',
      '--theme-provider-vllm: #facc15',
      '--theme-provider-azure: #0078d4',
    ].join('; ');

    // Update existing theme style element or create new one using helper
    var css = ':root { ' + cssVars + ' }';
    var themeStyle = document.getElementById('swagger-llm-theme-styles');
    
    if (themeStyle) {
      // Only update if content is different to avoid unnecessary reflows
      if (themeStyle.textContent !== css) {
        themeStyle.textContent = css;
      }
    } else {
      themeStyle = document.createElement('style');
      themeStyle.id = 'swagger-llm-theme-styles';
      themeStyle.textContent = css;
      document.head.appendChild(themeStyle);
    }
  };

  // ── Global function to open settings tab ───────────────────────────────────
  // Called by error messages in chat when user needs to adjust settings
  window.llmOpenSettings = function() {
    try {
      localStorage.setItem("swagger-llm-active-tab", "settings");
    } catch (e) {
      console.warn('Failed to switch to settings tab:', e);
    }
  };
})();
