import { test, before, beforeEach } from "node:test";
import { deepEqual } from "node:assert/strict";

import options, { serializeOptions } from "../src/options";
import { byteLength } from "../src/utils";
import { formatByName, getCurrentFormat } from "../src/encode/formats";
import { buildCommand, getMetadataTitle } from "../src/encode/cmd";
import { buildVmafCommand } from "../src/encode/vmaf";
import { MPVEncode } from "../src/encode/mpv";
import { Region } from "../src/video-to-screen";
import { formatFilename } from "../src/pretty";

import {
  setMock,
  enableVideoToolbox,
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

test("formatFilename", () => {
  const filename = formatFilename(formatByName.x264, START_TIME, END_TIME);
  deepEqual(filename, "video-[00.01.417-00.03.042].mp4");
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

test("getMetadataTitle", () => {
  let title = getMetadataTitle();
  deepEqual(title, "test 비디오");
  setFile({ local: false });
  title = getMetadataTitle();
  deepEqual(title, "test 비디오 [youtube.com/watch?v=ABCDEF-1234]");
});

test("x264 twopass", () => {
  deepEqual(formatByName.x264.getPass1Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass1",
    "--ovcopts-add=stats=/tmp/.ninnin-out.mp4.passlog",
  ]);
  deepEqual(formatByName.x264.getPass2Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass2",
    "--ovcopts-add=stats=/tmp/.ninnin-out.mp4.passlog",
  ]);
  deepEqual(formatByName.x264.getPassFilePaths("/tmp/out.mp4"), [
    "/tmp/out.mp4-video-pass1.log",
    "/tmp/.ninnin-out.mp4.passlog",
    "/tmp/.ninnin-out.mp4.passlog.mbtree",
    "/tmp/.ninnin-out.mp4.passlog.temp",
    "/tmp/.ninnin-out.mp4.passlog.mbtree.temp",
  ]);
});

test("x265 twopass", () => {
  deepEqual(formatByName.x265.getPass1Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass1",
    "--ovcopts-add=x265-params=log-level=warning:pass=1:stats=/tmp/.ninnin-out.mp4.passlog",
  ]);
  deepEqual(formatByName.x265.getPass2Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass2",
    "--ovcopts-add=x265-params=log-level=warning:pass=2:stats=/tmp/.ninnin-out.mp4.passlog",
  ]);
  deepEqual(formatByName.x265.getPassFilePaths("/tmp/out.mp4"), [
    "/tmp/out.mp4-video-pass1.log",
    "/tmp/.ninnin-out.mp4.passlog",
    "/tmp/.ninnin-out.mp4.passlog.cutree",
    "/tmp/.ninnin-out.mp4.passlog.temp",
    "/tmp/.ninnin-out.mp4.passlog.cutree.temp",
  ]);
});

test("buildCommand x264/aac", () => {
  options.output_format = "x264";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
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
    "--oset-metadata=title=%14%test 비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);

  options.target_filesize = 1024;
  deepEqual(getCmd().pass1Args!.slice(-2), ["--of=null", "--o=-"]);
  enableVideoToolbox();
  deepEqual(getArgs().includes("--oac=aac_at"), true);
});

test("buildCommand x265/aac_at", () => {
  enableVideoToolbox();
  options.output_format = "x265";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
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
    "--oset-metadata=title=%14%test 비디오",
    "--ovcopts-add=x265-params=log-level=warning",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});

test("buildCommand hevc_vtb/aac_at", () => {
  enableVideoToolbox();
  options.output_format = "hevc_vtb";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=hevc_videotoolbox",
    "--ovcopts-add=codec_tag=0x31637668",
    "--ovcopts-add=global_quality=7670",
    "--ovcopts-add=flags=+qscale",
    "--oac=aac_at",
    "--oacopts-add=aac_at_mode=cvbr",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--oset-metadata=title=%14%test 비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});

test("buildCommand svtav1/opus", () => {
  enableVideoToolbox();
  options.output_format = "svtav1";
  deepEqual(getArgs(), [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--ovc=libsvtav1",
    "--ovcopts-add=preset=10",
    "--ovcopts-add=svtav1-params=tune=0",
    "--ovcopts-add=crf=30",
    "--oac=libopus",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--oset-metadata=title=%14%test 비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
  options.svtav1_film_grain = 8;
  deepEqual(
    getArgs().includes("--ovcopts-add=svtav1-params=tune=0:film-grain=8"),
    true
  );
});

test("buildCommand VMAF", () => {
  const cmd = getVmafCmd();
  deepEqual(cmd.pipeArgs, [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
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
    "--no-terminal",
    "/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
    "--external-file=-",
    "--lavfi-complex=[vid1][vid2]libvmaf=n_threads=3:log_path='/home/user/Downloads/.ninnin-video-[00.01.417-00.03.042].mp4.json':log_fmt=json[vo]",
    "--of=null",
    "--o=-",
  ]);
  deepEqual(cmd.pass1Args, undefined);
});

test("MPVEncode", () => {
  const cmd = getCmd();
  const mpv = new MPVEncode(undefined, cmd.args, cmd.outPath);
  deepEqual(mpv.args.slice(-3), [
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
    "--script=/home/user/.config/mpv/scripts/ninnin.js",
    "--script-opts=ninnin-encoding=/home/user/Downloads/.ninnin-video-[00.01.417-00.03.042].mp4.log",
  ]);
  const cmd2 = getVmafCmd();
  const mpv2 = new MPVEncode(cmd2.pipeArgs, cmd2.args, cmd2.outPath);
  deepEqual(mpv2.args, [
    "sh",
    "-c",
    "mpv /home/user/video.mp4 --no-terminal --start=0:00:01.417 --end=0:00:03.042 --ovc=rawvideo --vid=1 --aid=no --sid=no --of=nut --o=- " +
      "| mpv --no-terminal '/home/user/Downloads/video-[00.01.417-00.03.042].mp4' --external-file=-" +
      " '--lavfi-complex=[vid1][vid2]libvmaf=n_threads=3:log_path='\\''/home/user/Downloads/.ninnin-video-[00.01.417-00.03.042].mp4.json'\\'':log_fmt=json[vo]' --of=null --o=-" +
      " --script=/home/user/.config/mpv/scripts/ninnin.js '--script-opts=ninnin-encoding=/home/user/Downloads/.ninnin-video-[00.01.417-00.03.042].mp4.log'",
  ]);
});

test("10-bit", () => {
  enableVideoToolbox();
  options.output_format = "x265";
  options.force_10bit = true;
  deepEqual(getArgs().includes("--vf-add=format=yuv420p10le"), true);
  options.output_format = "hevc_vtb";
  deepEqual(getArgs().includes("--vf-add=format=p010le"), true);
  options.output_format = "svtav1";
  deepEqual(getArgs().includes("--vf-add=format=yuv420p10le"), true);
});
