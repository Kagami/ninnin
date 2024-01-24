/** Build command for calculating VMAF. */

import { nproc } from "../lib/os";
import { type Region } from "../video-to-screen";
import { type Cmd, buildCommand, getOutPath } from "./cmd";
import { Format, getCurrentFormat } from "./formats";

/** Special format for calculating VMAF. */
class RawPipe extends Format {
  videoCodec = "rawvideo";
  outputExtension = "-";
  twoPassSupported = false;
  metadataSupported = false;

  getMuxerFlags() {
    // XXX: in case of yuv4mpegpipe and matroska VMAF filter is broken for some reason.
    // Probably timestamp issues.
    return ["--of=nut"];
  }
}

const rawPipe = new RawPipe();

// VMAF command = like normal command but encode to NUT/rawvideo and pipe to VMAF filter.
// It seems almost impossible to do without pipe because of seeking and complicated filter graph.
export function buildVmafCommand(
  region: Region,
  origStartTime: number,
  origEndTime: number
): Cmd {
  const cmd = buildCommand(rawPipe, region, origStartTime, origEndTime);
  cmd.outPath = getOutPath(getCurrentFormat(), origStartTime, origEndTime);
  cmd.pipeArgs = cmd.args;
  cmd.args = [
    "mpv",
    cmd.outPath, // path we've just encoded to (distorted)
    "--external-file=-", // rawvideo from stdin (reference)
    "--msg-level=all=no,ffmpeg=v", // resulting VMAF score in stderr
    `--lavfi-complex=[vid1][vid2]libvmaf=pool=harmonic_mean:n_threads=${nproc()}[vo]`,
    "--of=null",
    "--o=-",
  ];
  return cmd;
}
