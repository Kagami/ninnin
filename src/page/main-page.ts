import options from "../options";
import Page from "./page";
import CropPage from "./crop-page";
import PreviewPage from "./preview-page";
import EncodeOptionsPage from "./options-page";
import { getMetadataTitle, getOutPath } from "../encode/cmd";
import { doEncode } from "../encode/encode";
import { Region } from "../video-to-screen";
import { message } from "../utils";
import { showTime } from "../pretty";
import Ass from "../lib/ass";
import ResultPage from "./result-page";
import { getCurrentFormat } from "../encode/formats";

export default class MainPage extends Page {
  private startTime = -1;
  private endTime = -1;
  private outPath = "";
  private region: Region;

  constructor() {
    super();
    this.keybinds = {
      c: this.crop.bind(this),
      "1": this.setStartTime.bind(this),
      "2": this.setEndTime.bind(this),
      "!": this.jumpToStartTime.bind(this),
      "@": this.jumpToEndTime.bind(this),
      o: this.gotoOptions.bind(this),
      p: this.preview.bind(this),
      e: this.encode.bind(this),
      ESC: this.hide.bind(this),
    };
    this.region = new Region();
  }

  setStartTime() {
    this.startTime = mp.get_property_number("time-pos", 0);
    this.updateOutPath();
    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  setEndTime() {
    this.endTime = mp.get_property_number("time-pos", 0);
    this.updateOutPath();
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

  updateStartEnd() {
    const duration = mp.get_property_number("duration", 0);
    if (duration) {
      // Note: there exists an option called rebase-start-time, which, when set to no,
      // could cause the beginning of the video to not be at 0. Not sure how this
      // would affect this code.
      this.startTime = 0;
      this.endTime = duration;
      this.updateOutPath();
    } else {
      this.startTime = -1;
      this.endTime = -1;
    }

    if (this.visible) {
      this.clear();
      this.draw();
    }
  }

  private updateOutPath() {
    this.outPath = getOutPath(getCurrentFormat(), this.startTime, this.endTime);
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new Ass();
    ass.new_event();
    this.setup_text(ass);
    const title = getMetadataTitle();
    // prettier-ignore
    {
      ass.append_2nl(`${ass.bold('ninnin encoder')}`);
      ass.append_nl(`output: ${this.outPath}`);
      if (options.write_metadata_title && title) {
        ass.append_nl(`title: ${title}`);
      }
      ass.append_nl();
      ass.append_nl(`${ass.bold('1:')} set start time (current ${showTime(this.startTime)})`);
      ass.append_nl(`${ass.bold('2:')} set end time (current ${showTime(this.endTime)})`);
      ass.append_nl(`${ass.bold('o:')} options`);
      // ass.append_nl(`${ass.bold('!:')} jump to start time`);
      // ass.append_nl(`${ass.bold('@:')} jump to end time`);
      ass.append_nl(`${ass.bold('c:')} crop`);
      ass.append_nl(`${ass.bold('p:')} preview`);
      ass.append_2nl(`${ass.bold('e:')} encode`);
      ass.append_nl(`${ass.bold('ESC:')} close`);
    }
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  show() {
    super.show();
    // emit_event("show-main-page");
  }

  onNewCrop(newRegion?: Region) {
    if (newRegion) {
      this.region = newRegion;
    }
    this.show();
  }

  crop() {
    this.hide();
    const cropPage = new CropPage(this.onNewCrop.bind(this), this.region);
    cropPage.show();
  }

  onNewOptions() {
    this.show();
  }

  gotoOptions() {
    this.hide();
    const encodeOptsPage = new EncodeOptionsPage(this.onNewOptions.bind(this));
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

  async encode() {
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

    try {
      // emit_event("encode-started");
      await doEncode(this.region, this.startTime, this.endTime);
      // emit_event("encode-finished", "success");
    } catch (err) {
      // emit_event("encode-finished", "fail");
      mp.msg.error(err);
      this.onEncodeEnded(err);
      return;
    }
    this.onEncodeEnded();
  }

  onEncodeEnded(err?: unknown) {
    this.hide();
    const resultPage = new ResultPage(
      err,
      this.outPath,
      this.gotoOptions.bind(this)
    );
    resultPage.show();
  }
}
