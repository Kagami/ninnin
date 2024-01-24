import Ass from "../lib/ass";
import Page from "../page/page";
import { getCurrentFormat } from "./formats";
import { type Region } from "../video-to-screen";
import { type Cmd, buildCommand } from "./cmd";
import { remove_file } from "../lib/os";
import { MPVEncode } from "./mpv";
import { showTime } from "../pretty";

// Not really a Page, but reusing its functions is pretty useful
export default class EncodeWithProgress extends Page {
  private outPath = "";
  private pass = 0;
  private mpv?: MPVEncode;
  private lastStatus = "";

  constructor(private startTime: number, private endTime: number) {
    super();
    this.keybinds = {
      ESC: this.cancel.bind(this),
    };
  }

  private getStatus() {
    if (!this.mpv) return this.lastStatus;
    const stats = this.mpv.getStats();
    if (!stats) return this.lastStatus;

    let { timePos } = stats;
    timePos -= this.startTime;
    const duration = this.endTime - this.startTime;

    let progress = Math.floor((timePos / duration) * 100);
    progress = Math.min(100, Math.max(0, progress));

    const pos = showTime(timePos, { ms: false });
    const dur = showTime(duration, { ms: false });
    this.lastStatus = `${pos}/${dur} (${progress}%)`;
    return this.lastStatus;
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new Ass();
    ass.new_event();
    this.setup_text(ass);
    const passInfo = this.pass ? ` pass ${this.pass}` : "";
    const status = this.getStatus() || "N/A";
    ass.append_nl(`Output: ${this.outPath}`);
    ass.append_nl(`Encoding${passInfo}: ${status}`);
    ass.append_nl();
    ass.append_nl(`${ass.bold("ESC:")} cancel encoding`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  async startEncode(pass: number, args: string[], outPath: string) {
    this.pass = pass;
    this.outPath = outPath;
    this.mpv = new MPVEncode(args, outPath);
    this.show();
    const drawTimer = setInterval(this.draw.bind(this), 500);

    try {
      await this.mpv.wait();
    } catch (err) {
      throw err;
    } finally {
      clearInterval(drawTimer);
      this.mpv = undefined;
      this.lastStatus = "";
      this.hide();
    }
  }

  cancel() {
    if (this.mpv) {
      this.mpv.cancel();
    }
  }
}

async function encodeInner({
  startTime,
  endTime,
  // pipeArgs,
  args,
  pass1Args,
  outPath,
}: Cmd) {
  const ewp = new EncodeWithProgress(startTime, endTime);
  let pass = 0; // single pass

  if (pass1Args) {
    pass = 1; // first pass
    await ewp.startEncode(pass, pass1Args, outPath);
    pass = 2; // second pass
  }

  await ewp.startEncode(pass, args, outPath);
}

export async function doEncode(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const format = getCurrentFormat();
  const cmd = buildCommand(format, region, origStartTime, origEndTime);

  try {
    await encodeInner(cmd);
  } finally {
    // FIXME: cleanup on player quit?
    // Clean up pass log files.
    if (cmd.pass1Args) {
      for (const fpath of format.getPassFilePaths(cmd.outPath)) {
        remove_file(fpath, { silentErrors: true });
      }
    }
    // Clean up dumped stream cache.
    if (cmd.isLive) {
      remove_file(cmd.livePath);
    }
  }
}
