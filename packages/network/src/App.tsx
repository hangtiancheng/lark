import { useTranslation } from "react-i18next";
import NetworkDiagnosePanel from "./components/network-diagnose-panel";
import type { DiagnosticResult } from "./sdk/types";

function App() {
  const { i18n, t } = useTranslation();
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
      "https://upload.wikimedia.org/wikipedia/commons/3/3d/LARGE_elevation.jpg", // ~1.5MB file
  };

  const handleOnCall = (results: DiagnosticResult[]) => {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      language: i18n.language,
      results,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/on/call", payload);
    } else {
      fetch("/on/call", {
        method: "POST",
        body: payload,
        keepalive: true,
      }).catch(console.error);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="bg-base-100 text-base-content flex min-h-screen flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-primary text-3xl font-bold">{t("app.title")}</h1>

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn m-1">
              {i18n.language === "zh" ? "中文" : "English"}
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu bg-base-100 rounded-box z-1 w-30 p-2 shadow"
            >
              <li>
                <button
                  onClick={() => handleLanguageChange("zh")}
                  className={i18n.language === "zh" ? "active" : ""}
                >
                  中文
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleLanguageChange("en")}
                  className={i18n.language === "en" ? "active" : ""}
                >
                  English
                </button>
              </li>
            </ul>
          </div>
        </div>

        <NetworkDiagnosePanel
          config={diagnosticConfig}
          onCallAction={handleOnCall}
        />
      </div>
    </div>
  );
}

export default App;
