import options from "./options";
import { StringStartsWith } from "./lib/helpers";

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

export function get_pass_logfile_path(encode_out_path: string) {
  return `${encode_out_path}-video-pass1.log`;
}

// TODO: keep only yt-dl video ID?
export function stripProtocol(url: string | undefined) {
  if (!url) return;
  if (StringStartsWith(url, "http://")) {
    url = url.slice(7);
  } else if (StringStartsWith(url, "https://")) {
    url = url.slice(8);
  } else {
    // ignore unknown protocol
    return;
  }
  if (StringStartsWith(url, "www.")) {
    url = url.slice(4);
  }
  return url;
}

// https://stackoverflow.com/a/23329386
export function byteLength(str: string) {
  // returns the byte length of an utf8 string
  var s = str.length;
  for (var i = str.length - 1; i >= 0; i--) {
    var code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--; //trail surrogate
  }
  return s;
}
