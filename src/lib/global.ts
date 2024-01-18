/** Set some useful functions on MuJS global object. */

// Promise polyfill
import "mpv-promise";

const g = Function("return this")();

// Console polyfill
g.console = {
  log: print,
};
