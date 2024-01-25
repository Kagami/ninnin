import options from "./options";

export function getErrMsg(err: unknown) {
  return err && (err as Error).message ? (err as Error).message : String(err);
}

// OSD message, using ass.
export function message(text: string, duration?: number) {
  let ass = mp.get_property_osd("osd-ass-cc/0", "");
  // wanted to set font size here, but it's completely unrelated to the font
  // size in set_osd_ass.
  ass += text;
  mp.osd_message(ass, duration || options.message_duration);
}

export function calculate_scale_factor() {
  const baseResY = 720;
  const { height } = mp.get_osd_size()!;
  return height / baseResY;
}

// https://stackoverflow.com/a/23329386
/*export function byteLength(str: string) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i = str.length - 1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--; //trail surrogate
  }
  return s;
}*/

// https://stackoverflow.com/a/12203648
// FIXME: very slow, but charCode solution is broken on MuJS 1.3.4, see
// https://github.com/ccxvii/mujs/commit/5762138384aae4d5e034dbbd0f514ac2598c4ccf
// FIXME: fixed because of MuJS split bug:
// https://github.com/ccxvii/mujs/issues/130
export function byteLength(s: string) {
  const encoded = encodeURI(s);
  const ascii = encoded.replace(/%../g, "");
  return ascii.length + Math.floor((encoded.length - ascii.length) / 3);
}
