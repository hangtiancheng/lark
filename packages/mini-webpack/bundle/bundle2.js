// @ts-check

(function (filePath2moduleFn) {
  /**
   *
   * @param {string} filePath
   * @returns {any}
   */
  function __webpack_require(filePath) {
    const moduleFn = filePath2moduleFn[filePath];
    if (!moduleFn) {
      return;
    }
    const __webpack_module = { exports: {} };
    moduleFn(__webpack_require, __webpack_module);
    return __webpack_module.exports;
  }

  __webpack_require("./main.js");
})({
  "./main.js": /**
   *
   * @param {(filePath: string) => any} __webpack_require
   * @param {{ exports: any }} __webpack_module
   */ function (__webpack_require, __webpack_module) {
    // main.js
    const { foo } = __webpack_require("./foo.js");
    const { bar } = __webpack_require("./bar.js");
    foo();
    bar();
    console.log("main.js");
  },

  "./foo.js": /**
   *
   * @param {(filePath: string) => any} __webpack_require
   * @param {{ exports: any }} __webpack_module
   */ function (__webpack_require, __webpack_module) {
    // foo.js
    function foo() {
      console.log("foo.js");
    }
    __webpack_module.exports = { foo };
  },

  "./bar.js": function (__webpack_require, __webpack_module) {
    // bar.js
    function bar() {
      console.log("bar.js");
    }
    __webpack_module.exports = { bar };
  },
});
