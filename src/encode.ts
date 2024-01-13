import { formats, type Format } from "./formats";
import type { Region } from "./video-to-screen";
import options from "./options";
import {
  bold,
  file_exists,
  format_filename,
  get_pass_logfile_path,
  message,
  parse_directory,
  remove_file,
  run_subprocess,
  seconds_to_time_string,
  should_display_progress,
} from "./utils";
import EncodeWithProgress from "./encode-with-progress";
import { ObjectEntries } from "./polyfills";
import type { MP } from "./mpv";

interface ActiveTracks {
  video: MP.Track[];
  audio: MP.Track[];
  sub: MP.Track[];
}

function get_active_tracks() {
  const accepted = {
    video: true,
    audio: !mp.get_property_bool("mute"),
    sub: mp.get_property_bool("sub-visibility"),
  };
  const active: ActiveTracks = {
    video: [],
    audio: [],
    sub: [],
  };
  for (const track of mp.get_property_native("track-list") as MP.Track[]) {
    const trType = track.type as keyof typeof accepted;
    if (track.selected && accepted[trType]) {
      active[trType].push(track);
    }
  }
  return active;
}

function filter_tracks_supported_by_format(
  active_tracks: ActiveTracks,
  format: Format
) {
  const has_video_codec = !!format.videoCodec;
  const has_audio_codec = !!format.audioCodec;

  const supported = {
    video: has_video_codec ? active_tracks.video : [],
    audio: has_audio_codec ? active_tracks.audio : [],
    sub: has_video_codec ? active_tracks.sub : [],
  };

  return supported;
}

function append_track(out: string[], track: MP.Track) {
  const external_flag = {
    audio: "audio-file",
    sub: "sub-file",
  };
  const internal_flag = {
    video: "vid",
    audio: "aid",
    sub: "sid",
  };

  // The external tracks rely on the behavior that, when using
  // audio-file/sub-file only once, the track is selected by default.
  // Also, for some reason, ytdl-hook produces external tracks with absurdly long
  // filenames; this breaks our command line. Try to keep it sane, under 2048 characters.
  const trType = track.type as keyof typeof external_flag;
  if (track.external && track["external-filename"].length <= 2048) {
    out.push(`--${external_flag[trType]}=${track["external-filename"]}`);
  } else {
    out.push(`--${internal_flag[trType]}=${track.id}`);
  }
}

function append_audio_tracks(out: string[], tracks: MP.Track[]) {
  // Some additional logic is needed for audio tracks because it seems
  // multiple active audio tracks are a thing? We probably only can reliably
  // use internal tracks for this so, well, we keep track of them and see if
  // more than one is active.
  const internal_tracks: MP.Track[] = [];

  for (const track of tracks) {
    if (track.external) {
      // For external tracks, just do the same thing.
      append_track(out, track);
    } else {
      internal_tracks.push(track);
    }
  }

  if (internal_tracks.length > 1) {
    // We have multiple audio tracks, so we use a lavfi-complex
    // filter to mix them.
    let filter_string = "";
    for (const track of internal_tracks) {
      filter_string += `[aid${track.id}]`;
    }
    filter_string += "amix[ao]";
    out.push(`--lavfi-complex=${filter_string}`);
  } else if (internal_tracks.length === 1) {
    append_track(out, internal_tracks[0]);
  }
}

function get_scale_filters() {
  const filters: string[] = [];
  if (options.force_square_pixels) {
    filters.push("lavfi-scale=iw*sar:ih");
  }
  if (options.scale_height > 0) {
    filters.push(`lavfi-scale=-2:${options.scale_height}`);
  }
  return filters;
}

function get_fps_filters() {
  if (options.fps > 0) {
    return [`fps=${options.fps}`];
  }
  return [];
}

