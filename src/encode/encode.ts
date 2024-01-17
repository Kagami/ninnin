import AssDraw from "mpv-assdraw";

import Page from "../page/page";
import {
  bold,
  get_pass_logfile_path,
  message,
  run_subprocess,
  run_subprocess_popen,
} from "../utils";
import options from "../options";
import { type Format, getCurrentFormat } from "../formats";
import { type Region } from "../video-to-screen";
import { buildCommand } from "./cmd";
import { remove_file } from "../os";

// Not really a Page, but reusing its functions is pretty useful
export default class EncodeWithProgress extends Page {
  private startTime: number;
  // private endTime: number;
  private duration: number;
  private currentTime: number;
  // private finished = false;
  private finishedReason = "";

  constructor(startTime: number, endTime: number) {
    super();
    this.startTime = startTime;
    // this.endTime = endTime;
    this.duration = endTime - startTime;
    this.currentTime = startTime;
  }

  draw() {
    const progress =
      100 * ((this.currentTime - this.startTime) / this.duration);
    const progressText = progress + "%";
    const { width: window_w, height: window_h } = mp.get_osd_size();
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    ass.append(`Encoding (${bold(progressText)})\\N`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }

  parseLine(line: string) {
    const matchTime = line.match(/Encode time[-]pos: ([0-9.]+)/);
    const matchExit = line.match(/Exiting... [(]([%a ]+)[)]/);
    if (!matchTime && !matchExit) return;

    if (matchTime && +matchTime[1] > this.currentTime) {
      // sometimes we get timestamps older than before...
      this.currentTime = +matchTime[1];
    }
    if (matchExit) {
      // this.finished = true;
      this.finishedReason = matchExit[1];
    }
  }

  startEncode(command_line: string[]) {
    command_line = command_line.slice();
    command_line.push("--term-status-msg=Encode time-pos: ${=time-pos}\\n");
    this.show();
    const processFd = run_subprocess_popen(command_line);
    for (const line of processFd.lines()) {
      // FIXME: port %q
      // mp.msg.verbose(string.format("%q", line));
      this.parseLine(line);
      this.draw();
    }
    processFd.close();
    this.hide();

    // This is what we want
    if (this.finishedReason === "End of file") {
      return true;
    }
    return false;
  }
}

function shouldTwoPass(format: Format) {
  if (options.target_filesize) return format.twoPassSupported;
  return format.twoPassPreferable;
}

export function doEncode(
  region: Region,
  origStartTime: number,
  origEndTime: number
) {
  const cmdRes = buildCommand(region, origStartTime, origEndTime);
  if (!cmdRes) return;
  const { command, isLive, livePath, outPath, startTime, endTime } = cmdRes;

  // emit_event("encode-started");

  // NOTE: mpv-webm doesn't do two pass for streams, but seems like it should work just fine?
  // In case of local file: works
  // In case of youtube URL: works
  // In case of HLS live stream: we dump it to a temporary file, so it works
  const format = getCurrentFormat();
  if (shouldTwoPass(format)) {
    // copy the commandline
    const first_pass_cmdline = command.slice();
    first_pass_cmdline.push("--ovcopts-add=flags=+pass1");
    message("Starting first pass...");
    mp.msg.verbose("First-pass command line: ", first_pass_cmdline.join(" "));
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
    command.push("--ovcopts-add=flags=+pass2");

    // if (format.videoCodec === "libvpx") {
    //   // We need to patch the pass log file before running the second pass.
    //   mp.msg.verbose("Patching libvpx pass log file...");
    //   vp8_patch_logfile(get_pass_logfile_path(out_path), endTime - startTime);
    // }
  }

  // command = format.postCommandModifier(command, region, startTime, endTime)

  mp.msg.info("Encoding to", outPath);
  mp.msg.info("Command line:", command.join(" "));

  let res = false;
  // FIXME: always show progress for all platforms
  if (true) {
    message("Started encode...");
    res = run_subprocess({
      name: "subprocess",
      args: command,
      playback_only: false,
    });
  } else {
    const ewp = new EncodeWithProgress(startTime, endTime);
    res = ewp.startEncode(command);
  }
  if (res) {
    message("Encoded successfully!");
    // emit_event("encode-finished", "success");
  } else {
    message("Encode failed! Check the logs for details.");
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
