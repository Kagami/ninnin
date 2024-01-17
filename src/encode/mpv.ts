import { remove_file } from "../os";

export class MPVEncode {
  private logPath: string;
  private asyncID = 0;
  private waitPromise: Promise<void>;

  constructor(args: string[], outPath: string) {
    args = args.slice();
    const [dir, fname] = mp.utils.split_path(outPath);
    const logName = `.ninnin-${fname}.log`;
    this.logPath = mp.utils.join_path(dir, logName);
    args.push("--log-file=" + this.logPath);
    // FIXME: really hackish way to dump current encoding position.
    // Also probably won't work with other demuxers:
    // https://github.com/mpv-player/mpv/blob/22e21ed/demux/demux.c#L77
    // But I don't know better way since logging of --term-status was removed, see:
    // https://github.com/mpv-player/mpv/issues/13038
    args.push("--msg-level=lavf=trace");

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

  private parsePts(data: string) {
    // FIXME: video/audio tracks might be at different position, so have to read the same one.
    // Will need to fix this for audio-only encodes.
    const packetIdx = data.lastIndexOf("[t][lavf] append packet to video:");
    if (packetIdx === -1) return -1;
    const ptsIdx = data.indexOf("pts=", packetIdx);
    if (ptsIdx === -1) return -1;
    const spaceIdx = data.indexOf(" ", ptsIdx);
    if (spaceIdx === -1) return -1;
    if (spaceIdx - ptsIdx > 30) return -1; // ignore badly matched
    const pts = data.slice(ptsIdx + 4, spaceIdx);
    // console.log("@@@ parsed pts", pts, packetIdx, ptsIdx, spaceIdx);
    return +pts;
  }

  // encoding progress (0-100, -1 if error/unknown)
  progress(startTime: number, endTime: number) {
    let data = "";
    try {
      // FIXME: we have to read the full file every time, not very effecient,
      // especially if log is big.
      data = mp.utils.read_file(this.logPath);
    } catch (e) {
      return -1;
    }
    if (!data) return -1;
    const pts = this.parsePts(data);
    if (pts < startTime) return 0;
    if (pts > endTime) return 100;
    const progress = (pts - startTime) / (endTime - startTime);
    return progress * 100;
  }

  wait() {
    return this.waitPromise;
  }

  abort() {
    if (this.asyncID) {
      mp.abort_async_command(this.asyncID);
    }
    this.asyncID = 0;
  }
}
