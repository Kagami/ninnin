import AssDraw from "mpv-assdraw";

import Page from "./page/page";
import { bold, run_subprocess_popen } from "./utils";

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
