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
  // If set, writes video's filename or stream info to the "Title" field.
  write_metadata_title: true,
  // Sets the output format, from a few predefined ones.
  output_format: "svtav1",
  // Target filesize, in kB. This will be used to calculate the bitrate
  // used on the encode. If set to 0, CRF mode is used.
  target_filesize: 0,

  // ### Quality-specific settings:
  // https://trac.ffmpeg.org/wiki/Encode/H.264
  // https://trac.ffmpeg.org/wiki/Encode/H.265
  // CRF for x264/x265. 18=visually lossless. might consider 23-25 for smaller files
  x_crf: 20,
  // https://trac.ffmpeg.org/wiki/HWAccelIntro#VideoToolbox
  // https://stackoverflow.com/a/69668183
  // CRF for VideoToolBox. qscale=65 is "acceptable"
  vtb_crf: 65,
  // https://trac.ffmpeg.org/wiki/Encode/AV1
  // CRF for libaom/svt. av1_crf23 ~= x264_crf19, 30 ~= 24? 0-51 vs 0-63 ranges
  av1_crf: 30,

  // ### Speed-specific settings
  // pretty big files but fast encoding. for better size/quality consider hevc/av1
  x264_preset: "slow",
  // https://kokomins.wordpress.com/2019/10/10/anime-encoding-guide-for-x265-and-why-to-never-use-flac/
  // fast and slow are sweet spots. althoguh fast/medium have very similar performance and medium is better quality
  x265_preset: "medium",
  // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Ffmpeg.md
  // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Parameters.md
  // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/svt-av1_encoder_user_guide.md#sample-command-lines
  // 10 is faster than x265_fast and better VMAF. 8 and 9 also fast enough.
  svtav1_preset: 10,

  // ### Codec-specific settings
  // 0-50. 8=movie, 10-15=aggressive, 4-6=animation, 0=off (faster).
  // Note: "It is recommended to not use Film Grain for presets greater than 6".
  svtav1_film_grain: 0,

  // Scale video to a certain height, keeping the aspect ratio. -1 disables it.
  scale_height: -1,
  // Change the FPS of the output video, dropping or duplicating frames as needed.
  // -1 means the FPS will be unchanged from the source.
  fps: -1,
  // 10-bit encoding for 8-bit content (HEVC, AV1)
  // "Encoding with 10-bit depth results in more accurate colors and fewer artifacts with minimal increase in file size"
  force_10bit: false,
  // If set, applies the video filters currently used on the playback to the encode.
  apply_current_filters: true,
  // Force square pixels on output video
  // Some players like recent Firefox versions display videos with non-square pixels with wrong aspect ratio
  force_square_pixels: false,
  // In kilobits.
  audio_bitrate: 192,
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
