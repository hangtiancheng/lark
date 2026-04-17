/** @jsx React.createElement */
import React from "./core/react.js";
import ReactDOM from "./core/react-dom.js";

import App from "./App.jsx";

const container = document.querySelector("#root");
const root = ReactDOM.createRoot(container);
root.render(<App />);
