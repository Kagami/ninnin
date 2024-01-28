import type { MP } from "mpv.d.ts";

import options from "../options";
import { ObjectEntries } from "../lib/helpers";
import { type Region } from "../video-to-screen";
import { type Format } from "./formats";

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

// FIXME: does it work with --start/--end and setpts?
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

function append_property(out: string[], property_name: string, def = "") {
  const prop = mp.get_property(property_name);
  if (prop !== def) {
    out.push(`--${property_name}=${prop}`);
  }
}

/**
 * Get the current playback options, trying to match how the video is being played.
 */
function get_playback_options() {
  const ret: string[] = [];
  append_property(ret, "sub-ass-override", "yes");
  append_property(ret, "sub-ass-style-overrides");
  append_property(ret, "sub-ass-vsfilter-aspect-compat", "yes");
  append_property(ret, "sub-auto", "exact");
  append_property(ret, "sub-pos", "100.000000");
  append_property(ret, "sub-delay", "0.000000");
  append_property(ret, "video-rotate", "0");
  append_property(ret, "deinterlace", "no");
  append_property(ret, "ytdl-format");
  return ret;
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

export function getVideoPPFlags(format: Format, region: Region): string[] {
  const flags: string[] = [];
  flags.push(...get_playback_options());

  const filters = get_video_filters(format, region);
  for (const f of filters) {
    flags.push(`--vf-add=${f}`);
  }

  return flags;
}

/**
 * Change speed of the video with setpts filter.
 * https://trac.ffmpeg.org/wiki/How%20to%20speed%20up%20/%20slow%20down%20a%20video
 */
export function getSpeedFlags(): string[] {
  // FIXME: option to use minterpolate filter for slowing down
  // FIXME: change fps when speeding up?
  const speed = mp.get_property_number("speed", 1);
  if (speed === 1) {
    return [];
  } else {
    // XXX: `--sub-speed=1/${speed}` isn't needed because subs were already hardsubbed.
    // But if we can change setpts without pipe, then will need to use that flag.
    const s = speed.toFixed(3);
    return [`--vf-add=setpts=PTS/${s}`, `--af-add=atempo=${s}`];
  }
}
