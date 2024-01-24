import type { Format } from "./encode/formats";
import options from "./options";

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
  // XXX: use proper parser if need to support more props, see
  // https://github.com/mpv-player/mpv/blob/5f7ce41/player/screenshot.c#L141
  const replaceTable: [RegExp, string][] = [
    [/%s/g, showTimePath(startTime)],
    [/%S/g, showTimePath(startTime, { ms: false })],
    [/%e/g, showTimePath(endTime)],
    [/%E/g, showTimePath(endTime, { ms: false })],
    [
      /%M/g,
      mp.get_property_native("aid") &&
      !mp.get_property_bool("mute") &&
      format.audioCodec
        ? "-audio"
        : "",
    ],
    [
      /%R/g,
      options.scale_height !== -1
        ? `-${options.scale_height}p`
        : `-${mp.get_property_number("height")}p`,
    ],
  ];

  let filename = options.output_template;
  for (const [regex, value] of replaceTable) {
    filename = filename.replace(regex, value);
  }

  filename = mp.command_native(["expand-text", filename]) as string;

  // Remove invalid chars
  // Windows: < > : " / \ | ? *
  // Linux: /
  filename = filename.replace(/[<>:"\/\\|?*]/g, "");

  return `${filename}.${format.outputExtension}`;
}
