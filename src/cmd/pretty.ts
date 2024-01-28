import options from "../options";
import { type Format } from "./formats";
import { StringStartsWith } from "../lib/helpers";
import { isStream } from "../utils";

function pad2(n: number) {
  let s = Math.floor(n) + "";
  if (s.length === 1) {
    s = "0" + s;
  }
  return s;
}

export function showTime(
  seconds: number,
  { ms = true, hr = false, sep = ":" } = {}
) {
  if (seconds < 0) return "unknown";
  let ret = "";
  if (ms) {
    ret = (seconds % 1).toFixed(3).slice(1);
  }
  ret = pad2((seconds / 60) % 60) + sep + pad2(seconds % 60) + ret;
  if (hr || seconds > 3600) {
    ret = Math.floor(seconds / 3600) + sep + ret;
  }
  return ret;
}

function showTimePath(seconds: number, { ms = true } = {}) {
  return showTime(seconds, { ms, sep: "." });
}

export function formatFilename(
  format: Format,
  startTime: number,
  endTime: number
) {
  let fname = options.output_template;

  // expand our custom props
  const ppos = mp.get_property_number("playlist-pos", 0);
  const replaceTable: [RegExp, string][] = [
    [/%s/g, showTimePath(startTime)],
    [/%S/g, showTimePath(startTime, { ms: false })],
    [/%e/g, showTimePath(endTime)],
    [/%E/g, showTimePath(endTime, { ms: false })],
    // media-title fallbacks to filename with ext
    [/%T/g, `\${playlist/${ppos}/title:\${filename/no-ext}}`],
  ];
  for (const [regex, value] of replaceTable) {
    fname = fname.replace(regex, value);
  }

  // expand mpv props
  fname = mp.command_native(["expand-text", fname]) as string;

  // Remove invalid chars
  // Windows: < > : " / \ | ? *
  // Linux: /
  fname = fname.replace(/[<>:"\/\\|?*]/g, "");

  // Normally ~255 but keep space prefix/extension/etc.
  // FIXME: what to do with MAX_PATH=260 on Windows?
  // FIXME: what to do with too long titles (we will truncate timestamps)?
  const MAX_NAME_LEN = 200;
  fname = fname.slice(0, MAX_NAME_LEN);
  return `${fname}.${format.outputExtension}`;
}

export function getOutPath(format: Format, startTime: number, endTime: number) {
  if (format.outputExtension === "-") return "-"; // pipe

  let dir = "";
  if (options.output_directory) {
    dir = mp.utils.get_user_path(options.output_directory);
  } else {
    if (isStream()) {
      // don't have file path for streams, so saving to HOME
      dir = mp.utils.get_user_path("~/");
    } else {
      // save to the directory of the playing video it dir wasn't specified
      const path = mp.get_property("path")!;
      dir = mp.utils.split_path(path)[0];
    }
  }

  const formatted_filename = formatFilename(format, startTime, endTime);
  return mp.utils.join_path(dir, formatted_filename);
}

// FIXME: remove once fixed upstream:
// https://github.com/mpv-player/mpv/issues/13358
export function stripYtTime(s: string): string {
  if (!/^https?:.*youtu/.test(s)) return s;
  return s.replace(/([?&])t=[.\d]+s?(&|$)/, (_, p1, p2) => (p2 ? p1 : ""));
}

function matchYtID(url: string): string | undefined {
  // TODO: is that regexp good enough?
  const m = url.match(/youtu.*([?&]v=|\/)([0-9A-Za-z_-]{11})/);
  return m ? m[2] : undefined;
}

/** Simplify URL to use in the title. */
export function titleURL(url?: string): string | undefined {
  if (!url) return;
  if (!/^https?:/.test(url)) return;

  // simplify youtube URLs
  const ytID = matchYtID(url);
  if (ytID) return `youtu.be/${ytID}`;

  // strip unnecessary components
  if (StringStartsWith(url, "http://")) {
    url = url.slice(7);
  } else if (StringStartsWith(url, "https://")) {
    url = url.slice(8);
  } else {
    return;
  }
  if (StringStartsWith(url, "www.")) {
    url = url.slice(4);
  }

  return url;
}

export function getMetadataTitle() {
  const TITLE_STRIP = 100;
  const ppos = mp.get_property_number("playlist-pos", 0);
  let title = mp.get_property(`playlist/${ppos}/title`, "");
  // FIXME: surrogate pairs, safe?
  title = title.slice(0, TITLE_STRIP);

  if (isStream()) {
    // For remote files we append the URL.
    let url = titleURL(mp.get_property("path"));
    if (url) {
      url = url.slice(0, TITLE_STRIP);
      // could be 203 chars max here but should be fine
      title = title ? `${title} (${url})` : url;
    }
  } else {
    // For local files we fallback to filename.
    if (!title) {
      title = mp.get_property("filename/no-ext", "");
      title = title.slice(0, TITLE_STRIP);
    }
  }

  return title;
}
