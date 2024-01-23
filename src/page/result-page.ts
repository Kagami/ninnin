import type { MP } from "mpv.d.ts";

import Page from "./page";
import Ass from "../lib/ass";
import { isCancelled } from "../encode/mpv";
import { getErrMsg } from "../utils";

export default class ResultPage extends Page {
  constructor(
    private encodeErr: unknown /** falsy=success, truthy=cancelled/error */,
    private outPath: string,
    private _gotoOptionsCb: () => void
  ) {
    super();
    this.keybinds = {
      p: this.preview.bind(this),
      v: this.calcVMAF.bind(this),
      o: this.gotoOptions.bind(this),
      ESC: this.hide.bind(this),
    };
  }

  private getEncodeResult() {
    if (this.encodeErr) {
      return isCancelled(this.encodeErr)
        ? "encode cancelled"
        : "encode failed: " + getErrMsg(this.encodeErr);
    } else {
      return "encode success";
    }
  }

  draw() {
    const s = mp.get_osd_size()!;
    const ass = new Ass();
    ass.new_event();
    this.setup_text(ass);
    ass.append_2nl(`${ass.B(this.getEncodeResult())}`);
    if (!this.encodeErr) {
      // FIXME: show size, duration
      ass.append_nl(`output: ${this.outPath}`);
      ass.append_nl();
      ass.append_nl(`${ass.B("p:")} preview`);
      ass.append_nl(`${ass.B("v:")} calculate VMAF`);
    }
    ass.append_nl(`${ass.B("o:")} back to options`);
    ass.append_nl(`${ass.B("ESC:")} close`);
    mp.set_osd_ass(s.width, s.height, ass.text);
  }

  private preview() {
    mp.command_native({
      name: "subprocess",
      args: ["mpv", "--no-terminal", this.outPath],
      playback_only: false,
    } as MP.Cmd.SubprocessArgs);
  }

  private calcVMAF() {}

  private gotoOptions() {
    this.hide();
    this._gotoOptionsCb();
  }
}
