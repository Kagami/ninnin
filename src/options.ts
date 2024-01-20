/** Central options module. Do not import non-lib modules here to avoid cyclic imports. */

import { ObjectAssign, ObjectEntries } from "./lib/helpers";
import { mkdirp } from "./lib/os";

const DEFAULT_OPTIONS = {
  // Defaults to shift+w
  keybind: "W",
  // If empty, saves on the same directory of the playing video.
  // A starting "~" will be replaced by the home dir.
  output_directory: "~/Downloads", // FIXME: does it work everywhere?
  // Template string for the output file
  // %s, %e - Start and end time, with milliseconds
  // %S, %E - Start and end time, without milliseconds
  // %M - "-audio", if audio is enabled, empty otherwise
  // %R - "-(height)p", where height is the video's height, or scale_height, if it's enabled.
  // Property expansion is supported, see https://mpv.io/manual/master/#property-expansion
  output_template: "${filename/no-ext}-[%s-%e]",

  // Sets the output format, from a few predefined ones.
  output_format: "x264",
  // Scale video to a certain height, keeping the aspect ratio. -1 disables it.
  scale_height: -1,
  // Target filesize, in kB. This will be used to calculate the bitrate
  // used on the encode. If this is set to <= 0, the video bitrate will be set
  // to 0, which might enable constant quality modes, depending on the
  // video codec that's used (VP8 and VP9, for example).
  target_filesize: 0,
  // Presets, applicable to some encoders.
  x264_preset: "slow",
  // Recommended fast and slow here:
  // https://kokomins.wordpress.com/2019/10/10/anime-encoding-guide-for-x265-and-why-to-never-use-flac/
  x265_preset: "fast",
  // Constant Rate Factor (CRF). The value meaning and limits may change,
  // from codec to codec. Set to -1 to disable.
  crf: 20,
  // https://stackoverflow.com/a/69668183
  // -q:v 65 is "acceptable"
  vtb_qscale: 65,
  // Change the FPS of the output video, dropping or duplicating frames as needed.
  // -1 means the FPS will be unchanged from the source.
  fps: -1,
  // If set, applies the video filters currently used on the playback to the encode.
  apply_current_filters: true,
  // Force square pixels on output video
  // Some players like recent Firefox versions display videos with non-square pixels with wrong aspect ratio
  force_square_pixels: false,
  // In kilobits.
  audio_bitrate: 192,
  // If set, writes video's filename or stream info to the "Title" field.
  write_metadata_title: true,
  // Custom encoding flags.
  additional_flags: "",
  // gif dither mode, 0-5 for bayer w/ bayer_scale 0-5, 6 for paletteuse default (sierra2_4a)
  // gif_dither: 2,

  // The font size used in the menu. Isn't used for the notifications (started encode, finished encode etc)
  font_size: 20,
  margin: 10,
  message_duration: 5,
};

/**
 * Mutable state of the current options.
 *
 * Should be quite safe to use in pure functions because we only do single
 * encoding at once and can change options only via user interaction.
 */
export const options = { ...DEFAULT_OPTIONS };

function serializeValue(value: string | number | boolean): string {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
}

/** Dump current options in the MPV format */
export function serializeOptions(opts: Options): string {
  let ret = "# WILL BE OVERWRITTEN BY THE SCRIPT, EDIT WITH CAUTION\n";
  for (const [key, value] of ObjectEntries(opts)) {
    ret += `${key}=${serializeValue(value)}\n`;
  }
  return ret;
}

function getConfigPath() {
  return mp.utils.get_user_path("~~home/script-opts/ninnin.conf");
}

/** Save current options. */
export function saveOptions() {
  const cfgPath = getConfigPath();
  const [dir, _] = mp.utils.split_path(cfgPath);
  mkdirp(dir);
  mp.utils.write_file("file://" + cfgPath, serializeOptions(options));
}

/** Reset options to defaults. */
export function resetOptions() {
  ObjectAssign(options, DEFAULT_OPTIONS);
  saveOptions();
}

export default options;
export type Options = typeof options;
