import type Ass from "../lib/ass";
import { remove_file } from "../lib/os";
import Page from "../page/page";
import { type Format, getCurrentFormat } from "../cmd/formats";
import { type Region } from "../video-to-screen";
import { type Cmd, buildCommand, buildVmafCommand } from "../cmd/cmd";
import { MPVEncode } from "./mpv";
import { showTime } from "../cmd/pretty";

// Not really a Page, but reusing its functions is pretty useful
export default class EncodeWithProgress extends Page {
  private outPath = "";
  private pass = 0;
  private mpv?: MPVEncode;
  private lastStatus = "";
  private duration: number;

  constructor(
    private vmaf: boolean /** whether we are in VMAF mode */,
    private startTime: number,
    endTime: number
  ) {
    super();
    this.duration = endTime - startTime;
    this.keybinds = {
      ESC: this.cancel.bind(this),
    };
  }

  private getStatus(): string {
    if (!this.mpv) return this.lastStatus;
    const stats = this.mpv.getStats();
    if (!stats) return this.lastStatus;

    let { timePos } = stats;
    if (!this.vmaf) {
      // in VMAF encoding file is already cut from the startTime
      timePos -= this.startTime;
    }

    // FIXME: fix if speed != 1?
    let progress = Math.floor((timePos / this.duration) * 100);
    progress = Math.min(100, Math.max(0, progress));

    const pos = showTime(timePos, { ms: false });
    const dur = showTime(this.duration, { ms: false });
    this.lastStatus = `${pos}/${dur} (${progress}%)`;
    return this.lastStatus;
  }

  draw() {
    const s = mp.get_osd_size()!;
    const ass = this.setup_ass();
    const status = this.getStatus() || "N/A";
    if (this.vmaf) {
      this.drawVmaf(ass, status);
    } else {
      this.drawEnc(ass, status);
    }
    ass.append_nl();
    ass.append_nl(`${ass.B("ESC:")} cancel`);
    mp.set_osd_ass(s.width, s.height, ass.text);
  }
  private drawEnc(ass: Ass, status: string) {
    const passInfo = this.pass ? ` pass ${this.pass}` : "";
    ass.append_nl(`Output: ${this.outPath}`);
    ass.append_nl(`Encoding${passInfo}: ${status}`);
  }
  private drawVmaf(ass: Ass, status: string) {
    ass.append_nl(`VMAF progress: ${status}`);
  }

  async startEncode(
    pass: number,
    pipeArgs: string[] | undefined,
    args: string[],
    outPath: string
  ) {
    this.pass = pass;
    this.outPath = outPath;
    this.mpv = new MPVEncode(pipeArgs, args, outPath);
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

async function multipass({
  pass1Args,
  pipeArgs,
  args,
  outPath,
  startTime,
  endTime,
  vmafLogPath,
}: Cmd) {
  const ewp = new EncodeWithProgress(!!vmafLogPath, startTime, endTime);
  let pass = 0; // single pass

  if (pass1Args) {
    pass = 1; // first pass
    await ewp.startEncode(pass, undefined, pass1Args, outPath);
    pass = 2; // second pass
  }

  await ewp.startEncode(pass, pipeArgs, args, outPath);
}

async function encodeInner(format: Format, cmd: Cmd) {
  try {
    await multipass(cmd);
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

export function encode(
  region: Region,
  origStartTime: number,
  origEndTime: number
): Promise<void> {
  const format = getCurrentFormat();
  const cmd = buildCommand(format, region, origStartTime, origEndTime);
  return encodeInner(format, cmd);
}

export async function calcVMAF(
  region: Region,
  origStartTime: number,
  origEndTime: number
): Promise<number> {
  const format = getCurrentFormat();
  const cmd = buildVmafCommand(format, region, origStartTime, origEndTime);
  try {
    await encodeInner(format, cmd);
    const log = JSON.parse(mp.utils.read_file(cmd.vmafLogPath!));
    return +log.pooled_metrics.vmaf.harmonic_mean;
  } finally {
    remove_file(cmd.vmafLogPath!);
  }
}
