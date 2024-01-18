import type { Stats } from "./script";
import { remove_file } from "../os";

export class MPVEncode {
  private logPath: string;
  private asyncID: unknown;
  private waitPromise: Promise<void>;

  constructor(args: string[], outPath: string) {
    args = args.slice();

    // run ourselves in encoding mode
    const scriptPath = mp.get_script_file();
    args.push("--script=" + scriptPath);

    const [dir, fname] = mp.utils.split_path(outPath);
    const logName = `.ninnin-${fname}.log`;
    this.logPath = mp.utils.join_path(dir, logName);
    args.push("--script-opts=ninnin-encoding=" + this.logPath);

    mp.msg.info("Command line:", args.join(" "));

    this.waitPromise = new Promise((resolve, reject) => {
      this.asyncID = mp.command_native_async(
        { name: "subprocess", args, playback_only: false },
        (success, _result, error) => {
          remove_file(this.logPath);
          // mp.msg.info("@@@ subprocess", JSON.stringify([success, result, error]));
          if (!success) return reject(new Error(error));
          resolve();
        }
      );
    });
  }

  /**
   * Current encoding stats, undefined if error/unknown.
   * See ./script module for more info.
   */
  getStats(): Stats | undefined {
    try {
      const data = mp.utils.read_file(this.logPath);
      return JSON.parse(data);
    } catch (e) {
      return;
    }
  }

  wait() {
    return this.waitPromise;
  }

  abort() {
    if (this.asyncID) {
      mp.abort_async_command(this.asyncID);
    }
    this.asyncID = null;
  }
}
