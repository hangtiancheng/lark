import "./main.css";
import { createRoot } from "react-dom/client";
import { createApp } from "@lark/react-vue";
import { createPinia } from "pinia";
import App from "./App";

const app = createApp();

app.use(createPinia());

const container = document.getElementById("root");

async function enableMocking() {
  if (!import.meta.env.DEV) return;

  const { worker } = await import("./mocks/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
  });
}

async function bootstrap() {
  await enableMocking();

  if (!container) return;

  createRoot(container).render(<App />);
}

bootstrap();
