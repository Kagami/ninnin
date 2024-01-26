/** Build command for calculating VMAF. */

import { getHelperPath, nproc } from "../lib/os";
import { ffFilterArg } from "../utils";
import { type Region } from "../video-to-screen";
import { type Cmd, buildCommand, getOutPath } from "./cmd";
import { Format } from "./formats";

/** Special format for calculating VMAF. */
class RawPipe extends Format {
  videoCodec = "rawvideo";
  outputExtension = "-";
  twoPassSupported = false;
  metadataSupported = false;

  getMuxerFlags() {
    // XXX: in case of yuv4mpegpipe and matroska VMAF filter outputs broken
    // score for some reason. Probably timestamp issues.
    return ["--of=nut"];
  }
}

const rawPipe = new RawPipe();

/**
 * VMAF command is like normal command but encode to NUT/rawvideo and pipe to VMAF filter.
 * It seems almost impossible to do without pipe because of seeking and complex filter graph.
 */
export function buildVmafCommand(
  format: Format,
  region: Region,
  origStartTime: number,
  origEndTime: number
): Cmd {
  const cmd = buildCommand(rawPipe, region, origStartTime, origEndTime);
  if (cmd.pass1Args) throw new Error("VMAF calc always single pass");
  cmd.outPath = getOutPath(format, origStartTime, origEndTime);
  cmd.pipeArgs = cmd.args;
  cmd.vmafLogPath = getHelperPath(cmd.outPath, "json");
  const escaped = ffFilterArg(cmd.vmafLogPath);
  cmd.args = [
    "mpv",
    cmd.outPath, // path we've just encoded to (distorted)
    "--msg-level=all=warn",
    "--external-file=-", // rawvideo from stdin (reference)
    `--lavfi-complex=[vid1][vid2]libvmaf=n_threads=${nproc()}:log_path=${escaped}:log_fmt=json[vo]`,
    "--of=null",
    "--o=-",
  ];
  return cmd;
}
