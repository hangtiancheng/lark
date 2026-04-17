// @ts-check

/**
 *
 * @param {string} filePath
 * @returns {any}
 */
function __webpack_require(filePath) {
  const filePath2moduleFn = new Map([
    ["./main.js", mainJs],
    ["./foo.js", fooJs],
    ["./bar.js", barJs],
  ]);
  const moduleFn = filePath2moduleFn.get(filePath);
  if (!moduleFn) {
    return;
  }
  const __webpack_module = { exports: {} };
  moduleFn(__webpack_require, __webpack_module);
  return __webpack_module.exports;
}

/**
 *
 * @param {typeof __webpack_require} __webpack_require
 * @param {{ exports: any }} __webpack_module
 */
function mainJs(__webpack_require, __webpack_module) {
  // main.js
  const { foo } = __webpack_require("./foo.js");
  const { bar } = __webpack_require("./bar.js");
  foo();
  bar();
  console.log("main.js");
}

/**
 *
 * @param {typeof __webpack_require} __webpack_require
 * @param {{ exports: any }} __webpack_module
 */
function fooJs(__webpack_require, __webpack_module) {
  // foo.js
  function foo() {
    console.log("foo.js");
  }
  __webpack_module.exports = { foo };
}

/**
 *
 * @param {typeof __webpack_require} __webpack_require
 * @param {{ exports: any }} __webpack_module
 */
function barJs(__webpack_require, __webpack_module) {
  // bar.js
  function bar() {
    console.log("bar.js");
  }
  __webpack_module.exports = { bar };
}

__webpack_require("./main.js");
