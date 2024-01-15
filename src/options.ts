const options = {
  // Defaults to shift+w
  keybind: "W",
  // If empty, saves on the same directory of the playing video.
  // A starting "~" will be replaced by the home dir.
  output_directory: "~/Downloads", // FIXME: does it work everywhere?
  run_detached: false,
  // Template string for the output file
  // %f - Filename, with extension
  // %F - Filename, without extension
  // %T - Media title, if it exists, or filename, with extension (useful for some streams, such as YouTube).
  // %s, %e - Start and end time, with milliseconds
  // %S, %E - Start and end time, without milliseconds
  // %M - "-audio", if audio is enabled, empty otherwise
  // %R - "-(height)p", where height is the video's height, or scale_height, if it's enabled.
  // More specifiers are supported, see https://mpv.io/manual/master/#options-screenshot-template
  // Property expansion is supported (with %{} at top level, ${} when nested), see https://mpv.io/manual/master/#property-expansion
  output_template: "%F-[%s-%e]",

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
  // Custom encoding flags.
  additional_flags: "",
  // gif dither mode, 0-5 for bayer w/ bayer_scale 0-5, 6 for paletteuse default (sierra2_4a)
  gif_dither: 2,

  // The font size used in the menu. Isn't used for the notifications (started encode, finished encode etc)
  font_size: 28,
  margin: 10,
  message_duration: 5,
};

export default options;
export type Options = typeof options;
