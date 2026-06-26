/**
 * CDN View — embeds the CdnManager React component from lark-devtool
 * via Webpack Module Federation.
 *
 * The React component is loaded asynchronously from the lark_devtool
 * remote and mounted into a container element within this Lark MVC view.
 * On view destroy, the React tree is unmounted and cleaned up.
 */
import { defineView, useEffect } from "@lark.js/mvc";
import { withBaseView } from "../view";
import template from "./cdn.html";

export default defineView(
  withBaseView((ctx, _initParams) => {
    useEffect(() => {
      const container = document.createElement("div");
      container.style.height = "100%";
      document.getElementById(ctx.id)?.appendChild(container);

      let unmount: (() => void) | undefined;

      import("lark_devtool/cdn-manager")
        .then((mod) => {
          const mountCdnManager = mod.mountCdnManager ?? mod.default;
          if (typeof mountCdnManager === "function") {
            unmount = mountCdnManager(container);
          }
        })
        .catch((err: unknown) => {
          console.error(
            "[CDN View] Failed to load CdnManager from lark_devtool:",
            err,
          );
          container.textContent =
            "Failed to load CDN Manager. Make sure lark-devtool is running on port 5173.";
        });

      return () => {
        unmount?.();
      };
    }, []);

    const assign = (_options: unknown): boolean | undefined => {
      return undefined;
    };

    return {
      template,
      assign,
    };
  }),
);
