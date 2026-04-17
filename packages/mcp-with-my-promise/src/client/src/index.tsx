import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import PromptForm from "./prompt-form.js";
import "./i18n.js";
import "./index.css";

const App = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "zh" : "en";
    i18n.changeLanguage(nextLang);
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center p-4 transition-colors duration-500 ease-in-out"
      data-theme="bumblebee"
      // style={{ backgroundColor: "#fff4e6" }}
    >
      <button
        onClick={toggleLanguage}
        className="btn btn-ghost btn-sm absolute top-4 right-4 text-orange-800/60 hover:bg-orange-800/10"
      >
        {t("switch_lang")}
      </button>

      <div className="mx-auto w-full max-w-4xl animate-[fade-in_0.5s_ease-out]">
        <div className="mb-10 text-center transition-transform duration-300 hover:-translate-y-1">
          <h1 className="mb-2 text-5xl font-extrabold text-orange-800 drop-shadow-sm">
            {t("app_title")}
          </h1>
          <p className="font-medium text-orange-600/80">{t("app_subtitle")}</p>
        </div>
        <PromptForm />
      </div>
    </div>
  );
};

const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
