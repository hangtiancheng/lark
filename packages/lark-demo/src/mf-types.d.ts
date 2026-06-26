declare module "lark_devtool/cdn-manager" {
  /**
   * Mount the CdnManager React component into a container element.
   * @param container - The DOM element to render into
   * @returns Cleanup function to unmount and tear down the React tree
   */
  export function mountCdnManager(container: HTMLElement): () => void;
  export default mountCdnManager;
}
