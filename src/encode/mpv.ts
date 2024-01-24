import type { MP } from "mpv.d.ts";

import type { Stats } from "./script";
import { escapeArgs, getShellArgs, remove_file } from "../lib/os";

const CANCEL_MSG = "ninnin-cancel";

export function isCancelled(err: unknown) {
  return err ? (err as Error).message === CANCEL_MSG : false;
}

export class MPVEncode {
  args: string[];
  private viaShell = false;
  private logPath: string;
  private asyncID: unknown;

  constructor(pipeArgs: string[] | undefined, args: string[], outPath: string) {
    args = args.slice();

    // run ourselves in encoding mode
    const scriptPath = mp.get_script_file();
    args.push("--script=" + scriptPath);
    // log for communication with main script
    // TODO: some better way of IPC?
    const [dir, fname] = mp.utils.split_path(outPath);
    const logName = `.ninnin-${fname}.log`;
    this.logPath = mp.utils.join_path(dir, logName);
    args.push("--script-opts=ninnin-encoding=" + this.logPath);

    // piping needed, so run via the system shell
    if (pipeArgs) {
      args = getShellArgs(pipeArgs.concat("|", args));
      this.viaShell = true;
    }

    this.args = args;
  }

  wait(): Promise<void> {
    this.logCmd();
    return new Promise((resolve, reject) => {
      this.asyncID = mp.command_native_async(
        {
          name: "subprocess",
          args: this.args,
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

  private logCmd() {
    if (this.viaShell) {
      // Don't escape shell args second time for readability.
      // You can use just the part after "sh -c" and it will work.
      mp.msg.info("Command line (shell): " + this.args.join(" "));
    } else {
      mp.msg.info("Command line: " + escapeArgs(this.args));
    }
  }

  private getEnv() {
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

  cancel() {
    if (this.asyncID) {
      mp.abort_async_command(this.asyncID);
    }
    this.asyncID = undefined;
  }
}
