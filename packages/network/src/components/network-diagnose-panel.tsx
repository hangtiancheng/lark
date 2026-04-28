import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  X,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  Send,
  Wrench,
  Bug,
} from "lucide-react";
import NetworkDiagnoseSDK from "../sdk/network-diagnose-sdk";
import type {
  DiagnosticResult,
  SDKOptions,
  ApiCheckResult,
  ResourceCheckResult,
  LocationInfo,
  SpeedTestResult,
  Lang,
  NetworkInfo,
} from "../sdk/types";
import { DiagnosticTaskId } from "../sdk/types";

interface NetworkDiagnosePanelProps {
  config: Omit<SDKOptions, "onResultsUpdate">;
  title?: string;
  onCallAction?: (results: DiagnosticResult[]) => void;
}

const NetworkDiagnosePanel: React.FC<NetworkDiagnosePanelProps> = ({
  config,
  title = "Network Diagnostics",
  onCallAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId] = useState(() => Date.now().toString().slice(-6));
  const { t, i18n } = useTranslation();
  const [showToast, setShowToast] = useState(false);

  const sdk = useMemo(
    () =>
      new NetworkDiagnoseSDK({
        ...config,
        lang: (i18n.language === "zh" ? "zh" : "en") as Lang,
        onResultsUpdate: (newResults) => {
          setResults(newResults);
        },
      }),
    [config, i18n.language],
  );

  const startDiagnosis = async () => {
    setIsRunning(true);
    await sdk.runFullDiagnosis();
    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="text-success h-5 w-5" />;
      case "failure":
        return <XCircle className="text-error h-5 w-5" />;
      case "running":
        return (
          <span className="loading loading-spinner loading-sm text-info" />
        );
      case "skipped":
        return <SkipForward className="text-base-content/40 h-5 w-5" />;
      default:
        return <Clock className="text-base-content/30 h-5 w-5" />;
    }
  };

  const renderDetails = (result: DiagnosticResult) => {
    if (!result.details) return null;

    if (result.id === DiagnosticTaskId.NetworkStatus) {
      const info = result.details as NetworkInfo & { online: boolean };
      return (
        <div className="text-base-content/70 mt-2 space-y-1 pl-8 text-sm">
          <p>
            <span className="font-semibold">{t("ui.online")}:</span>
            {info.online ? (
              <span className="badge badge-success badge-sm">
                {t("ui.yes")}
              </span>
            ) : (
              <span className="badge badge-error badge-sm">{t("ui.no")}</span>
            )}
          </p>
          <p>
            <span className="font-semibold">{t("ui.network_type")}:</span>
            {info.effectiveType ? (
              <span className="badge badge-outline badge-sm">
                {info.effectiveType}
              </span>
            ) : (
              ""
            )}
          </p>
          <p>
            <span className="font-semibold">{t("ui.downlink")}:</span>
            {info.downlink !== undefined
              ? `${info.downlink} Mbps`
              : t("ui.unknown")}
          </p>
          <p>
            <span className="font-semibold">{t("ui.rtt")}:</span>
            {info.rtt !== undefined ? `${info.rtt} ms` : t("ui.unknown")}
          </p>
          <p>
            <span className="font-semibold">{t("ui.data_saver")}:</span>
            {info.saveData !== undefined ? (
              info.saveData ? (
                <span className="badge badge-warning badge-sm">
                  {t("ui.on")}
                </span>
              ) : (
                <span className="badge badge-ghost badge-sm">
                  {t("ui.off")}
                </span>
              )
            ) : (
              t("ui.unknown")
            )}
          </p>
        </div>
      );
    }

    if (result.id === DiagnosticTaskId.LocationCheck) {
      const info = result.details as LocationInfo;
      return (
        <div className="text-base-content/70 mt-2 space-y-1 pl-8 text-sm">
          <p>
            <span className="font-semibold">{t("ui.ip")}:</span> {info.ip}
          </p>
          <p>
            <span className="font-semibold">{t("ui.location")}:</span>
            {info.city}, {info.region}, {info.country}
          </p>
          <p>
            <span className="font-semibold">{t("ui.isp")}:</span> {info.isp}
          </p>
        </div>
      );
    }

    if (result.id === DiagnosticTaskId.SpeedTest) {
      const info = result.details as SpeedTestResult;
      return (
        <div className="text-base-content/70 mt-2 space-y-1 pl-8 text-sm">
          <p>
            <span className="font-semibold">{t("ui.download_speed")}:</span>
            <span className="text-primary font-bold">
              {info.downloadSpeedMbps}
            </span>
            Mbps
          </p>
          <p>
            <span className="font-semibold">{t("ui.latency")}:</span>
            {info.latencyMs} ms
          </p>
        </div>
      );
    }

    if (result.id === DiagnosticTaskId.ApiCheck) {
      const list = result.details as ApiCheckResult[];
      return (
        <div className="mt-2 pl-8 text-sm">
          <div className="bg-base-200 rounded-box max-h-40 space-y-1 overflow-y-auto p-2">
            {list.map((item, idx) => (
              <div
                key={idx}
                className="bg-base-100 flex items-center justify-between rounded p-2"
              >
                <span
                  className="max-w-[60%] truncate font-mono text-xs"
                  title={item.url}
                >
                  {item.url}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`badge badge-sm ${item.ok ? "badge-success" : "badge-error"}`}
                  >
                    {item.status}
                  </span>
                  <span className="text-base-content/50 text-xs">
                    {item.timeMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (result.id === DiagnosticTaskId.ResourceCheck) {
      const list = result.details as ResourceCheckResult[];
      return (
        <div className="mt-2 pl-8 text-sm">
          <div className="bg-base-200 rounded-box max-h-40 space-y-1 overflow-y-auto p-2">
            {list.map((item, idx) => (
              <div
                key={idx}
                className="bg-base-100 flex items-center justify-between rounded p-2"
              >
                <span
                  className="max-w-[60%] truncate font-mono text-xs"
                  title={item.url}
                >
                  {item.url}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`badge badge-sm ${item.loaded ? "badge-success" : "badge-error"}`}
                  >
                    {item.loaded ? t("ui.ok") : t("ui.fail")}
                  </span>
                  <span className="text-base-content/50 text-xs">
                    {item.timeMs}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="pl-6 text-xs text-gray-500">
        {JSON.stringify(result.details)}
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary btn-circle btn-lg fixed right-6 bottom-6 z-50 shadow-2xl transition-all hover:scale-110"
        title={t("ui.title")}
      >
        <Activity className="h-8 w-8" />
      </button>
    );
  }

  const hasFailures = results.some((r) => r.status === "failure");

  return (
    <div className="bg-base-100 rounded-box border-base-200 fixed right-6 bottom-6 z-50 flex max-h-[85vh] w-100 flex-col overflow-hidden border shadow-2xl">
      <div className="bg-base-200/50 border-base-200 flex items-center justify-between border-b p-4">
        <h3 className="text-base-content flex items-center gap-2 font-bold">
          <div className="bg-primary/10 text-primary rounded-lg p-1.5">
            <Activity className="h-5 w-5" />
          </div>
          {title || t("ui.title")}
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="btn btn-ghost btn-sm btn-circle"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {results.length === 0 && !isRunning ? (
          <div className="text-base-content/50 flex flex-col items-center justify-center py-12">
            <Activity className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-center">{t("ui.start_msg")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-base-100 border-base-200 rounded-lg border p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base-content flex items-center gap-2 font-medium">
                    {getStatusIcon(result.status)} {result.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {result.repair && result.status === "failure" && (
                      <button
                        onClick={() => result.repair?.()}
                        disabled={result.repairStatus === "repairing"}
                        className="btn btn-xs btn-outline btn-primary"
                      >
                        {result.repairStatus === "repairing" ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <Wrench className="h-3 w-3" />
                        )}
                        {result.repairStatus === "repairing"
                          ? t("ui.repairing_btn")
                          : t("ui.repair_btn")}
                      </button>
                    )}
                    {result.duration !== undefined && (
                      <span className="badge badge-ghost badge-sm gap-1">
                        <Clock className="h-3 w-3" /> {result.duration}ms
                      </span>
                    )}
                  </div>
                </div>
                {result.message && (
                  <div className="text-base-content/70 mb-2 pl-8 text-sm">
                    {result.message}
                  </div>
                )}
                {renderDetails(result)}
                {result.recommendation && (
                  <div className="bg-warning/10 text-warning-content border-warning/20 mt-3 ml-8 flex items-start gap-2 rounded-lg border p-3 text-sm">
                    <Send className="text-warning h-5 w-5 shrink-0" />
                    <span>
                      <span className="font-semibold">
                        {t("ui.recommendation")}:
                      </span>
                      {result.recommendation}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-base-200 bg-base-200/30 space-y-3 border-t p-4">
        <button
          onClick={startDiagnosis}
          disabled={isRunning}
          className="btn btn-primary w-full"
        >
          {isRunning && <span className="loading loading-spinner"></span>}
          {isRunning ? t("ui.diagnosing_btn") : t("ui.start_btn")}
        </button>

        {hasFailures && (
          <button
            onClick={() => {
              if (onCallAction) {
                onCallAction(results);
              } else {
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
              }
            }}
            className="btn btn-error btn-outline w-full"
          >
            <Bug className="h-4 w-4" /> {t("ui.on_call_btn")}
          </button>
        )}

        <div className="text-base-content/40 mt-2 text-center font-mono text-xs">
          {t("ui.diag_id")}: {sessionId}
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className="toast toast-center toast-top absolute z-100">
          <div className="alert alert-warning shadow-lg">
            <span className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              OnCall function not configured
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkDiagnosePanel;
