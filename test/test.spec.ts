import { test, before, beforeEach } from "node:test";
import { deepEqual } from "node:assert/strict";

import options, { serializeOptions } from "../src/options";
import { byteLength } from "../src/utils";
import { formatByName, getCurrentFormat } from "../src/cmd/formats";
import { buildCommand, buildVmafCommand } from "../src/cmd/cmd";
import { MPVEncode } from "../src/encode/mpv";
import { Region } from "../src/video-to-screen";
import { formatFilename, getMetadataTitle, titleURL } from "../src/cmd/pretty";

import {
  setMock,
  enableAudioToolbox,
  resetOpts,
  setFile,
  setPlatform,
} from "./mock";
import { getShellArgs } from "../src/lib/os";

const START_TIME = 1.41708333333333;
const END_TIME = 3.0420083333333;

function getCmd() {
  return buildCommand(getCurrentFormat(), new Region(), START_TIME, END_TIME);
}
function getArgs() {
  return getCmd().args;
}
function getVmafCmd() {
  return buildVmafCommand(
    getCurrentFormat(),
    new Region(),
    START_TIME,
    END_TIME
  );
}

before(() => {
  setMock();
});

beforeEach(() => {
  resetOpts();
});

test("byteLength", () => {
  deepEqual(byteLength("세모콘"), 9);
  deepEqual(byteLength("🔥🤖👽"), 12);
  deepEqual(byteLength("test 🔥"), 9);
});

test("getShellArgs", () => {
  const args = ["echo", "`evil`", "'arg1'", '"arg2"'];
  deepEqual(getShellArgs(args), [
    "sh",
    "-c",
    "echo '`evil`' ''\\''arg1'\\''' '\"arg2\"'",
  ]);
  setPlatform("windows");
  deepEqual(getShellArgs(args), [
    "cmd",
    "/c",
    '"echo "`evil`" "\'arg1\'" ""\\""arg2"\\""""',
  ]);
});

test("serializeOptions", () => {
  const opts = {
    output_format: "x264",
    scale_height: -1,
    apply_current_filters: true,
    force_square_pixels: false,
  };
  deepEqual(
    serializeOptions(opts as any),
    "# WILL BE OVERWRITTEN BY THE SCRIPT, EDIT WITH CAUTION\n" +
      "output_format=x264\n" +
      "scale_height=-1\n" +
      "apply_current_filters=yes\n" +
      "force_square_pixels=no\n"
  );
});

test("formatFilename", () => {
  const filename = formatFilename(formatByName.x264, START_TIME, END_TIME);
  deepEqual(filename, "비디오 [00.01-00.03].mp4");
});

test("titleURL", () => {
  deepEqual(titleURL("file:///path"), undefined);
  deepEqual(
    titleURL("https://www.youtube.com/watch?v=ABCDEF-1234"),
    "youtu.be/ABCDEF-1234"
  );
  deepEqual(
    titleURL("https://www.youtube.com/watch?v=ABCDEF-1234&a=1&b=2"),
    "youtu.be/ABCDEF-1234"
  );
  deepEqual(
    titleURL("https://www.youtube.com/watch?a=1&v=ABCDEF-1234&b=2"),
    "youtu.be/ABCDEF-1234"
  );
  deepEqual(
    titleURL("https://youtu.be/ABCDEF-1234?t=120"),
    "youtu.be/ABCDEF-1234"
  );
});

test("getMetadataTitle", () => {
  let title = getMetadataTitle();
  deepEqual(title, "비디오");
  setFile({ local: false });
  title = getMetadataTitle();
  deepEqual(title, "비디오 (youtu.be/ABCDEF-1234)");
});

test("x264 twopass", () => {
  deepEqual(formatByName.x264.getPass1Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass1",
    "--ovcopts-add=stats=%24%/tmp/.ninnin-123.passlog",
  ]);
  deepEqual(formatByName.x264.getPass2Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass2",
    "--ovcopts-add=stats=%24%/tmp/.ninnin-123.passlog",
  ]);
  deepEqual(formatByName.x264.getPassFilePaths("/tmp/out.mp4"), [
    "/tmp/out.mp4-video-pass1.log",
    "/tmp/.ninnin-123.passlog",
    "/tmp/.ninnin-123.passlog.temp",
    "/tmp/.ninnin-123.passlog.mbtree",
    "/tmp/.ninnin-123.passlog.mbtree.temp",
  ]);
});

test("x265 twopass", () => {
  deepEqual(formatByName.x265.getPass1Flags("/tmp/out.mp4"), [
    "--ovcopts-add=x265-params=%57%log-level=warning:pass=1:stats='/tmp/.ninnin-123.passlog'",
  ]);
  deepEqual(formatByName.x265.getPass2Flags("/tmp/out.mp4"), [
    "--ovcopts-add=x265-params=%57%log-level=warning:pass=2:stats='/tmp/.ninnin-123.passlog'",
  ]);
  deepEqual(formatByName.x265.getPassFilePaths("/tmp/out.mp4"), [
    "/tmp/.ninnin-123.passlog",
    "/tmp/.ninnin-123.passlog.temp",
    "/tmp/.ninnin-123.passlog.cutree",
    "/tmp/.ninnin-123.passlog.cutree.temp",
  ]);
});

