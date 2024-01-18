import AssDraw from "mpv-assdraw";

import Page from "../page/page";
import { bold, get_pass_logfile_path, message, run_subprocess } from "../utils";
import options from "../options";
import { type Format, getCurrentFormat } from "../formats";
import { type Region } from "../video-to-screen";
import { buildCommand } from "./cmd";
import { remove_file } from "../os";
import { MPVEncode } from "./mpv";

// Not really a Page, but reusing its functions is pretty useful
export default class EncodeWithProgress extends Page {
  private startTime: number;
  private endTime: number;
  private mpv?: MPVEncode;
  private lastProgress = 0;

  constructor(startTime: number, endTime: number) {
    super();
    this.startTime = startTime;
    this.endTime = endTime;
  }

  private progress() {
    let progress = this.lastProgress;
    if (this.mpv) {
      const p = this.mpv.progress(this.startTime, this.endTime);
      // ignore bad/unknown progress, keep last value
      // FIXME: we can receive lower progress than before if read file during the write(?).
      if (p >= 0 && p > this.lastProgress) {
        progress = this.lastProgress = Math.floor(p);
      }
    }
    return progress + "%";
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    ass.append(`Encoding (${bold(this.progress())})\\N`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  async startEncode(args: string[], outPath: string) {
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

  // NOTE: mpv-webm doesn't do two pass for streams, but seems like it should work just fine?
  // In case of local file: works
  // In case of youtube URL: works
  // In case of HLS live stream: we dump it to a temporary file, so it works
  const format = getCurrentFormat();
  if (shouldTwoPass(format)) {
    const first_pass_cmdline = args.slice();
    first_pass_cmdline.push("--ovcopts-add=flags=+pass1");
    message("Starting first pass...");
    // FIXME: progress
    mp.msg.info("1pass command line:", first_pass_cmdline.join(" "));
    const res = run_subprocess({
      name: "subprocess",
      args: first_pass_cmdline,
      playback_only: false,
    });
    if (!res) {
      message("First pass failed! Check the logs for details.");
      // emit_event("encode-finished", "fail");
      return;
    }

    // set the second pass flag on the final encode command
    args.push("--ovcopts-add=flags=+pass2");

    // if (format.videoCodec === "libvpx") {
    //   // We need to patch the pass log file before running the second pass.
    //   mp.msg.verbose("Patching libvpx pass log file...");
    //   vp8_patch_logfile(get_pass_logfile_path(out_path), endTime - startTime);
    // }
  }

  // command = format.postCommandModifier(command, region, startTime, endTime)

  const ewp = new EncodeWithProgress(startTime, endTime);
  try {
    await ewp.startEncode(args, outPath);
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
