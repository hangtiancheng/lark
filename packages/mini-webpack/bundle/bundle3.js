// @ts-check

(function (absoluteFilePath2moduleFn) {
  /**
   *
   * @param {string} absoluteFilePath
   * @returns {any}
   */
  function __webpack_require(absoluteFilePath) {
    const [moduleFn, relativeDepPath2absoluteDepPath] =
      absoluteFilePath2moduleFn[absoluteFilePath];
    if (!moduleFn) {
      return;
    }
    /**
     *
     * @param {string} relativeFilePath
     * @returns {any}
     */
    const __decorated_require = (relativeFilePath) => {
      const absoluteFilePath =
        relativeDepPath2absoluteDepPath[relativeFilePath];
      return __webpack_require(absoluteFilePath);
    };
    const __webpack_module = { exports: {} };
    moduleFn(__decorated_require, __webpack_module, __webpack_module.exports);
    return __webpack_module.exports;
  }

  __webpack_require(
    "/Users/usr1/github/wheel/packages/mini-webpack/src/main.js",
  );
})({
  "/Users/usr1/github/wheel/packages/mini-webpack/src/main.js": [
    /**
     *
     * @param {(absoluteFilePath: string) => any} __webpack_require
     * @param {{ exports: any }} __webpack_module
     * @param {{any}} exports
     */ function (__webpack_require, __webpack_module, exports) {
      // main.js
      const { foo } = __webpack_require("./foo.js");
      const { bar } = __webpack_require("./bar.js");
      foo();
      bar();
      console.log("main.js");
    },
    {
      "./foo.js": "/Users/usr1/github/wheel/packages/mini-webpack/src/foo.js",
      "./bar.js": "/Users/usr1/github/wheel/packages/mini-webpack/src/bar.js",
    },
  ],

  "/Users/usr1/github/wheel/packages/mini-webpack/src/foo.js": [
    /**
     *
     * @param {(absoluteFilePath: string) => any} __webpack_require
     * @param {{ exports: any }} __webpack_module
     * @param {{any}} exports
     */ function (__webpack_require, __webpack_module, exports) {
      // foo.js
      function foo() {
        console.log("foo.js");
      }
      __webpack_module.exports = { foo };
    },
    {},
  ],

  "/Users/usr1/github/wheel/packages/mini-webpack/src/bar.js": [
    /**
     *
     * @param {(absoluteFilePath: string) => any} __webpack_require
     * @param {{ exports: any }} __webpack_module
     * @param {{any}} exports
     */ function (__webpack_require, __webpack_module, exports) {
      // bar.js
      function bar() {
        console.log("bar.js");
      }
      __webpack_module.exports = { bar };
    },
    {},
  ],
});
