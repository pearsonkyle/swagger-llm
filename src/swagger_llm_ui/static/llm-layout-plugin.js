// LLM Layout Plugin
// Wraps the standard Swagger UI BaseLayout with the LLMSettingsPanel rendered above it.

(function () {
  "use strict";

  window.LLMLayoutPlugin = function (system) {
    var React = system.React;

    function LLMDocsLayout(props) {
      var BaseLayout = system.getComponent("BaseLayout", true);
      var LLMSettingsPanel = system.getComponent("LLMSettingsPanel", true);

      return React.createElement(
        "div",
        null,
        React.createElement(LLMSettingsPanel, null),
        React.createElement(BaseLayout, props)
      );
    }

    return {
      components: {
        LLMDocsLayout: LLMDocsLayout,
      },
    };
  };
})();
