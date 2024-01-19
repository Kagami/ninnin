import type { MP } from "mpv.d.ts";

interface Point {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface Dimensions {
  top_left: Point;
  bottom_right: Point;
  ratios: Size;
}

// most functions were shamelessly copypasted from occivink's mpv-scripts, changed to moonscript syntax
let dimensions_changed = true;
let _video_dimensions: Dimensions | undefined;

// Code that uses get_video_dimensions should observe the mpv properties that could affect
// the resulting video dimensions, and call set_dimensions_changed when one of them change.
// See CropPage for an example.
// TODO maybe the observe property code should be here?
export function get_video_dimensions() {
  if (!dimensions_changed) return _video_dimensions;

  // this function is very much ripped from video/out/aspect.c in mpv's source
  const video_params = mp.get_property_native(
    "video-out-params"
  ) as MP.Prop.VideoParams;
  if (!video_params) return;

  dimensions_changed = false;
  const keep_aspect = mp.get_property_bool("keepaspect");
  let { w, h, dw, dh } = video_params;
  if (mp.get_property_number("video-rotate", 0) % 180 === 90) {
    [w, h] = [h, w];
    [dw, dh] = [dh, dw];
  }

  _video_dimensions = {
    top_left: { x: -1, y: -1 },
    bottom_right: { x: -1, y: -1 },
    ratios: { w: -1, h: -1 },
  };
  const { width: window_w, height: window_h } = mp.get_osd_size()!;

  if (keep_aspect) {
    const unscaled = mp.get_property_native("video-unscaled") as
      | boolean
      | string;
    const panscan = mp.get_property_number("panscan", 0);

    let fwidth = window_w;
    let fheight = Math.floor((window_w / dw) * dh);
    if (fheight > window_h || fheight < h) {
      const tmpw = Math.floor((window_h / dh) * dw);
      if (tmpw <= window_w) {
        fheight = window_h;
        fwidth = tmpw;
      }
    }
    let vo_panscan_area = window_h - fheight;
    let f_w = fwidth / fheight;
    let f_h = 1;
    if (vo_panscan_area === 0) {
      vo_panscan_area = window_h - fwidth;
      f_w = 1;
      f_h = fheight / fwidth;
    }

    if (unscaled || unscaled === "downscale-big") {
      vo_panscan_area = 0;
      if (unscaled || (dw <= window_w && dh <= window_h)) {
        fwidth = dw;
        fheight = dh;
      }
    }

    const scaled_width = fwidth + Math.floor(vo_panscan_area * panscan * f_w);
    const scaled_height = fheight + Math.floor(vo_panscan_area * panscan * f_h);

    const split_scaling = (
      dst_size: number,
      scaled_src_size: number,
      zoom: number,
      align: number,
      pan: number
    ) => {
      scaled_src_size = Math.floor(scaled_src_size * 2 ** zoom);
      align = (align + 1) / 2;
      let dst_start = Math.floor(
        (dst_size - scaled_src_size) * align + pan * scaled_src_size
      );
      if (dst_start < 0) {
        // account for C int cast truncating as opposed to flooring
        dst_start = dst_start + 1;
      }
      let dst_end = dst_start + scaled_src_size;
      if (dst_start >= dst_end) {
        dst_start = 0;
        dst_end = 1;
      }
      return [dst_start, dst_end];
    };

    const zoom = mp.get_property_number("video-zoom", 0);

    const align_x = mp.get_property_number("video-align-x", 0);
    const pan_x = mp.get_property_number("video-pan-x", 0);
    [_video_dimensions.top_left.x, _video_dimensions.bottom_right.x] =
      split_scaling(window_w, scaled_width, zoom, align_x, pan_x);

    const align_y = mp.get_property_number("video-align-y", 0);
    const pan_y = mp.get_property_number("video-pan-y", 0);
    [_video_dimensions.top_left.y, _video_dimensions.bottom_right.y] =
      split_scaling(window_h, scaled_height, zoom, align_y, pan_y);
  } else {
    _video_dimensions.top_left.x = 0;
    _video_dimensions.bottom_right.x = window_w;
    _video_dimensions.top_left.y = 0;
    _video_dimensions.bottom_right.y = window_h;
  }

  _video_dimensions.ratios.w =
    w / (_video_dimensions.bottom_right.x - _video_dimensions.top_left.x);
  _video_dimensions.ratios.h =
    h / (_video_dimensions.bottom_right.y - _video_dimensions.top_left.y);
  return _video_dimensions;
}

function set_dimensions_changed() {
  dimensions_changed = true;
}

export function trackDimensions() {
  // Monitor these properties, as they affect the video dimensions.
  // Set the dimensions-changed flag when they change.
  const properties = [
    "keepaspect",
    "video-out-params",
    "video-unscaled",
    "panscan",
    "video-zoom",
    "video-align-x",
    "video-pan-x",
    "video-align-y",
    "video-pan-y",
    "osd-width",
    "osd-height",
  ];
  for (const p of properties) {
    mp.observe_property(p, "native", set_dimensions_changed);
  }
}

function clamp(min: number, val: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

function clamp_point(top_left: Point, point: Point, bottom_right: Point) {
  return {
    x: clamp(top_left.x, point.x, bottom_right.x),
    y: clamp(top_left.y, point.y, bottom_right.y),
  };
}

// Stores a point in the video, relative to the source resolution.
export class VideoPoint implements Point {
  public x = -1;
  public y = -1;

  set_from_screen(sx: number, sy: number) {
    const d = get_video_dimensions()!;
    const point = clamp_point(d.top_left, { x: sx, y: sy }, d.bottom_right);
    this.x = Math.floor(d.ratios.w * (point.x - d.top_left.x) + 0.5);
    this.y = Math.floor(d.ratios.h * (point.y - d.top_left.y) + 0.5);
  }

  to_screen() {
    const d = get_video_dimensions()!;
    return {
      x: Math.floor(this.x / d.ratios.w + d.top_left.x + 0.5),
      y: Math.floor(this.y / d.ratios.h + d.top_left.y + 0.5),
    };
  }
}

// Stores a video region. Used with VideoPoint to translate between screen and source coordinates. See CropPage.
export class Region {
  public x = -1;
  public y = -1;
  public w = -1;
  public h = -1;

  is_valid() {
    return this.x > -1 && this.y > -1 && this.w > -1 && this.h > -1;
  }

  set_from_points(p1: Point, p2: Point) {
    this.x = Math.min(p1.x, p2.x);
    this.y = Math.min(p1.y, p2.y);
    this.w = Math.abs(p1.x - p2.x);
    this.h = Math.abs(p1.y - p2.y);
  }
}

// function make_fullscreen_region() {
//   const r = new Region();
//   const d = get_video_dimensions()!;
//   const a = new VideoPoint();
//   const b = new VideoPoint();
//   const { x: xa, y: ya } = d.top_left;
//   a.set_from_screen(xa, ya);
//   const { x: xb, y: yb } = d.bottom_right;
//   b.set_from_screen(xb, yb);
//   r.set_from_points(a, b);
//   return r;
// }