test("buildCommand x264/aac", () => {
  options.output_format = "x264";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--msg-level=all=warn",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=libx264",
    "--ovcopts-add=preset=slow",
    "--ovcopts-add=crf=20",
    "--oac=aac",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--oset-metadata=title=%9%비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/비디오 [00.01-00.03].mp4",
  ]);

  options.target_filesize = 1024;
  deepEqual(getCmd().pass1Args!.slice(-2), ["--of=null", "--o=-"]);
  enableAudioToolbox();
  deepEqual(getArgs().includes("--oac=aac_at"), true);

  setFile({ local: false });
  deepEqual(getArgs()[1], "https://www.youtube.com/watch?v=ABCDEF-1234");
});

test("buildCommand x265/aac_at", () => {
  enableAudioToolbox();
  options.output_format = "x265";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--msg-level=all=warn",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=libx265",
    "--ovcopts-add=preset=medium",
    "--ovcopts-add=codec_tag=0x31637668",
    "--ovcopts-add=crf=20",
    "--oac=aac_at",
    "--oacopts-add=aac_at_mode=cvbr",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--oset-metadata=title=%9%비디오",
    "--ovcopts-add=x265-params=%17%log-level=warning",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/비디오 [00.01-00.03].mp4",
  ]);
});

test("buildCommand svtav1/opus", () => {
  enableAudioToolbox();
  options.output_format = "svtav1";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--msg-level=all=warn",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=libsvtav1",
    "--ovcopts-add=preset=10",
    "--ovcopts-add=crf=30",
    "--oac=libopus",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--oset-metadata=title=%9%비디오",
    "--ovcopts-add=svtav1-params=%6%tune=0",
    "--o=/home/user/Downloads/비디오 [00.01-00.03].webm",
  ]);
  options.svtav1_film_grain = 8;
  deepEqual(
    getArgs().includes("--ovcopts-add=svtav1-params=%19%tune=0:film-grain=8"),
    true
  );
});

test("buildCommand VMAF", () => {
  const cmd = getVmafCmd();
  deepEqual(cmd.pipeArgs, [
    "mpv",
    "/home/user/video.mp4",
    "--msg-level=all=warn",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=rawvideo",
    "--vid=1",
    "--aid=no",
    "--sid=no",
    "--of=nut",
    "--o=-",
  ]);
  deepEqual(cmd.args, [
    "mpv",
    "/home/user/Downloads/비디오 [00.01-00.03].webm",
    "--msg-level=all=warn",
    "--external-file=-",
    "--lavfi-complex=[vid1][vid2]libvmaf=n_threads=3:log_path='/home/user/Downloads/.ninnin-123.json':log_fmt=json[vo]",
    "--of=null",
    "--o=-",
  ]);
  deepEqual(cmd.pass1Args, undefined);
});

test("MPVEncode", () => {
  const cmd = getCmd();
  const mpv = new MPVEncode(undefined, cmd.args, cmd.outPath);
  deepEqual(mpv.args.slice(-3), [
    "--o=/home/user/Downloads/비디오 [00.01-00.03].webm",
    "--script=/home/user/.config/mpv/scripts/ninnin.js",
    "--script-opts=ninnin-encoding=%36%/home/user/Downloads/.ninnin-123.log",
  ]);
  const cmd2 = getVmafCmd();
  const mpv2 = new MPVEncode(cmd2.pipeArgs, cmd2.args, cmd2.outPath);
  deepEqual(mpv2.args, [
    "sh",
    "-c",
    "mpv /home/user/video.mp4 --msg-level=all=warn --start=0:00:01.417 --end=0:00:03.042 --ovc=rawvideo --vid=1 --aid=no --sid=no --of=nut --o=- " +
      "| mpv '/home/user/Downloads/비디오 [00.01-00.03].webm' --msg-level=all=warn --external-file=-" +
      " '--lavfi-complex=[vid1][vid2]libvmaf=n_threads=3:log_path='\\''/home/user/Downloads/.ninnin-123.json'\\'':log_fmt=json[vo]' --of=null --o=-" +
      " --script=/home/user/.config/mpv/scripts/ninnin.js '--script-opts=ninnin-encoding=%36%/home/user/Downloads/.ninnin-123.log'",
  ]);
});

test("10-bit", () => {
  options.output_format = "x265";
  options.force_10bit = true;
  deepEqual(getArgs().includes("--vf-add=format=yuv420p10le"), true);
  options.output_format = "svtav1";
  deepEqual(getArgs().includes("--vf-add=format=yuv420p10le"), true);
});
