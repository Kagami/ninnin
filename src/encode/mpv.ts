import type { MP } from "mpv.d.ts";

import type { Stats } from "./script";
import { remove_file } from "../lib/os";

const CANCEL_MSG = "ninnin-cancel";

export function isCancelled(err: unknown) {
  return err ? (err as Error).message === CANCEL_MSG : false;
}

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
        {
          name: "subprocess",
          args,
          playback_only: false,
          env: this.getEnv(),
        } as MP.Cmd.SubprocessArgs,
        (success, result, error) => {
          // FIXME: cleanup partial file on error?
          // FIXME: cleanup log on player quit?
          remove_file(this.logPath);
          if (!success) return reject(new Error(error));
          const res = result as MP.Cmd.SubprocessResult;
          if (res.status !== 0) {
            const msg = res.killed_by_us
              ? CANCEL_MSG
              : `${res.error_string} (code ${res.status})`;
            return reject(new Error(msg));
          }
          resolve();
        }
      );
    });
  }

  getEnv() {
    // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/ef1f071/Source/Lib/Common/Codec/EbLog.h#L18
    return mp.utils.get_env_list().concat("SVT_LOG=2");
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

  cancel() {
    if (this.asyncID) {
      mp.abort_async_command(this.asyncID);
    }
    this.asyncID = undefined;
  }
}