function get_contrast_brightness_and_saturation_filters() {
  const mpv_brightness = mp.get_property_native("brightness");
  const mpv_contrast = mp.get_property_native("contrast");
  const mpv_saturation = mp.get_property_native("saturation");

  if (mpv_brightness === 0 && mpv_contrast === 0 && mpv_saturation === 0) {
    // Default values, no need to change anything.
    return [];
  }

  // We have to map mpv's contrast/brightness/saturation values to the ones used by the eq filter.
  // From what I've gathered from looking at ffmpeg's source, the contrast value is used to multiply the luma
  // channel, while the saturation one multiplies both chroma channels. On mpv, it seems that contrast multiplies
  // both luma and chroma (?); but I don't really know a lot about how things work internally. This might cause some
  // weird interactions, but for now I guess it's fine.
  const eq_saturation = (mpv_saturation + 100) / 100.0;
  const eq_contrast = (mpv_contrast + 100) / 100.0;

  // For brightness, this should work I guess... For some reason, contrast is factored into how the luma offset is
  // calculated on the eq filter, so we need to offset it in a way that the effective offset added is the same.
  // Also, on mpv's side, we add it after the conversion to RGB; I'm not sure how that affects things but hopefully
  // it ends in the same result.
  const eq_brightness = (mpv_brightness / 50.0 + eq_contrast - 1) / 2.0;

  return [
    `lavfi-eq=contrast=${eq_contrast}:saturation=${eq_saturation}:brightness=${eq_brightness}`,
  ];
}

function append_property(
  out: string[],
  property_name: string,
  option_name = property_name
) {
  const prop = mp.get_property(property_name);
  if (prop) {
    out.push(`--${option_name}=${prop}`);
  }
}

// Reads a mpv "list option" property and set the corresponding command line flags (as specified on the manual)
// option_prefix is optional, will be set to property_name if empty
// function append_list_options(
//   out: string[],
//   property_name: string,
//   option_prefix = property_name
// ) {
//   const prop = mp.get_property_native(property_name);
//   if (prop) {
//     for (const value of prop) {
//       out.push(`--${option_prefix}-append=${value}`);
//     }
//   }
// }

// Get the current playback options, trying to match how the video is being played.
// TODO: don't pass default values?
function get_playback_options() {
  const ret: string[] = [];
  append_property(ret, "sub-ass-override");
  append_property(ret, "sub-ass-force-style");
  append_property(ret, "sub-ass-vsfilter-aspect-compat");
  append_property(ret, "sub-auto");
  append_property(ret, "sub-pos");
  append_property(ret, "sub-delay");
  append_property(ret, "video-rotate");
  append_property(ret, "ytdl-format");
  append_property(ret, "deinterlace");

  return ret;
}

function get_speed_flags() {
  const ret: string[] = [];
  const speed = mp.get_property_native("speed");
  if (speed !== 1) {
    ret.push(
      `--vf-add=setpts=PTS/${speed}`,
      `--af-add=atempo=${speed}`,
      `--sub-speed=1/${speed}`
    );
  }
  return ret;
}

function get_metadata_flags() {
  const title = mp.get_property("filename/no-ext");
  return [`--oset-metadata=title=%${title.length}%${title}`];
}

function apply_current_filters(filters: string[]) {
  const vf = mp.get_property_native("vf");
  mp.msg.verbose(`apply_current_filters: got ${vf.length} currently applied.`);
  for (const filter of vf) {
    mp.msg.verbose(`apply_current_filters: filter name: ${filter.name}`);
    // This might seem like a redundant check (if not filter["enabled"] would achieve the same result),
    // but the enabled field isn't guaranteed to exist... and if it's nil, "not filter['enabled']"
    // would achieve a different outcome.
    if (filter.enabled === false) {
      continue;
    }
    let str = filter.name;
    const params: { [key: string]: string } = filter.params || {};
    for (const [k, v] of ObjectEntries(params)) {
      str += `:${k}=%${v.length}%${v}`;
    }
    filters.push(str);
  }
}

function get_video_filters(format: Format, region: Region) {
  const filters: string[] = [];
  filters.push(...format.getPreFilters());

  if (options.apply_current_filters) {
    apply_current_filters(filters);
  }

  if (region.is_valid()) {
    filters.push(`lavfi-crop=${region.w}:${region.h}:${region.x}:${region.y}`);
  }

  filters.push(...get_scale_filters());
  filters.push(...get_fps_filters());
  filters.push(...get_contrast_brightness_and_saturation_filters());

  filters.push(...format.getPostFilters());

  return filters;
}

