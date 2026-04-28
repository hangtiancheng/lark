/**
 *
 * @param {string} sourceCode
 * @returns {string}
 */
export function jsonLoader(sourceCode) {
  return `export default ${JSON.stringify(sourceCode)}`;
}
