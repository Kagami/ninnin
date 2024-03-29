import type { MP } from "mpv.d.ts";

import { Region, VideoPoint, get_video_dimensions } from "../video-to-screen";
import Page from "./page";
import Ass from "../lib/ass";

export default class CropPage extends Page {
  private pointA: VideoPoint;
  private pointB: VideoPoint;

  constructor(private callback: (r?: Region) => void, region: Region) {
    super();
    this.pointA = new VideoPoint();
    this.pointB = new VideoPoint();
    this.keybinds = {
      "1": this.setPointA.bind(this),
      "2": this.setPointB.bind(this),
      r: this.reset.bind(this),
      ESC: this.cancel.bind(this),
      ENTER: this.finish.bind(this),
    };
    this.reset();
    // If we have a region, set point A and B from it
    if (region && region.is_valid()) {
      this.pointA.x = region.x;
      this.pointA.y = region.y;
      this.pointB.x = region.x + region.w;
      this.pointB.y = region.y + region.h;
    }
  }

  reset() {
    const dimensions = get_video_dimensions()!;
    const { x: xa, y: ya } = dimensions.top_left;
    this.pointA.set_from_screen(xa, ya);
    const { x: xb, y: yb } = dimensions.bottom_right;
    this.pointB.set_from_screen(xb, yb);

    if (this.visible) {
      this.draw();
    }
  }

  setPointA() {
    const { x: posX, y: posY } = mp.get_property_native(
      "mouse-pos"
    ) as MP.Prop.MousePos;
    this.pointA.set_from_screen(posX, posY);
    if (this.visible) {
      // No need to clear, as we draw the entire OSD (also it causes flickering)
      this.draw();
    }
  }

  setPointB() {
    const { x: posX, y: posY } = mp.get_property_native(
      "mouse-pos"
    ) as MP.Prop.MousePos;
    this.pointB.set_from_screen(posX, posY);
    if (this.visible) {
      this.draw();
    }
  }

  cancel() {
    this.hide();
    this.callback(undefined);
  }

  finish() {
    const region = new Region();
    region.set_from_points(this.pointA, this.pointB);
    this.hide();
    this.callback(region);
  }

  draw_box(ass: Ass) {
    const region = new Region();
    region.set_from_points(this.pointA.to_screen(), this.pointB.to_screen());

    const d = get_video_dimensions()!;
    ass.new_event();
    ass.append("{\\an7}");
    ass.pos(0, 0);
    ass.append("{\\bord0}");
    ass.append("{\\shad0}");
    ass.append("{\\c&H000000&}");
    ass.append("{\\alpha&H77}");
    // Draw a black layer over the uncropped area
    ass.draw_start();
    ass.rect_cw(d.top_left.x, d.top_left.y, region.x, region.y + region.h); // Top left uncropped area
    ass.rect_cw(region.x, d.top_left.y, d.bottom_right.x, region.y); // Top right uncropped area
    ass.rect_cw(
      d.top_left.x,
      region.y + region.h,
      region.x + region.w,
      d.bottom_right.y
    ); // Bottom left uncropped area
    ass.rect_cw(
      region.x + region.w,
      region.y,
      d.bottom_right.x,
      d.bottom_right.y
    ); // Bottom right uncropped area
    ass.draw_stop();
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const width = Math.abs(this.pointA.x - this.pointB.x);
    const height = Math.abs(this.pointA.y - this.pointB.y);

    const ass = new Ass();
    this.draw_box(ass);
    ass.new_event();
    this.setup_text(ass);
    // prettier-ignore
    {
    ass.append_nl(`${ass.bold('Crop:')}`);
    ass.append_nl(`${ass.bold('1:')} change point A (${this.pointA.x}, ${this.pointA.y})`);
    ass.append_nl(`${ass.bold('2:')} change point B (${this.pointB.x}, ${this.pointB.y})`);
    ass.append_nl(`${ass.bold('r:')} reset to whole screen`);
    ass.append_nl(`${ass.bold('ESC:')} cancel crop`);
    ass.append_nl(`${ass.bold('ENTER:')} confirm crop (${width}x${height})`);
    }
    mp.set_osd_ass(window_w, window_h, ass.text);
  }
}
