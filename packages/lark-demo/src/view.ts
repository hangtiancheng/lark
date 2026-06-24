/**
 * Project View Base Class
 * All page Views inherit from this class to gain common capabilities
 */
import { View, Router } from "@lark.js/mvc";

export default View.extend({
  /**
   * Constructor
   * Called when each View is initialized
   */
  ctor() {
    console.log(`View instance created: ${this.id}`);

    // Set global shared data
    this.updater.set({
      appName: "Lark Demo",
      currentTime: new Date().toLocaleString(),
    });

    // Listen for View destroy event
    this.on("destroy", () => {
      console.log(`View destroyed: ${this.id}`);
    });
  },

  /**
   * Show alert dialog
   */
  alert(title: string, message: string) {
    alert(`${title}\n\n${message}`);
  },

  /**
   * Route navigation wrapper
   */
  navigate(path: string, params?: Record<string, unknown>) {
    Router.to(path, params);
  },

  /**
   * Get URL parameters
   */
  getUrlParams() {
    return Router.parse().params;
  },
});
