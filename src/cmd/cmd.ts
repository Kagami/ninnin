/** Building encoding command arguments. */

import options from "../options";
import { type Region } from "../video-to-screen";
import { type Format, rawPipe, rawVideoPipe } from "./formats";
import { getHelperPath, nproc } from "../lib/os";
import { ffFilterArg, isStream } from "../utils";
import { getMetadataTitle, getOutPath, showTime, stripYtTime } from "./pretty";
import { getSupportedTracks, getTrackFlags } from "./tracks";
import { getSpeedFlags, getVideoPPFlags } from "./filters";

// FIXME: remove side-effects from cmd building routine, afterPipe case!
function fixPathTime(startTime: number, endTime: number) {
  const path = mp.get_property("path");
  if (!path) throw new Error("No file is being played");

  let isLive = false;
  let livePath = path;

  /*if (isStream()) {
    if (mp.get_property("file-format") === "hls") {
      // FIXME: does it work?
      // FIXME: doesn't need in case of HLS VOD?
      // Attempt to dump the stream cache into a temporary file
      livePath = mp.utils.join_path(parse_directory("~"), ".ninnin-live-dump.ts");
      mp.command_native([
        "dump_cache",
        seconds_to_time_string(startTime, false, true),
        seconds_to_time_string(endTime + 5, false, true),
        path,
      ]);
      endTime = endTime - startTime;
      startTime = 0;
      isLive = true;
    }
  }*/

  // remove time seek from URL input path
  // https://github.com/mpv-player/mpv/issues/13358
  if (isStream() && !isLive) {
    livePath = stripYtTime(livePath);
  }

  return { isLive, livePath, startTime, endTime };
}

function calcBitrate(
  hasVideoTrack: boolean,
  hasAudioTrack: boolean,
  duration: number
) {
  if (!hasVideoTrack) {
    return [0, options.audio_bitrate];
  }

  let video_bitrate = 0;
  if (options.target_filesize) {
    let video_kilobits = options.target_filesize * 8;
    let audio_kilobits = 0;
    if (hasAudioTrack) {
      audio_kilobits = options.audio_bitrate * duration;
      video_kilobits -= audio_kilobits;
    }
    video_bitrate = Math.floor(video_kilobits / duration);
    // absolute minimum 100kbps
    // FIXME: warn in UI?
    video_bitrate = Math.max(100, video_bitrate);
  }

  return [video_bitrate, options.audio_bitrate];
}

function getCodecFlags(
  format: Format,
  hasVideoTrack: boolean,
  hasAudioTrack: boolean,
  startTime: number,
  endTime: number
): string[] {
  const args: string[] = [];
  // FIXME: fix if speed != 1?
  const duration = endTime - startTime;
  const [vbitrate, abitrate] = calcBitrate(
    hasVideoTrack,
    hasAudioTrack,
    duration
  );
  if (hasVideoTrack) {
    args.push(...format.getVideoFlags());
    // FIXME: CQ mode? (crf + max bitrate)
    if (vbitrate) {
      args.push(...format.getVideoBitrateFlags(vbitrate));
    } else {
      args.push(...format.getVideoQualityFlags());
    }
  }
  if (hasAudioTrack) {
    args.push(...format.getAudioFlags());
    args.push(...format.getAudioBitrateFlags(abitrate));
    // FIXME: do we need to downmix to stereo in case of e.g. 5.1 source?
    // command.push("--audio-channels=2");
  }
  return args;
}

function getUserFlags(): string[] {
  const flagStr = options.additional_flags.trim();
  return flagStr ? flagStr.split(/\s+/) : [];
}

function shouldTwoPass(format: Format): boolean {
  return !!options.target_filesize && format.twoPassSupported;
}

export interface Cmd {
  pass1Args?: string[] /** command for first pass */;
  pipeArgs?: string[] /** command before pipe */;
  args: string[] /** command after pipe (or just command) */;
  isLive: boolean;
  livePath: string;
  outPath: string;
  startTime: number;
  endTime: number;
  vmafLogPath?: string;
}

function commandInner(
  format: Format,
  region: Region,
  origStartTime: number,
  origEndTime: number,
  beforePipe = true
): Cmd {
  // prettier-ignore
  const { isLive, livePath, startTime, endTime } = fixPathTime(origStartTime, origEndTime);
  const activeTracks = getSupportedTracks(format);
  const hasVideoTrack = !!activeTracks.video.length;
  const hasAudioTrack = !!activeTracks.audio.length;
  const outPath = getOutPath(format, origStartTime, origEndTime);

  const srcPath = beforePipe ? livePath : "-";
  const args = ["mpv", srcPath, "--msg-level=all=warn"];

  // Cutting video only once.
  if (beforePipe) {
    // FIXME: shift by 1ms to be frame exact
    // FIXME: not needed if encoding full file?
    // FIXME: don't need to showTime, can use numbers?
    args.push(
      "--start=" + showTime(startTime, { hr: true }),
      "--end=" + showTime(endTime, { hr: true })
    );
  }

  args.push(
    ...getCodecFlags(format, hasVideoTrack, hasAudioTrack, startTime, endTime)
  );

  // Selecting tracks only once.
  if (beforePipe) {
    args.push(...getTrackFlags(activeTracks));
  }

  if (hasVideoTrack) {
    if (beforePipe) {
      // Applying PP filters only once.
      args.push(...getVideoPPFlags(format, region));
    } else {
      // Can apply setpts only after pipe, mpv bug.
      args.push(...getSpeedFlags());
    }
  }

  args.push(...format.getMetadataFlags(getMetadataTitle()));
  args.push(...getUserFlags());

  // finalize pass 1 flags
  // FIXME: don't encode audio for pass=1
  let pass1Args: string[] | undefined;
  if (shouldTwoPass(format)) {
    pass1Args = args.slice();
    pass1Args.push(...format.getPass1Flags(outPath));
    pass1Args.push("--of=null");
    pass1Args.push("--o=-");
  }

  // finalize pass 0/2 flags
  if (shouldTwoPass(format)) {
    args.push(...format.getPass2Flags(outPath));
  } else {
    args.push(...format.getPass0Flags(outPath));
  }
  args.push(...format.getMuxerFlags());
  args.push(`--o=${outPath}`);

  return {
    pass1Args,
    args,
    isLive,
    livePath,
    outPath,
    startTime,
    endTime,
  };
}

export function buildCommand(
  format: Format,
  region: Region,
  origStartTime: number,
  origEndTime: number
): Cmd {
  const speed = mp.get_property_number("speed", 1);
  if (speed === 1)
    return commandInner(format, region, origStartTime, origEndTime);

  // FIXME: can't use setpts filter with --start/--end flags, see:
  // https://github.com/mpv-player/mpv/issues/13370
  // FIXME: buildVmafCommand is broken in that case but using two pipes feels bad.
  const cmdPipe = commandInner(rawPipe, region, origStartTime, origEndTime);
  const cmd = commandInner(format, region, origStartTime, origEndTime, false);
  cmd.pipeArgs = cmdPipe.args;

  return cmd;
}

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
  const cmd = commandInner(rawVideoPipe, region, origStartTime, origEndTime);
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
