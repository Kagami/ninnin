// Set some useful functions on MuJS global object.

const g = Function("return this")();

g.console = {
  log: print,
};
