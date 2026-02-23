// LLM Settings Swagger UI Plugin
// Adds statePlugins.llmSettings and components.LLMSettingsPanel

(function () {
  "use strict";

  // ── LLM Provider configurations ─────────────────────────────────────────────
  var LLM_PROVIDERS = {
    openai: { name: 'OpenAI', url: 'https://api.openai.com/v1' },
    anthropic: { name: 'Anthropic', url: 'https://api.anthropic.com/v1' },
    ollama: { name: 'Ollama', url: 'http://localhost:11434/v1' },
    lmstudio: { name: 'LM Studio', url: 'http://localhost:1234/v1' },
    vllm: { name: 'vLLM', url: 'http://localhost:8000/v1' },
    azure: { name: 'Azure OpenAI', url: 'https://YOUR_RESOURCE_NAME.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT' },
    custom: { name: 'Custom', url: '' }
  };

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

  // ── Default state ───────────────────────────────────────────────────────────
  var STORAGE_KEY = "swagger-llm-settings";
  var CHAT_HISTORY_KEY = "swagger-llm-chat-history";

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveToStorage(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  var stored = loadFromStorage();

  var DEFAULT_STATE = {
    baseUrl: stored.baseUrl || "https://api.openai.com/v1",
    apiKey: stored.apiKey || "",
    modelId: stored.modelId || "gpt-4",
    maxTokens: stored.maxTokens != null ? stored.maxTokens : 4096,
    temperature: stored.temperature != null ? stored.temperature : 0.7,
    provider: stored.provider || "openai",
    connectionStatus: "disconnected", // disconnected | connecting | connected | error
    settingsOpen: false,
    chatHistory: loadChatHistory(),
    lastError: "",
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
        var newHistory = state.chatHistory
          ? [...state.chatHistory, action.payload]
          : [action.payload];
        saveChatHistory(newHistory);
        return Object.assign({}, state, { chatHistory: newHistory });
      case CLEAR_CHAT_HISTORY:
        saveChatHistory([]);
        return Object.assign({}, state, { chatHistory: [] });
      case SET_OPENAPI_SCHEMA:
        return Object.assign({}, state, { openapiSchema: action.payload });
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

  // ── Chat panel component ───────────────────────────────────────────────────
  function ChatPanelFactory(system) {
    var React = system.React;

    return class ChatPanel extends React.Component {
      constructor(props) {
        super(props);
        this.state = { input: "", isTyping: false };
        this.handleSend = this.handleSend.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.clearHistory = this.clearHistory.bind(this);
      }

      getStore() {
        // Safely get the Redux store from Swagger UI system
        try {
          var sys = system && typeof system.getSystem === 'function' ? system.getSystem() : null;
          return sys && sys.store ? sys.store : null;
        } catch (e) {
          return null;
        }
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

      handleSend() {
        if (!this.state.input.trim()) return;

        var userInput = this.state.input.trim();
        this.setState({ input: "", isTyping: true });

        // Add user message
        var settings = this.props.getSettings();
        if (settings && settings.apiKey) {
          // Simulate sending to LLM for now
          // In future, this would actually call the configured LLM API
          setTimeout(function () {
            var response = "I can help you with API documentation, generate curl commands, or write test code based on your OpenAPI spec.";
            var store = self.getStore();
            if (store) {
              var ui = store.getState();
              var chatHistory = selectors.getChatHistory(ui);

              // Simplified response - in a real implementation, this would call the API
              store.dispatch(actions.addChatMessage({
                role: 'user',
                content: userInput,
                timestamp: Date.now()
              }));
              store.dispatch(actions.addChatMessage({
                role: 'assistant',
                content: response,
                timestamp: Date.now()
              }));
            }

            // Scroll to bottom
            var chatContainer = document.getElementById('llm-chat-messages');
            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 500);
        }

        this.setState({ isTyping: false });
      }

      clearHistory() {
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.clearChatHistory());
        }
      }

      renderMessage(msg) {
        var React = system.React;
        var isUser = msg.role === 'user';
        return React.createElement(
          "div",
          { key: msg.timestamp, className: "llm-chat-message " + (isUser ? 'user' : 'assistant') },
          React.createElement(
            "div",
            { className: "llm-chat-message-header" },
            isUser ? "👤 You" : "🤖 Assistant",
            React.createElement(
              "span",
              { className: "llm-chat-message-time" },
              new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            )
          ),
          React.createElement(
            "div",
            { className: "llm-chat-message-content" },
            this.formatMessageContent(msg.content)
          )
        );
      }

      formatMessageContent(content) {
        // Simple markdown-like formatting
        var lines = content.split('\n');
        return React.createElement(
          "div",
          null,
          lines.map(function (line, idx) {
            if (line.startsWith('```')) return null; // Skip code block markers for now
            return React.createElement("p", { key: idx, style: { margin: '4px 0' } }, line);
          })
        );
      }

      render() {
        var React = system.React;
        var chatHistory = this.props.getChatHistory();

        return React.createElement(
          "div",
          { style: styles.chatContainer },
          React.createElement(
            "div",
            { id: "llm-chat-messages", style: styles.chatMessages },
            chatHistory.length === 0
              ? React.createElement(
                  "div",
                  { style: styles.emptyChat },
                  "Start a conversation about your API!\n\nAsk me to:\n• Generate curl commands\n• Explain endpoint parameters\n• Write test code\n• Create example requests"
                )
              : chatHistory.map(this.renderMessage.bind(this))
            ),
          React.createElement(
            "div",
            { style: styles.chatInputArea },
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
              React.createElement(
                "button",
                {
                  onClick: this.clearHistory,
                  style: styles.smallButton,
                  title: "Clear chat history"
                },
                "Clear"
              ),
              React.createElement(
                "button",
                {
                  onClick: this.handleSend,
                  disabled: !this.state.input.trim() || this.state.isTyping,
                  style: {
                    ...styles.sendButton,
                    opacity: (!this.state.input.trim() || this.state.isTyping) ? 0.5 : 1
                  }
                },
                this.state.isTyping ? "..." : "Send"
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
        var s = loadFromStorage();
        this.state = {
          baseUrl: s.baseUrl || DEFAULT_STATE.baseUrl,
          apiKey: s.apiKey || DEFAULT_STATE.apiKey,
          modelId: s.modelId || DEFAULT_STATE.modelId,
          maxTokens: s.maxTokens != null && s.maxTokens !== '' ? s.maxTokens : DEFAULT_STATE.maxTokens,
          temperature: s.temperature != null && s.temperature !== '' ? s.temperature : DEFAULT_STATE.temperature,
          provider: s.provider || DEFAULT_STATE.provider,
          connectionStatus: "disconnected",
          settingsOpen: false,
          lastError: "",
        };
        this.handleSaveAndTest = debounce(this.handleSaveAndTest.bind(this), 500);
        this.toggleOpen = this.toggleOpen.bind(this);
        this.handleConnectionTest = debounce(this.handleConnectionTest.bind(this), 500);
      }

      getStore() {
        // Safely get the Redux store from Swagger UI system
        try {
          var sys = system && typeof system.getSystem === 'function' ? system.getSystem() : null;
          return sys && sys.store ? sys.store : null;
        } catch (e) {
          return null;
        }
      }

      handleSaveAndTest() {
        var self = this;
        var settings = {
          baseUrl: this.state.baseUrl,
          apiKey: this.state.apiKey,
          modelId: this.state.modelId,
          maxTokens: this.state.maxTokens !== '' ? this.state.maxTokens : null,
          temperature: this.state.temperature !== '' ? this.state.temperature : null,
          provider: this.state.provider,
        };
        saveToStorage(settings);
        self.setState({ connectionStatus: "connecting", lastError: "" });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setConnectionStatus("connecting"));
        }

        var url = settings.baseUrl.replace(/\/$/, "") + "/models";
        var headers = { "Content-Type": "application/json" };
        if (settings.apiKey) {
          headers["Authorization"] = "Bearer " + settings.apiKey;
        }

        fetch(url, { method: 'GET', headers: headers })
          .then(function (res) {
            if (!res.ok) {
              throw new Error('HTTP ' + res.status + ': ' + res.statusText);
            }
            return res.json();
          })
          .then(function (data) {
            var status = data.models ? "connected" : "connected";
            self.setState({ connectionStatus: status });
            var store = self.getStore();
            if (store) {
              store.dispatch(actions.setConnectionStatus(status));
            }
          })
          .catch(function (err) {
            var errorMsg = err.message || "Connection failed";
            self.setState({ connectionStatus: "error", lastError: errorMsg });
            var store = self.getStore();
            if (store) {
              store.dispatch(actions.setConnectionStatus("error"));
            }
          });
      }

      handleConnectionTest() {
        // Trigger a test without saving
        this.handleSaveAndTest();
      }

      toggleOpen() {
        var newValue = !this.state.settingsOpen;
        this.setState({ settingsOpen: newValue });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setSettingsOpen(newValue));
        }
      }

      handleProviderChange(e) {
        this.setState({ provider: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setProvider(e.target.value));
        }
      }

      handleBaseUrlChange(e) {
        this.setState({ baseUrl: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setBaseUrl(e.target.value));
        }
      }

      handleApiKeyChange(e) {
        this.setState({ apiKey: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setApiKey(e.target.value));
        }
      }

      handleModelIdChange(e) {
        this.setState({ modelId: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setModelId(e.target.value));
        }
      }

      handleMaxTokensChange(e) {
        this.setState({ maxTokens: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setMaxTokens(e.target.value));
        }
      }

      handleTemperatureChange(e) {
        this.setState({ temperature: e.target.value });
        var store = this.getStore();
        if (store) {
          store.dispatch(actions.setTemperature(e.target.value));
        }
      }

      render() {
        var self = this;
        var s = this.state;
        var React = system.React;

        var statusEmoji = STATUS_EMOJI[s.connectionStatus] || "⚪";
        var provider = LLM_PROVIDERS[s.provider] || LLM_PROVIDERS.custom;

        // Input styling
        var inputStyle = {
          background: "#1f2937",
          border: "1px solid #374151",
          borderRadius: "4px",
          color: "#e5e7eb",
          padding: "6px 10px",
          width: "100%",
          boxSizing: "border-box",
          fontSize: "13px",
        };

        var labelStyle = { color: "#9ca3af", fontSize: "12px", marginBottom: "4px", display: "block" };
        var fieldStyle = { marginBottom: "12px" };

        // Provider preset dropdown
        var providerOptions = Object.entries(LLM_PROVIDERS).map(function ([key, config]) {
          return React.createElement(
            "option",
            { key: key, value: key },
            config.name
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
              onChange: this.handleProviderChange.bind(this),
              style: inputStyle
            },
            providerOptions
          )
        );

        // Provider badge (read-only indicator next to header)
        var provider = LLM_PROVIDERS[s.provider] || LLM_PROVIDERS.custom;
        var providerBadge = React.createElement(
          "span",
          { className: "llm-provider-badge llm-provider-" + (s.provider === 'custom' ? 'openai' : s.provider), style: { fontSize: "10px", padding: "2px 8px", background: "#374151", borderRadius: "10px", color: "#9ca3af", marginLeft: "8px" } },
          provider.name
        );

        // Base URL field (auto-updates when preset changes)
        var baseUrlField = React.createElement(
          "div",
          { style: fieldStyle },
          React.createElement("label", { style: labelStyle }, "Base URL"),
          React.createElement(
            "div",
            { style: { display: "flex", alignItems: "center" } },
            React.createElement("input", {
              type: "text",
              value: s.baseUrl,
              style: { ...inputStyle, flex: 1 },
              onChange: this.handleBaseUrlChange.bind(this),
            }),
            provider.name !== 'Custom' && React.createElement(
              "span",
              { style: { marginLeft: "8px", fontSize: "10px", color: "#6b7280" } },
              provider.url
            )
          )
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
              placeholder: "sk-…",
              style: inputStyle,
              onChange: this.handleApiKeyChange.bind(this),
            })
          ),
          React.createElement(
            "div",
            { style: fieldStyle },
            React.createElement("label", { style: labelStyle }, "Model ID"),
            React.createElement("input", {
              type: "text",
              value: s.modelId,
              style: inputStyle,
              onChange: this.handleModelIdChange.bind(this),
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
              onChange: this.handleMaxTokensChange.bind(this),
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
              onChange: this.handleTemperatureChange.bind(this),
            })
          )
        );

        var saveButton = React.createElement(
          "button",
          {
            onClick: this.handleSaveAndTest,
            style: {
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "600",
            },
          },
          "Save & Test Connection"
        );

        var testButton = React.createElement(
          "button",
          {
            onClick: this.handleConnectionTest,
            style: {
              background: "#4b5563",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "12px",
              marginLeft: "8px",
            },
          },
          "Test"
        );

        var statusBadge = React.createElement(
          "span",
          {
            style: {
              marginLeft: "12px",
              fontSize: "13px",
              color: s.connectionStatus === "error" ? "#f87171" : "#9ca3af",
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

        var header = React.createElement(
          "div",
          {
            onClick: this.toggleOpen,
            style: {
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              padding: "10px 16px",
              background: "#111827",
              borderBottom: s.settingsOpen ? "1px solid #374151" : "none",
              userSelect: "none",
            },
          },
          React.createElement("span", { style: { fontSize: "16px", marginRight: "8px" } }, "🤖"),
          React.createElement(
            "span",
            { style: { fontWeight: "600", color: "#e5e7eb", fontSize: "14px", flexGrow: 1 } },
            "LLM Settings"
          ),
          providerBadge,
          React.createElement(
            "span",
            { style: { color: "#6b7280", fontSize: "12px", cursor: "pointer" } },
            s.settingsOpen ? "▲ collapse" : "▼ expand"
          )
        );

        var body = s.settingsOpen
          ? React.createElement(
              "div",
              { style: { padding: "16px", background: "#1f2937" } },
              fields,
              React.createElement(
                "div",
                { style: { display: "flex", alignItems: "center", marginTop: "8px" } },
                saveButton,
                testButton,
                statusBadge
              ),
              React.createElement(
                "div",
                { style: { marginTop: "12px", padding: "10px", background: "#374151", borderRadius: "4px" } },
                React.createElement(
                  "div",
                  { style: { fontSize: "12px", fontWeight: "600", color: "#e5e7eb", marginBottom: "8px" } },
                  "Quick Actions"
                ),
                React.createElement(
                  "div",
                  { style: { display: "flex", gap: "8px" } },
                  React.createElement(
                    "button",
                    {
                      onClick: function () { self.setState({ settingsOpen: false }); },
                      style: {
                        background: "#2563eb",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        cursor: "pointer",
                        fontSize: "11px"
                      }
                    },
                    "Hide Panel"
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: function () { window.ui.specActions.download(); },
                      style: {
                        background: "#4b5563",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        padding: "6px 12px",
                        cursor: "pointer",
                        fontSize: "11px"
                      }
                    },
                    "Download OpenAPI"
                  )
                )
              )
            )
          : null;

        return React.createElement(
          "div",
          {
            id: "llm-settings-panel",
            style: {
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              border: "1px solid #374151",
              borderRadius: "6px",
              margin: "0 0 16px 0",
              overflow: "hidden",
            },
          },
          header,
          body
        );
      }
    };
  }

  // ── CSS styles object ───────────────────────────────────────────────────────
  var styles = {
    chatContainer: {
      display: "flex",
      flexDirection: "column",
      height: "400px",
    },
    chatMessages: {
      flex: 1,
      overflowY: "auto",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    },
    chatMessage: {
      display: "flex",
      flexDirection: "column",
      padding: "8px",
      borderRadius: "8px",
      maxWidth: "90%",
    },
    chatMessageUser: {
      alignSelf: "flex-end",
      background: "#2563eb",
      color: "#fff",
    },
    chatMessageAssistant: {
      alignSelf: "flex-start",
      background: "#374151",
      color: "#e5e7eb",
    },
    chatMessageHeader: {
      fontSize: "10px",
      marginBottom: "4px",
      opacity: 0.7,
    },
    chatMessageContent: {
      fontSize: "13px",
      lineHeight: "1.5",
    },
    chatInputArea: {
      borderTop: "1px solid #374151",
      padding: "12px",
    },
    chatInput: {
      width: "100%",
      background: "#1f2937",
      border: "1px solid #374151",
      borderRadius: "4px",
      color: "#e5e7eb",
      padding: "8px 10px",
      fontSize: "13px",
      resize: "none",
      fontFamily: "'Inter', sans-serif",
    },
    chatControls: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: "8px",
    },
    smallButton: {
      background: "#4b5563",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "4px 10px",
      cursor: "pointer",
      fontSize: "10px",
    },
    sendButton: {
      background: "#2563eb",
      color: "#fff",
      border: "none",
      borderRadius: "4px",
      padding: "6px 16px",
      cursor: "pointer",
      fontSize: "12px",
    },
    emptyChat: {
      textAlign: "center",
      color: "#9ca3af",
      padding: "40px 20px",
      fontSize: "13px",
    },
  };

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
})();
