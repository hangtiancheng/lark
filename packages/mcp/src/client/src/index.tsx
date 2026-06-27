import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import PromptForm from "./prompt-form.js";
import NetworkDiagnosePanel from "./network/components/network-diagnose-panel.js";
import "./i18n.js";
import "./index.css";

const App = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "zh" : "en";
    i18n.changeLanguage(nextLang);
  };

  const diagnosticConfig = {
    apiList: [
      "https://api.github.com",
      "https://jsonplaceholder.typicode.com/todos/1",
      "https://httpbin.org/get",
    ],
    resourceList: [
      "https://vitejs.dev/logo.svg",
      "https://react.dev/favicon.ico",
      "https://www.google.com/favicon.ico",
    ],
    speedTestFileUrl:
      "https://upload.wikimedia.org/wikipedia/commons/3/3d/LARGE_elevation.jpg",
  };

  const handleOncall = (results: unknown[]) => {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/oncall", payload);
    } else {
      fetch("/oncall", {
        method: "POST",
        body: payload,
        keepalive: true,
      }).catch(console.error);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ease-in-out">
      <button
        onClick={toggleLanguage}
        className="btn btn-ghost btn-sm text-primary/60 hover:bg-primary/10 absolute top-4 right-4"
      >
        {t("mcp.switch_lang")}
      </button>

      <div className="mx-auto w-full max-w-4xl animate-[fade-in_0.5s_ease-out]">
        <div className="mb-10 text-center transition-transform duration-300 hover:-translate-y-1">
          <h1 className="text-primary mb-2 text-5xl font-extrabold drop-shadow-sm">
            {t("mcp.app_title")}
          </h1>
          <p className="text-secondary/80 font-medium">
            {t("mcp.app_subtitle")}
          </p>
        </div>
        <PromptForm />
      </div>

      <NetworkDiagnosePanel
        config={diagnosticConfig}
        oncallAction={handleOncall}
      />
    </div>
  );
};

const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
