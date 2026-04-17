import React from "./react.js";

const ReactDOM = {
  createRoot(container) {
    return {
      render(AppVNode) {
        React.render(AppVNode, container);
      },
    };
  },
};

export default ReactDOM;
