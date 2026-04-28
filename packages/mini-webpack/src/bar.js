import { foo } from "./foo.js";
import baz from "./baz.json";

foo();
console.log(baz);

export function bar() {
  console.log("bar.js");
}
