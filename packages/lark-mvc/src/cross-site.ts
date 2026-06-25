/**
 * CrossSite: Micro-frontend bridge view for cross-project view loading.
 *
 * Functional style — no class, no this, no prototype.
 *
 * Registers as "cross-site" view path. When a template uses
 * `v-lark="cross-site?view=remote-app/views/home&bizCode=mybiz"`,
 * CrossSite:
 * 1. Renders a skeleton
 * 2. Loads the remote project's prepare module via Framework.use()
 * 3. Mounts the actual remote view via ctx.owner.mountFrame()
 * 4. Uses a signature counter for race condition guards
 */
import { use, config } from "./module-loader";
import { parseUri } from "./utils";
import type {
  CrossSiteConfig,
  ViewCtx,
  ViewSetup,
  ViewTemplate,
} from "./types";

// ============================================================
// Project config registry
// ============================================================

const projectsMap = new Map<string, CrossSiteConfig>();

export function resetProjectsMap(): void {
  projectsMap.clear();
}

function getProject(projectName: string): CrossSiteConfig | undefined {
  return projectsMap.get(projectName);
}

// Auto-register cross-site configs from FrameworkConfig
if (typeof config !== "undefined" && config.crossSites) {
  for (const cs of config.crossSites) {
    projectsMap.set(cs.projectName, cs);
  }
}

// ============================================================
// CrossSite view setup (functional)
// ============================================================

interface CrossSiteState {
  /** Current load signature (incremented on each navigation) */
  sign: number;
  /** Whether the remote view has been mounted */
  mounted: boolean;
  /** Last loaded view path (for assign reuse) */
  lastViewPath: string | undefined;
}

/**
 * CrossSite view — bridge for micro-frontend remote views.
 *
 * Registered via `registerViewClass("cross-site", CrossSite)`.
 */
const CrossSite: ViewSetup = (
  ctx: ViewCtx,
  params?: unknown,
): {
  template: ViewTemplate;
  events: Record<string, never>;
} => {
  const p = (params ?? {}) as Record<string, string>;
  const viewPath = p["view"] ?? "";
  const bizCode = p["bizCode"] ?? "";
  const skeleton = p["skeleton"] ?? "Loading…";

  const state: CrossSiteState = {
    sign: 0,
    mounted: false,
    lastViewPath: undefined,
  };

  // Parse project name from view path (e.g., "remote-app/views/home" → "remote-app")
  const parsed = parseUri(viewPath);
  const parts = parsed.path.split("/");
  const projectName = parts[0] ?? "";
  const remotePath = parts.slice(1).join("/");

  const projectConfig = getProject(projectName);

  // Start async loading
  const currentSign = ++state.sign;

  if (projectConfig && remotePath) {
    // Load prepare module first
    use(`${projectName}/prepare`, (): void => {
      // Race guard: if sign changed, user navigated away
      if (currentSign !== state.sign) return;

      // Load the actual remote view
      use(viewPath, (): void => {
        if (currentSign !== state.sign) return;

        // Mount the remote view in a sub-frame
        const frameId = `mf_${ctx.id}`;
        ctx.owner.mountFrame(frameId, viewPath, {
          bizCode,
          project: projectName,
        });
        state.mounted = true;
        state.lastViewPath = viewPath;

        // Hide skeleton by re-rendering with empty template
        ctx.updater.set({ _csLoaded: true }).digest();
      });
    });
  }

  // Cleanup on destroy
  ctx.on("destroy", (): void => {
    state.sign++; // Invalidate any pending loads
    state.mounted = false;
    state.lastViewPath = undefined;
  });

  // Return initial skeleton template
  const renderSkeleton = (): string => {
    if (state.mounted) {
      // Remote view is mounted — skeleton container is hidden
      return '<div class="lark-cs-container" style="display:none"></div>';
    }
    return `<div class="lark-cs-skeleton" data-lark-cs-skeleton="1">${skeleton}</div>`;
  };

  return {
    template: renderSkeleton,
    events: {},
  };
};

export default CrossSite;
export { CrossSite };
export type { CrossSiteState };
