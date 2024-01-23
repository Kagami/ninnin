import AssDraw from "mpv-assdraw";

/** Some additional helpers for the AssDraw base class. */
export default class Ass extends AssDraw {
  bold(s: string) {
    return `{\\b1}${s}{\\b0}`;
  }
  B(s: string) {
    return this.bold(s);
  }

  append_nl(s = "") {
    return this.append(s + "\\N");
  }

  append_2nl(s = "") {
    return this.append(s + "\\N\\N");
  }
}
