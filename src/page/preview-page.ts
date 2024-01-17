import AssDraw from "mpv-assdraw";

import { ObjectEntries } from "../lib/helpers";
import { bold } from "../utils";
import type { Region } from "../video-to-screen";
import Page from "./page";

export default class PreviewPage extends Page {
  private callback: () => void;
  private origProps: { [key: string]: any };
  private region: Region;
  private startTime: number;
  private endTime: number;
  // private isLoop: boolean;

  constructor(
    callback: () => void,
    region: Region,
    startTime: number,
    endTime: number
  ) {
    super();

    this.callback = callback;
    this.origProps = {
      vf: mp.get_property_native("vf"),
      "time-pos": mp.get_property_native("time-pos"),
      pause: mp.get_property_native("pause"),
    };

    this.keybinds = {
      ESC: this.cancel.bind(this),
    };

    this.region = region;
    this.startTime = startTime;
    this.endTime = endTime;
    // this.isLoop = false;
  }

  prepare() {
    const vf = mp.get_property_native("vf");
    // Place sub rendering before crop in the filter chain.
    vf.push({ name: "sub" });
    if (this.region.is_valid()) {
      vf.push({
        name: "crop",
        params: {
          w: this.region.w + "",
          h: this.region.h + "",
          x: this.region.x + "",
          y: this.region.y + "",
        },
      });
    }

    mp.set_property_native("vf", vf);
    if (this.startTime > -1 && this.endTime > -1) {
      mp.set_property_native("ab-loop-a", this.startTime);
      mp.set_property_native("ab-loop-b", this.endTime);
      mp.set_property_native("time-pos", this.startTime);
    }
    mp.set_property_native("pause", false);
  }

  dispose() {
    mp.set_property("ab-loop-a", "no");
    mp.set_property("ab-loop-b", "no");

    // restore original properties
    for (const [prop, value] of ObjectEntries(this.origProps)) {
      mp.set_property_native(prop, value);
    }
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size();
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    ass.append(`Press ${bold("ESC")} to exit preview.\\N`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  cancel() {
    this.hide();
    this.callback();
  }
}
