import Ass from "../ass";
import Page from "../page/page";
import { get_pass_logfile_path, message } from "../utils";
import options from "../options";
import { type Format, getCurrentFormat } from "./formats";
import { type Region } from "../video-to-screen";
import { buildCommand } from "./cmd";
import { remove_file } from "../os";
import { MPVEncode } from "./mpv";
import { seconds_to_time_string } from "../pretty";

// Not really a Page, but reusing its functions is pretty useful
export default class EncodeWithProgress extends Page {
  private outPath = "";
  private pass = 0;
  private mpv?: MPVEncode;
  private lastStatus = "";

  constructor(private startTime: number, private endTime: number) {
    super();
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

    const pos = seconds_to_time_string(timePos, true);
    const dur = seconds_to_time_string(duration, true);
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
}

function shouldTwoPass(format: Format) {
  if (options.target_filesize) return format.twoPassSupported;
  return format.twoPassPreferable;
}

export async function doEncode(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const cmdRes = buildCommand(region, origStartTime, origEndTime);
  if (!cmdRes) return;
  const { args, isLive, livePath, outPath, startTime, endTime } = cmdRes;

  // emit_event("encode-started");

  const ewp = new EncodeWithProgress(startTime, endTime);
  const format = getCurrentFormat();
  let pass = 0; // no 2pass

  // NOTE: mpv-webm doesn't do two pass for streams, but seems like it should work just fine?
  // In case of local file: works
  // In case of remote URL: works
  // In case of live stream: we dump it to a temporary file, so it works
  if (shouldTwoPass(format)) {
    pass = 1; // first pass
    const argsPass1 = args.slice();
    argsPass1.push("--ovcopts-add=flags=+pass1");

    try {
      // FIXME: encode 1pass to /dev/null
      await ewp.startEncode(pass, argsPass1, outPath);
    } catch (err) {
      message("Encode failed: " + (err as Error).message);
      mp.msg.error(err);
      // emit_event("encode-finished", "fail");
      return;
    }

    // if (format.videoCodec === "libvpx") {
    //   // We need to patch the pass log file before running the second pass.
    //   mp.msg.verbose("Patching libvpx pass log file...");
    //   vp8_patch_logfile(get_pass_logfile_path(out_path), endTime - startTime);
    // }

    pass = 2; // second pass
    args.push("--ovcopts-add=flags=+pass2");
  }

  // command = format.postCommandModifier(command, region, startTime, endTime)

  try {
    await ewp.startEncode(pass, args, outPath);
    message("Encoded successfully!");
    // emit_event("encode-finished", "success");
  } catch (err) {
    message("Encode failed: " + (err as Error).message);
    mp.msg.error(err);
    // emit_event("encode-finished", "fail");
  }

  // Clean up pass log file.
  if (shouldTwoPass(format)) {
    remove_file(get_pass_logfile_path(outPath));
  }
  // Clean up dumped stream cache.
  if (isLive) {
    remove_file(livePath);
  }
}
