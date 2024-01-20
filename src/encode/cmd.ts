import type { MP } from "mpv.d.ts";

import { type Format, getCurrentFormat } from "./formats";
import type { Region } from "../video-to-screen";
import options from "../options";
import { byteLength, message, stripProtocol } from "../utils";
import { ObjectEntries, StringStartsWith } from "../lib/helpers";
import { formatFilename, showTime } from "../pretty";
import { getNullPath } from "../lib/os";

type Track = MP.Prop.Track;
interface ActiveTracks {
  video: Track[];
  audio: Track[];
  sub: Track[];
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
  for (const track of mp.get_property_native("track-list") as Track[]) {
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

function append_track(out: string[], track: Track) {
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

function append_audio_tracks(out: string[], tracks: Track[]) {
  // Some additional logic is needed for audio tracks because it seems
  // multiple active audio tracks are a thing? We probably only can reliably
  // use internal tracks for this so, well, we keep track of them and see if
  // more than one is active.
  const internal_tracks: Track[] = [];

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
  const mpv_brightness = mp.get_property_number("brightness", 0);
  const mpv_contrast = mp.get_property_number("contrast", 0);
  const mpv_saturation = mp.get_property_number("saturation", 0);

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
  const speed = mp.get_property_number("speed", 1);
  if (speed !== 1) {
    ret.push(
      `--vf-add=setpts=PTS/${speed}`,
      `--af-add=atempo=${speed}`,
      `--sub-speed=1/${speed}`
    );
  }
  return ret;
}

const TITLE_STRIP = 100;
export function getMetadataTitle() {
  const fname = mp.get_property("filename");
  let title = mp.get_property("media-title");
  if (title === fname) {
    // > If the currently played file has a title tag, use that.
    // > Otherwise, return the filename property.
    title = undefined;
  }
  if (title) {
    title = title.slice(0, TITLE_STRIP);
  }

  // For remote files we append/use the URL.
  // For local files we use the filename if empty.
  if (isStream()) {
    let url = mp.get_property("path");
    if (url && !StringStartsWith(url, "http")) {
      // ignore weird protocols
      url = undefined;
    }
    url = stripProtocol(url);
    if (url) {
      url = url.slice(0, TITLE_STRIP);
      // could be 203 chars max here but should be fine
      title = title ? title + ` [${url}]` : url;
    }
  } else {
    const fnoext = mp.get_property("filename/no-ext", "").slice(0, TITLE_STRIP);
    title = title || fnoext;
  }

  return title;
}

function get_metadata_flags() {
  const title = getMetadataTitle();
  // XXX: seems like no other way to escape arbitrary input in mpv.
  // FIXME: does this work on Windows?
  return title ? [`--oset-metadata=title=%${byteLength(title)}%${title}`] : [];
}

function apply_current_filters(filters: string[]) {
  const vf = mp.get_property_native("vf") as MP.Prop.Filter[];
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

function calcBitrate(
  hasVideoTrack: boolean,
  hasAudioTrack: boolean,
  duration: number
) {
  if (!hasVideoTrack) {
    return [0, options.audio_bitrate];
  }

  let video_bitrate = 0;
  if (options.target_filesize) {
    let video_kilobits = options.target_filesize * 8;
    let audio_kilobits = 0;
    if (hasAudioTrack) {
      audio_kilobits = options.audio_bitrate * duration;
      video_kilobits -= audio_kilobits;
    }
    video_bitrate = Math.floor(video_kilobits / duration);
    // absolute minimum 100kbps
    // FIXME: warn in UI?
    video_bitrate = Math.max(100, video_bitrate);
  }

  return [video_bitrate, options.audio_bitrate];
}

function isStream() {
  return mp.get_property_bool("demuxer-via-network");
}

// FIXME: remove side-effects from cmd building routine
function fixLivePathTime(path: string, startTime: number, endTime: number) {
  let isLive = false;
  let livePath = path;
  /*if (isStream()) {
    if (mp.get_property("file-format") === "hls") {
      // FIXME: does it work?
      // FIXME: doesn't need in case of HLS VOD?
      // Attempt to dump the stream cache into a temporary file
      livePath = mp.utils.join_path(parse_directory("~"), ".ninnin-live-dump.ts");
      mp.command_native([
        "dump_cache",
        seconds_to_time_string(startTime, false, true),
        seconds_to_time_string(endTime + 5, false, true),
        path,
      ]);
      endTime = endTime - startTime;
      startTime = 0;
      isLive = true;
    }
  }*/

  return { isLive, livePath, startTime, endTime };
}

// FIXME: don't call get_property for pure functions?
export function getOutPath(startTime: number, endTime: number) {
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

  const formatted_filename = formatFilename(
    startTime,
    endTime,
    getCurrentFormat()
  );
  return mp.utils.join_path(dir, formatted_filename);
}

export function shouldTwoPass(format: Format) {
  if (options.target_filesize) return format.twoPassSupported;
  return format.twoPassPreferable;
}

export function buildCommand(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const path = mp.get_property("path");
  if (!path) {
    message("No file is being played");
    return;
  }

  const { isLive, livePath, startTime, endTime } = fixLivePathTime(
    path,
    origStartTime,
    origEndTime
  );

  const format = getCurrentFormat();
  const active_tracks = get_active_tracks();
  const supported_active_tracks = filter_tracks_supported_by_format(
    active_tracks,
    format
  );

  // Video track is required for Video format but Audio is optional
  const hasVideoCodec = !!format.videoCodec;
  const hasVideoTrack = !!supported_active_tracks.video.length;
  if (hasVideoCodec && !hasVideoTrack) {
    message("No video track selected");
    return;
  }
  const hasAudioTrack = !!supported_active_tracks.audio.length;
  if (!hasVideoTrack && !hasAudioTrack) {
    message("No video and audio tracks selected");
    return;
  }

  const args = [
    "mpv",
    livePath,
    "--no-terminal",
    // FIXME: shift by 1ms to be frame exact
    // FIXME: not needed if encoding full file?
    "--start=" + showTime(startTime, { hr: true }),
    "--end=" + showTime(endTime, { hr: true }),
    // When loop-file=inf, the encode won't end. Set this to override.
    "--loop-file=no",
    // Same thing with --pause
    "--no-pause",
  ];

  const duration = endTime - startTime;
  const [vbitrate, abitrate] = calcBitrate(
    hasVideoTrack,
    hasAudioTrack,
    duration
  );
  if (hasVideoTrack) {
    args.push(...format.getVideoFlags());
    // FIXME: CQ mode for libvpx/libaom
    if (vbitrate) {
      args.push(`--ovcopts-add=b=${vbitrate}k`);
    } else {
      args.push(...format.getVideoQualityFlags());
    }
  }
  if (hasAudioTrack) {
    args.push(...format.getAudioFlags());
    args.push(`--oacopts-add=b=${abitrate}k`);
    // FIXME: do we need to downmix to stereo in case of e.g. 5.1 source?
    // command.push("--audio-channels=2");
  }

  // FIXME: does order of codec/track flags matter?
  // Append selected tracks
  for (const [track_type, tracks] of ObjectEntries(supported_active_tracks)) {
    if (track_type === "audio") {
      append_audio_tracks(args, tracks);
    } else {
      for (const track of tracks) {
        append_track(args, track);
      }
    }
  }
  // Disable non-selected tracks
  for (const [track_type, tracks] of ObjectEntries(supported_active_tracks)) {
    if (tracks.length) continue;
    switch (track_type) {
      case "video":
        args.push("--vid=no");
        break;
      case "audio":
        args.push("--aid=no");
        break;
      case "sub":
        args.push("--sid=no");
        break;
    }
  }

  if (hasVideoTrack) {
    // All those are only valid for video codecs.
    args.push(...get_video_encode_flags(format, region));
  }

  if (options.write_metadata_title) {
    args.push(...get_metadata_flags());
  }

  // split the user-passed settings on whitespace
  if (options.additional_flags.trim()) {
    args.push(...options.additional_flags.trim().split(/\s+/));
  }

  const outPath = getOutPath(origStartTime, origEndTime);

  // finalize pass 1 flags
  const argsPass1 = args.slice();
  argsPass1.push(...format.getPass1Flags(outPath));
  argsPass1.push("--of=null");
  argsPass1.push(`--o=${getNullPath()}`);

  // finalize pass 0/2 flags
  if (shouldTwoPass(format)) {
    args.push(...format.getPass2Flags(outPath));
  } else {
    args.push(...format.getPass0Flags(outPath));
  }
  args.push(...format.getMuxerFlags());
  args.push(`--o=${outPath}`);

  return {
    args,
    argsPass1,
    isLive,
    livePath,
    outPath,
    startTime,
    endTime,
  };
}