function get_video_encode_flags(format: Format, region: Region) {
  const flags: string[] = [];
  flags.push(...get_playback_options());

  const filters = get_video_filters(format, region);
  for (const f of filters) {
    flags.push(`--vf-add=${f}`);
  }

  flags.push(...get_speed_flags());
  return flags;
}

// FIXME: return object and indicate null?
function calculate_bitrate(
  active_tracks: ActiveTracks,
  format: Format,
  length: number
) {
  // FIXME: don't need this?
  if (!format.videoCodec) {
    // Allocate everything to the audio, not a lot we can do here
    return [0, (options.target_filesize * 8) / length];
  }

  let video_kilobits = options.target_filesize * 8;
  let audio_kilobits = 0;

  // FIXME: remove and always handle audio bitrate
  const has_audio_track = active_tracks.audio.length > 0;
  if (options.strict_filesize_constraint && has_audio_track) {
    // We only care about audio bitrate on strict encodes
    audio_kilobits = length * options.strict_audio_bitrate;
    video_kilobits -= audio_kilobits;
  }

  const video_bitrate = Math.floor(video_kilobits / length);
  const audio_bitrate = audio_kilobits
    ? Math.floor(audio_kilobits / length)
    : 0;

  return [video_bitrate, audio_bitrate];
}

// FIXME: remove side-effects from cmd building routine
function fixPathTime(startTime: number, endTime: number) {
  const path: string = mp.get_property("path");
  if (!path) return;

  const is_stream = !file_exists(path);
  let is_temporary = false;
  if (is_stream) {
    if (mp.get_property("file-format") === "hls") {
      // FIXME: does it work?
      // FIXME: doesn't need in case of HLS VOD?
      // Attempt to dump the stream cache into a temporary file
      const path = mp.utils.join_path(parse_directory("~"), "cache_dump.ts");
      mp.command_native([
        "dump_cache",
        seconds_to_time_string(startTime, false, true),
        seconds_to_time_string(endTime + 5, false, true),
        path,
      ]);

      endTime = endTime - startTime;
      startTime = 0;
      is_temporary = true;
    }
  }

  return { path, is_stream, is_temporary, startTime, endTime };
}

// FIXME: remove side-effects from cmd building routine (two pass)
export function buildCommand(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const pathRes = fixPathTime(origStartTime, origEndTime);
  if (!pathRes) {
    message("No file is being played");
    return;
  }
  const { path, is_stream, is_temporary, startTime, endTime } = pathRes;

  const command = [
    "mpv",
    path,
    // FIXME: shift by 1ms to be frame exact
    "--start=" + seconds_to_time_string(startTime, false, true),
    "--end=" + seconds_to_time_string(endTime, false, true),
    // When loop-file=inf, the encode won't end. Set this to override.
    "--loop-file=no",
    // Same thing with --pause
    "--no-pause",
  ];

  const format = formats[options.output_format];
  command.push(...format.getCodecFlags());

  const active_tracks = get_active_tracks();
  const supported_active_tracks = filter_tracks_supported_by_format(
    active_tracks,
    format
  );
  for (const [track_type, tracks] of ObjectEntries(supported_active_tracks)) {
    if (track_type === "audio") {
      append_audio_tracks(command, tracks);
    } else {
      for (const track of tracks) {
        append_track(command, track);
      }
    }
  }

  for (const [track_type, tracks] of ObjectEntries(supported_active_tracks)) {
    if (tracks.length > 0) continue;
    switch (track_type) {
      case "video":
        command.push("--vid=no");
        break;
      case "audio":
        command.push("--aid=no");
        break;
      case "sub":
        command.push("--sid=no");
        break;
    }
  }

  if (format.videoCodec) {
    // All those are only valid for video codecs.
    command.push(...get_video_encode_flags(format, region));
  }

  command.push(...format.getFlags());

  if (options.write_filename_on_metadata) {
    command.push(...get_metadata_flags());
  }

  if (format.acceptsBitrate) {
    if (options.target_filesize > 0) {
      const length = endTime - startTime;
      const [video_bitrate, audio_bitrate] = calculate_bitrate(
        supported_active_tracks,
        format,
        length
      );
      if (video_bitrate) {
        command.push(`--ovcopts-add=b=${video_bitrate}k`);
      }

      if (audio_bitrate) {
        command.push(`--oacopts-add=b=${audio_bitrate}k`);
      }

      if (options.strict_filesize_constraint) {
        const type = format.videoCodec ? "ovc" : "oac";
        const bitrate = Math.floor((options.target_filesize * 8) / length); // XXX: missed in Lua, bug?
        command.push(
          `--${type}opts-add=minrate=${bitrate}k`,
          `--${type}opts-add=maxrate=${bitrate}k`
        );
      }
    } else {
      const type = format.videoCodec ? "ovc" : "oac";
      // set video bitrate to 0. This might enable constant quality, or some
      // other encoding modes, depending on the codec.
      command.push(`--${type}opts-add=b=0`);
    }
  }

  // split the user-passed settings on whitespace
  if (options.additional_flags.trim()) {
    command.push(...options.additional_flags.trim().split(/\s+/));
  }

  if (!options.strict_filesize_constraint) {
    if (options.non_strict_additional_flags.trim()) {
      command.push(...options.non_strict_additional_flags.trim().split(/\s+/));
    }

    // Also add CRF here, as it used to be a part of the non-strict flags.
    // This might change in the future, I don't know.
    if (options.crf >= 0) {
      command.push(`--ovcopts-add=crf=${options.crf}`);
    }
  }

  let dir = "";
  if (is_stream) {
    dir = parse_directory("~");
  } else {
    [dir] = mp.utils.split_path(path);
  }

  if (options.output_directory) {
    dir = parse_directory(options.output_directory);
  }

  const formatted_filename = format_filename(
    origStartTime,
    origEndTime,
    format
  );
  const out_path = mp.utils.join_path(dir, formatted_filename);
  command.push(`--o=${out_path}`);

  return {
    command,
    is_stream,
    is_temporary,
    path,
    out_path,
    startTime,
    endTime,
  };
}

