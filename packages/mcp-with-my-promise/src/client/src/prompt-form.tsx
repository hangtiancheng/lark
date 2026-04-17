import { useState, useEffect, type ChangeEvent, type FC } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const PromptForm: FC = () => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (status && status !== t("saving")) {
      const timer = setTimeout(() => {
        setStatus("");
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [status, t]);

  const handleSubmit = async (e: ChangeEvent) => {
    e.preventDefault();
    setStatus(t("saving"));

    try {
      const response = await fetch("/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          content,
        }),
      });

      if (response.ok) {
        setStatus(t("success_message"));
        setName("");
        setDescription("");
        setContent("");
      } else {
        const data = await response.json();
        setStatus(
          `${t("error_message")}: ${data.error || "Failed to create prompt"}`,
        );
      }
    } catch (err) {
      setStatus(t("network_error"));
    }
  };

  return (
    <div className="card bg-base-100 w-full shadow-xl shadow-orange-900/5 transition-shadow duration-300 hover:shadow-2xl">
      <div className="card-body p-8 lg:p-12">
        <h2 className="card-title text-base-content border-base-200 mb-8 border-b pb-4 text-3xl font-bold">
          {t("form_title")}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <label className="form-control w-full">
            <div className="label">
              <span className="label-text text-base-content/80 font-semibold">
                {t("prompt_name_label")}
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input input-bordered bg-base-100 w-full transition-colors"
              placeholder={t("prompt_name_placeholder")}
              required
            />
          </label>

          <label className="form-control w-full">
            <div className="label">
              <span className="label-text text-base-content/80 font-semibold">
                {t("description_label")}
              </span>
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input input-bordered bg-base-100 w-full transition-colors"
              placeholder={t("description_placeholder")}
              required
            />
          </label>

          <label className="form-control w-full">
            <div className="label">
              <span className="label-text text-base-content/80 font-semibold">
                {t("content_label")}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="textarea textarea-bordered bg-base-100 h-40 w-full resize-y leading-relaxed transition-colors"
              placeholder={t("content_placeholder")}
              required
            ></textarea>
          </label>

          <div className="card-actions mt-4 justify-end">
            <button
              type="submit"
              className={`btn btn-primary px-10 transition-transform hover:scale-105 ${
                status === t("saving") ? "btn-disabled" : ""
              }`}
            >
              {status === t("saving") ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                t("save_button")
              )}
            </button>
          </div>
        </form>

        {status && status !== t("saving") && (
          <div
            className={`alert mt-8 animate-[fade-in-up_0.3s_ease-out] ${
              status.includes(t("error_message"))
                ? "alert-error"
                : "alert-success"
            }`}
          >
            {status.includes(t("error_message")) ? (
              <AlertCircle className="h-6 w-6 shrink-0" />
            ) : (
              <CheckCircle2 className="h-6 w-6 shrink-0" />
            )}
            <span className="font-medium">{status}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptForm;
