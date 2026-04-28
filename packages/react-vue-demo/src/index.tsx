import "./main.css";
import { createRoot } from "react-dom/client";
import { createApp } from "@lark/react-vue";
import { createPinia } from "pinia";
import App from "./App";

const app = createApp();

app.use(createPinia());

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(<App />);
