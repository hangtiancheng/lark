import i18n from "../i18n";
import {
  type DiagnosticResult,
  type SDKOptions,
  type NetworkInfo,
  type ApiCheckResult,
  type ResourceCheckResult,
  type LocationInfo,
  type DiagnosticCallback,
  type Lang,
  DiagnosticTaskId,
} from "./types";

class Bus<
  TResult extends { id: string },
  TCallback extends (results: TResult[]) => void,
> {
  protected listeners: Set<TCallback> = new Set();
  protected results: TResult[] = [];

  public subscribe(callback: TCallback) {
    this.listeners.add(callback);
    // Emit current state immediately
    callback(this.results);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  protected emit() {
    // 传递一个新数组 [...this.results], 以保证 useState 可以触发重新渲染
    this.listeners.forEach((listener) => listener([...this.results]));
  }

  protected addResult(result: TResult) {
    const existingIndex = this.results.findIndex((r) => r.id === result.id);
    if (existingIndex >= 0) {
      this.results[existingIndex] = result;
    } else {
      this.results.push(result);
    }
    this.emit();
  }

  protected updateResult(id: string, updates: Partial<TResult>) {
    const index = this.results.findIndex((r) => r.id === id);
    if (index >= 0) {
      this.results[index] = {
        ...this.results[index],
        ...updates,
      };
      this.emit();
    }
  }

  public getResults() {
    return this.results;
  }
}

class NetworkDiagnoseSDK extends Bus<DiagnosticResult, DiagnosticCallback> {
  private config: SDKOptions;

  constructor(config: SDKOptions) {
    super();
    this.config = {
      ...config,
      lang: config.lang || "en",
    };

    if (config.onResultsUpdate) {
      this.subscribe(config.onResultsUpdate);
    }
    this.setupNetworkListeners();
  }

  private get context(): SDKOptions {
    return {
      ...this.config,
      updateResult: this.updateResult.bind(this),
    };
  }

  public setLang(lang: Lang) {
    this.config.lang = lang;
    // Re-translate existing results if necessary, or just rely on next run
  }

  private setupNetworkListeners() {
    const handleConnectionChange = () => {
      // If we already have a network-status result, update it dynamically
      const hasNetworkResult = this.results.some(
        (r) => r.id === DiagnosticTaskId.NetworkStatus,
      );
      if (hasNetworkResult) {
        this.checkNetworkStatus();
      }
    };
    window.addEventListener("online", () => handleConnectionChange());
    window.addEventListener("offline", () => handleConnectionChange());
    navigator.connection?.addEventListener("change", handleConnectionChange);
  }

  private createRepairFn(id: string, taskFn: () => Promise<void>) {
    let isRepairing = false;
    return async () => {
      if (isRepairing) return false;
      isRepairing = true;

      this.updateResult(id, {
        repairStatus: "repairing",
        message: i18n.t("repair.running", { lng: this.config.lang }),
      });

      try {
        await taskFn();
        return true;
      } finally {
        isRepairing = false;
      }
    };
  }

  public async runFullDiagnosis() {
    this.results = [];
    this.emit();

    const tasks = [
      this.checkNetworkStatus(),
      this.checkLocation(),
      this.checkSpeed(),
      this.checkApiConnectivity(),
      this.checkResources(),
      ...this.runCustomTasks(),
    ];

    await Promise.allSettled(tasks);
  }

  private runCustomTasks() {
    if (!this.config.customTasks) return [];

    return this.config.customTasks.map(async (task) => {
      this.addResult({ id: task.id, name: task.name, status: "running" });
      const start = performance.now();

      const repairFn = task.repair
        ? async () => {
            this.updateResult(task.id, { repairStatus: "repairing" });
            try {
              const success = await task.repair!(this.context);
              this.updateResult(task.id, {
                repairStatus: success ? "success" : "failure",
                message: success
                  ? i18n.t("repair.success", { lng: this.config.lang })
                  : i18n.t("repair.failure", { lng: this.config.lang }),
              });
              if (success) {
                // Re-run task
                this.updateResult(task.id, { status: "running" });
                const newDetails = await task.run(this.context);
                this.updateResult(task.id, {
                  status: "success",
                  details: newDetails,
                  error: undefined,
                  recommendation: undefined,
                });
              }
              return success;
            } catch {
              this.updateResult(task.id, {
                repairStatus: "failure",
                message: i18n.t("repair.failure", { lng: this.config.lang }),
              });
              return false;
            }
          }
        : undefined;

      try {
        const details = await task.run(this.context);
        this.updateResult(task.id, {
          status: "success",
          details,
          duration: Math.round(performance.now() - start),
          repair: repairFn,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown Error";
        this.updateResult(task.id, {
          status: "failure",
          error: message,
          duration: Math.round(performance.now() - start),
          repair: repairFn,
        });
      }
    });
  }

  private async checkNetworkStatus() {
    const id = DiagnosticTaskId.NetworkStatus;
    this.addResult({
      id,
      name: i18n.t("task.network_status.name", { lng: this.config.lang }),
      status: "running",
    });

    console.log("effectiveType", navigator.connection?.effectiveType);
    console.log("downlink", navigator.connection?.downlink);
    console.log("rtt", navigator.connection?.rtt);
    console.log("saveData", navigator.connection?.saveData);

    try {
      const online = navigator.onLine;

      const info: NetworkInfo & {
        online: boolean;
      } = {
        online,
        effectiveType: navigator.connection?.effectiveType,
        downlink: navigator.connection?.downlink,
        rtt: navigator.connection?.rtt,
        saveData: navigator.connection?.saveData,
      };

      if (!online) {
        throw new Error(
          i18n.t("task.network_status.offline_error", {
            lng: this.config.lang,
          }),
        );
      }

      const effectiveTypeStr = info.effectiveType || "Unknown";
      const dataSaverStr = info.saveData ? " (Data Saver Mode)" : "";

      this.updateResult(id, {
        status: "success",
        details: info,
        message: i18n.t("task.network_status.success", {
          lng: this.config.lang,
          effectiveType: effectiveTypeStr,
          dataSaver: dataSaverStr,
          rtt: info.rtt || "?",
        }),
        duration: 0,
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : i18n.t("task.network_status.unknown_error", {
              lng: this.config.lang,
            });
      this.updateResult(id, {
        status: "failure",
        error: message,
        recommendation: i18n.t("task.network_status.recommendation", {
          lng: this.config.lang,
        }),
        repair: this.createRepairFn(id, this.checkNetworkStatus.bind(this)),
      });
    }
  }

  private async checkLocation() {
    const id = DiagnosticTaskId.LocationCheck;
    this.addResult({
      id,
      name: i18n.t("task.location.name", { lng: this.config.lang }),
      status: "running",
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("https://ipapi.co/json/", {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(
          i18n.t("task.location.http_error", {
            lng: this.config.lang,
            status: response.status,
          }),
        );

      const data = await response.json();
      const location: LocationInfo = {
        ip: data.ip,
        city: data.city,
        region: data.region,
        country: data.country_name,
        isp: data.org,
      };

      this.updateResult(id, {
        status: "success",
        details: location,
        message: i18n.t("task.location.success", {
          lng: this.config.lang,
          city: location.city,
          region: location.region,
          country: location.country,
          isp: location.isp,
        }),
        duration: 0,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      this.updateResult(id, {
        status: "failure",
        error: i18n.t("task.location.error", {
          lng: this.config.lang,
          message,
        }),
        recommendation: i18n.t("task.location.recommendation", {
          lng: this.config.lang,
        }),
        repair: this.createRepairFn(id, this.checkLocation.bind(this)),
      });
    }
  }

  private async checkSpeed() {
    const id = DiagnosticTaskId.SpeedTest;
    const testUrl =
      this.config.speedTestFileUrl ||
      "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png";

    this.addResult({
      id,
      name: i18n.t("task.speed.name", { lng: this.config.lang }),
      status: "running",
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new Error("Timeout")),
        10_000,
      ); // 10 seconds timeout

      const startTime = performance.now();
      const response = await fetch(`${testUrl}?t=${startTime}`, {
        cache: "no-store", // 不要从缓存中读, 也不要将请求体写入缓存
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        throw new Error(
          i18n.t("task.speed.download_error", { lng: this.config.lang }),
        );
      }

      const blob = await response.blob();
      clearTimeout(timeoutId);
      const endTime = performance.now();
      const sizeInBits = blob.size * 8;
      const durationInSeconds = (endTime - startTime) / 1000;
      const bps = sizeInBits / durationInSeconds;
      const mbps = (bps / (1024 * 1024)).toFixed(2);

      this.updateResult(id, {
        status: "success",
        details: {
          downloadSpeedMbps: parseFloat(mbps),
          latencyMs: Math.round(endTime - startTime),
        },
        message: i18n.t("task.speed.success", { lng: this.config.lang, mbps }),
        duration: Math.round(endTime - startTime),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";

      this.updateResult(id, {
        status: "failure",
        error: i18n.t("task.speed.error", { lng: this.config.lang, message }),
        recommendation: i18n.t("task.speed.recommendation", {
          lng: this.config.lang,
        }),
        repair: this.createRepairFn(id, this.checkSpeed.bind(this)),
      });
    }
  }

  private async checkApiConnectivity() {
    const id = DiagnosticTaskId.ApiCheck;
    const apiList = this.config.apiList || [];

    if (apiList.length === 0) {
      this.addResult({
        id,
        name: i18n.t("task.api.name", { lng: this.config.lang }),
        status: "skipped",
        message: i18n.t("task.api.skipped", { lng: this.config.lang }),
      });
      return;
    }

    this.addResult({
      id,
      name: i18n.t("task.api.name", { lng: this.config.lang }),
      status: "running",
    });

    const results: ApiCheckResult[] = [];
    let failures = 0;

    for (const url of apiList) {
      const start = performance.now();
      try {
        // HEAD 请求
        const res = await fetch(url, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });

        results.push({
          url,
          status: res.status,
          // 跨域 + mode: "no-cors", JS 看不到响应体，也视为 ok
          ok: res.type === "opaque" ? true : res.ok,
          timeMs: Math.round(performance.now() - start),
        });
      } catch {
        failures++;
        results.push({
          url,
          status: 0,
          ok: false,
          timeMs: Math.round(performance.now() - start),
        });
      }
    }

    const allOk = failures === 0;

    const repairFn = !allOk
      ? this.createRepairFn(id, this.checkApiConnectivity.bind(this))
      : undefined;

    this.updateResult(id, {
      status: allOk ? "success" : "failure",
      details: results,
      message: i18n.t("task.api.success", {
        lng: this.config.lang,
        reachable: results.length - failures,
        total: results.length,
      }),
      recommendation: !allOk
        ? i18n.t("task.api.recommendation", { lng: this.config.lang })
        : undefined,
      duration: Math.max(...results.map((r) => r.timeMs)),
      repair: repairFn,
    });
  }

  private async checkResources() {
    const id = DiagnosticTaskId.ResourceCheck;
    const resourceList = this.config.resourceList || [];

    if (resourceList.length === 0) {
      this.addResult({
        id,
        name: i18n.t("task.resource.name", { lng: this.config.lang }),
        status: "skipped",
        message: i18n.t("task.resource.skipped", { lng: this.config.lang }),
      });
      return;
    }

    this.addResult({
      id,
      name: i18n.t("task.resource.name", { lng: this.config.lang }),
      status: "running",
    });

    const results: ResourceCheckResult[] = [];
    let failures = 0;

    // 没有跨域问题
    const checkImage = (url: string): Promise<ResourceCheckResult> => {
      return new Promise((resolve) => {
        const start = performance.now();
        // 创建一个内存中的 img 元素, 不会挂载到 DOM 树
        const img = new Image();
        // 图片下载成功、解码成功的回调
        img.onload = () => {
          resolve({
            url,
            loaded: true,
            timeMs: Math.round(performance.now() - start),
          });
        };
        img.onerror = () => {
          resolve({
            url,
            loaded: false,
            timeMs: Math.round(performance.now() - start),
          });
        };
        // 加一个时间戳, 防止浏览器缓存
        img.src = `${url}?t=${Date.now()}`;
      });
    };

    const checks = resourceList.map((url) => checkImage(url));
    const checkResults = await Promise.all(checks);

    checkResults.forEach((res) => {
      if (!res.loaded) failures++;
      results.push(res);
    });

    const allOk = failures === 0;

    const repairFn = !allOk
      ? this.createRepairFn(id, this.checkResources.bind(this))
      : undefined;

    this.updateResult(id, {
      status: allOk ? "success" : "failure",
      details: results,
      message: i18n.t("task.resource.success", {
        lng: this.config.lang,
        loaded: results.length - failures,
        total: results.length,
      }),
      recommendation: !allOk
        ? i18n.t("task.resource.recommendation", { lng: this.config.lang })
        : undefined,
      duration: Math.max(...results.map((r) => r.timeMs)),
      repair: repairFn,
    });
  }
}

export default NetworkDiagnoseSDK;
