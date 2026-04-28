import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../i18n/en.json" with { type: "json" };
import zh from "../i18n/zh.json" with { type: "json" };

const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    // escape passed in values to avoid XSS injection
    escapeValue: true,
  },
});

export default i18n;