export default function doEncode(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const cmdRes = buildCommand(region, origStartTime, origEndTime);
  if (!cmdRes) return;
  const {
    command,
    is_stream,
    is_temporary,
    path,
    out_path,
    startTime,
    endTime,
  } = cmdRes;

  // emit_event("encode-started");

  // Do the first pass now, as it won't require the output path. I don't think this works on streams.
  // Also this will ignore run_detached, at least for the first pass.
  const format = formats[options.output_format];
  if (options.twopass && format.supportsTwopass && !is_stream) {
    // copy the commandline
    const first_pass_cmdline = command.slice();
    first_pass_cmdline.push("--ovcopts-add=flags=+pass1");
    message("Starting first pass...");
    mp.msg.verbose("First-pass command line: ", first_pass_cmdline.join(" "));
    const res = run_subprocess({
      args: first_pass_cmdline,
      cancellable: false,
    });
    if (!res) {
      message("First pass failed! Check the logs for details.");
      // emit_event("encode-finished", "fail");

      return;
    }

    // set the second pass flag on the final encode command
    command.push("--ovcopts-add=flags=+pass2");

    // if (format.videoCodec === "libvpx") {
    //   // We need to patch the pass log file before running the second pass.
    //   mp.msg.verbose("Patching libvpx pass log file...");
    //   vp8_patch_logfile(get_pass_logfile_path(out_path), endTime - startTime);
    // }
  }

  // command = format.postCommandModifier(command, region, startTime, endTime)

  mp.msg.info("Encoding to", out_path);
  mp.msg.info("Command line:", command.join(" "));

  if (options.run_detached) {
    message("Started encode, process was detached.");
    mp.utils.subprocess_detached({ args: command });
  } else {
    let res = false;
    if (!should_display_progress()) {
      message("Started encode...");
      res = run_subprocess({ args: command, cancellable: false });
    } else {
      const ewp = new EncodeWithProgress(startTime, endTime);
      res = ewp.startEncode(command);
    }
    if (res) {
      message(`Encoded successfully! Saved to\\N${bold(out_path)}`);
      // emit_event("encode-finished", "success");
    } else {
      message("Encode failed! Check the logs for details.");
      // emit_event("encode-finished", "fail");
    }

    // Clean up pass log file.
    remove_file(get_pass_logfile_path(out_path));
    if (is_temporary) {
      remove_file(path);
    }
  }
}
