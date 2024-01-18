import AssDraw from "mpv-assdraw";

import Page from "./page";
import CropPage from "./crop-page";
import PreviewPage from "./preview-page";
import EncodeOptionsPage from "./encode-options-page";
import { getMetadataTitle, getOutPath } from "../encode/cmd";
import { doEncode } from "../encode/encode";
import { Region } from "../video-to-screen";
import { bold, message, seconds_to_time_string } from "../utils";
import options from "../options";

export default class MainPage extends Page {
  private startTime = -1;
  private endTime = -1;
  private region: Region;

  constructor() {
    super();
    this.keybinds = {
      c: this.crop.bind(this),
      "1": this.setStartTime.bind(this),
      "2": this.setEndTime.bind(this),
      "!": this.jumpToStartTime.bind(this),
      "@": this.jumpToEndTime.bind(this),
      o: this.changeOptions.bind(this),
      p: this.preview.bind(this),
      e: this.encode.bind(this),
      ESC: this.hide.bind(this),
    };
    this.region = new Region();
  }

  setStartTime() {
    this.startTime = mp.get_property_number("time-pos", 0);
    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  setEndTime() {
    this.endTime = mp.get_property_number("time-pos", 0);
    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  jumpToStartTime() {
    mp.set_property_number("time-pos", this.startTime);
  }

  jumpToEndTime() {
    mp.set_property_number("time-pos", this.endTime);
  }

  setupStartAndEndTimes() {
    if (mp.get_property_native("duration")) {
      // Note: there exists an option called rebase-start-time, which, when set to no,
      // could cause the beginning of the video to not be at 0. Not sure how this
      // would affect this code.
      this.startTime = 0;
      this.endTime = mp.get_property_number("duration", 0);
    } else {
      this.startTime = -1;
      this.endTime = -1;
    }

    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    const outPath = getOutPath(this.startTime, this.endTime);
    const title = getMetadataTitle();
    // prettier-ignore
    {
      ass.append(`${bold('ninnin encoder')}\\N\\N`);
      ass.append(`output: ${outPath}\\N`);
      if (options.write_metadata_title && title) {
        ass.append(`title: ${title}\\N`);
      }
      ass.append(`${bold('o:')} change encode options\\N`);
      ass.append(`${bold('1:')} set start time (current is ${seconds_to_time_string(this.startTime)})\\N`);
      ass.append(`${bold('2:')} set end time (current is ${seconds_to_time_string(this.endTime)})\\N`);
      // ass.append(`${bold('!:')} jump to start time\\N`);
      // ass.append(`${bold('@:')} jump to end time\\N`);
      ass.append(`${bold('c:')} crop\\N`);
      ass.append(`${bold('p:')} preview\\N`);
      ass.append(`${bold('e:')} encode\\N\\N`);
      ass.append(`${bold('ESC:')} close\\N`);
    }
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  show() {
    super.show();

    // emit_event("show-main-page");
  }

  // FIXME: remove updated prop
  onUpdateCropRegion(updated: boolean, newRegion: Region | null) {
    if (updated && newRegion) {
      this.region = newRegion;
    }
    this.show();
  }

  crop() {
    this.hide();
    const cropPage = new CropPage(
      this.onUpdateCropRegion.bind(this),
      this.region
    );
    cropPage.show();
  }

  onOptionsChanged(_updated: boolean) {
    this.show();
  }

  changeOptions() {
    this.hide();
    const encodeOptsPage = new EncodeOptionsPage(
      this.onOptionsChanged.bind(this)
    );
    encodeOptsPage.show();
  }

  onPreviewEnded() {
    this.show();
  }

  preview() {
    this.hide();
    const previewPage = new PreviewPage(
      this.onPreviewEnded.bind(this),
      this.region,
      this.startTime,
      this.endTime
    );
    previewPage.show();
  }

  encode() {
    this.hide();
    if (this.startTime < 0) {
      message("No start time, aborting");
      return;
    }
    if (this.endTime < 0) {
      message("No end time, aborting");
      return;
    }
    if (this.startTime >= this.endTime) {
      message("Start time is ahead of end time, aborting");
      return;
    }
    doEncode(this.region, this.startTime, this.endTime);
  }
}
