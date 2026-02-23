// LLM Settings Swagger UI Plugin
// Adds statePlugins.llmSettings and components.LLMSettingsPanel

(function () {
  "use strict";

  // ── Action types ────────────────────────────────────────────────────────────
  var SET_BASE_URL = "LLM_SET_BASE_URL";
  var SET_API_KEY = "LLM_SET_API_KEY";
  var SET_MODEL_ID = "LLM_SET_MODEL_ID";
  var SET_MAX_TOKENS = "LLM_SET_MAX_TOKENS";
  var SET_TEMPERATURE = "LLM_SET_TEMPERATURE";
  var SET_CONNECTION_STATUS = "LLM_SET_CONNECTION_STATUS";

  // ── Default state ────────────────────────────────────────────────────────────
  var STORAGE_KEY = "swagger-llm-settings";

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

  var stored = loadFromStorage();

  var DEFAULT_STATE = {
    baseUrl: stored.baseUrl || "https://api.openai.com/v1",
    apiKey: stored.apiKey || "",
    modelId: stored.modelId || "gpt-4",
    maxTokens: stored.maxTokens != null ? stored.maxTokens : 4096,
    temperature: stored.temperature != null ? stored.temperature : 0.7,
    connectionStatus: "disconnected", // disconnected | connecting | connected | error
  };

  // ── Reducer ──────────────────────────────────────────────────────────────────
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
        return Object.assign({}, state, { maxTokens: action.payload });
      case SET_TEMPERATURE:
        return Object.assign({}, state, { temperature: action.payload });
      case SET_CONNECTION_STATUS:
        return Object.assign({}, state, { connectionStatus: action.payload });
      default:
        return state;
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  var actions = {
    setBaseUrl: function (value) { return { type: SET_BASE_URL, payload: value }; },
    setApiKey: function (value) { return { type: SET_API_KEY, payload: value }; },
    setModelId: function (value) { return { type: SET_MODEL_ID, payload: value }; },
    setMaxTokens: function (value) { return { type: SET_MAX_TOKENS, payload: Number(value) }; },
    setTemperature: function (value) { return { type: SET_TEMPERATURE, payload: Number(value) }; },
    setConnectionStatus: function (value) { return { type: SET_CONNECTION_STATUS, payload: value }; },
  };

  // ── Selectors ────────────────────────────────────────────────────────────────
  var selectors = {
    getBaseUrl: function (state) { return state.get ? state.get("baseUrl") : state.baseUrl; },
    getApiKey: function (state) { return state.get ? state.get("apiKey") : state.apiKey; },
    getModelId: function (state) { return state.get ? state.get("modelId") : state.modelId; },
    getMaxTokens: function (state) { return state.get ? state.get("maxTokens") : state.maxTokens; },
    getTemperature: function (state) { return state.get ? state.get("temperature") : state.temperature; },
    getConnectionStatus: function (state) { return state.get ? state.get("connectionStatus") : state.connectionStatus; },
  };

  // ── Status indicator ─────────────────────────────────────────────────────────
  var STATUS_EMOJI = {
    disconnected: "⚪",
    connecting: "🟡",
    connected: "🟢",
    error: "🔴",
  };

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
          maxTokens: s.maxTokens != null ? s.maxTokens : DEFAULT_STATE.maxTokens,
          temperature: s.temperature != null ? s.temperature : DEFAULT_STATE.temperature,
          connectionStatus: "disconnected",
          open: false,
        };
        this.handleSaveAndTest = this.handleSaveAndTest.bind(this);
        this.toggleOpen = this.toggleOpen.bind(this);
      }

      handleSaveAndTest() {
        var self = this;
        var settings = {
          baseUrl: this.state.baseUrl,
          apiKey: this.state.apiKey,
          modelId: this.state.modelId,
          maxTokens: this.state.maxTokens,
          temperature: this.state.temperature,
        };
        saveToStorage(settings);
        self.setState({ connectionStatus: "connecting" });

        var url = settings.baseUrl.replace(/\/$/, "") + "/models";
        var headers = { "Content-Type": "application/json" };
        if (settings.apiKey) {
          headers["Authorization"] = "Bearer " + settings.apiKey;
        }

        fetch(url, { method: "GET", headers: headers })
          .then(function (res) {
            self.setState({ connectionStatus: res.ok ? "connected" : "error" });
          })
          .catch(function () {
            self.setState({ connectionStatus: "error" });
          });
      }

      toggleOpen() {
        this.setState(function (prev) { return { open: !prev.open }; });
      }

      render() {
        var self = this;
        var s = this.state;
        var e = React.createElement;

        var statusEmoji = STATUS_EMOJI[s.connectionStatus] || "⚪";

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

        var fields = e(
          "div",
          { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" } },
          e(
            "div",
            { style: fieldStyle },
            e("label", { style: labelStyle }, "Base URL"),
            e("input", {
              type: "text",
              value: s.baseUrl,
              style: inputStyle,
              onChange: function (ev) { self.setState({ baseUrl: ev.target.value }); },
            })
          ),
          e(
            "div",
            { style: fieldStyle },
            e("label", { style: labelStyle }, "API Key"),
            e("input", {
              type: "password",
              value: s.apiKey,
              placeholder: "sk-…",
              style: inputStyle,
              onChange: function (ev) { self.setState({ apiKey: ev.target.value }); },
            })
          ),
          e(
            "div",
            { style: fieldStyle },
            e("label", { style: labelStyle }, "Model ID"),
            e("input", {
              type: "text",
              value: s.modelId,
              style: inputStyle,
              onChange: function (ev) { self.setState({ modelId: ev.target.value }); },
            })
          ),
          e(
            "div",
            { style: fieldStyle },
            e("label", { style: labelStyle }, "Max Tokens"),
            e("input", {
              type: "number",
              value: s.maxTokens,
              min: 1,
              style: inputStyle,
              onChange: function (ev) { self.setState({ maxTokens: Number(ev.target.value) }); },
            })
          ),
          e(
            "div",
            { style: fieldStyle },
            e("label", { style: labelStyle }, "Temperature (0 – 2)"),
            e("input", {
              type: "number",
              value: s.temperature,
              min: 0,
              max: 2,
              step: 0.1,
              style: inputStyle,
              onChange: function (ev) { self.setState({ temperature: Number(ev.target.value) }); },
            })
          )
        );

        var saveButton = e(
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

        var statusBadge = e(
          "span",
          {
            style: {
              marginLeft: "12px",
              fontSize: "13px",
              color: "#9ca3af",
              verticalAlign: "middle",
            },
          },
          statusEmoji + " " + s.connectionStatus
        );

        var header = e(
          "div",
          {
            onClick: this.toggleOpen,
            style: {
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              padding: "10px 16px",
              background: "#111827",
              borderBottom: s.open ? "1px solid #374151" : "none",
              userSelect: "none",
            },
          },
          e("span", { style: { fontSize: "16px", marginRight: "8px" } }, "🤖"),
          e(
            "span",
            { style: { fontWeight: "600", color: "#e5e7eb", fontSize: "14px", flexGrow: 1 } },
            "LLM Settings"
          ),
          e("span", { style: { color: "#6b7280", fontSize: "12px" } }, s.open ? "▲ collapse" : "▼ expand")
        );

        var body = s.open
          ? e(
              "div",
              { style: { padding: "16px", background: "#1f2937" } },
              fields,
              e("div", { style: { display: "flex", alignItems: "center" } }, saveButton, statusBadge)
            )
          : null;

        return e(
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

  // ── Plugin definition ────────────────────────────────────────────────────────
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
      },
    };
  };
})();
