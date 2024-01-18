import { test, before, beforeEach } from "node:test";
import { deepEqual } from "node:assert/strict";

import options from "../src/options";
import { byteLength } from "../src/utils";
import { formatByName } from "../src/encode/formats";
import { buildCommand, getMetadataTitle } from "../src/encode/cmd";
import { Region } from "../src/video-to-screen";
import { formatFilename } from "../src/pretty";

import { setMock, enableVideoToolbox, resetOpts, setFile } from "./mock";

const START_TIME = 1.41708333333333;
const END_TIME = 3.0427083333333;

before(() => {
  setMock();
});

beforeEach(() => {
  resetOpts();
});

test("byteLength", () => {
  deepEqual(byteLength("세모콘"), 9);
});

test("formatFilename", () => {
  const filename = formatFilename(START_TIME, END_TIME, formatByName.x264);
  // %F-[%s-%e]%M
  deepEqual(filename, "video-[00.01.417-00.03.042].mp4");
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
    "--ovcopts-add=x265-params=pass=1:stats=/tmp/.ninnin-out.mp4.passlog",
  ]);
  deepEqual(formatByName.x265.getPass2Flags("/tmp/out.mp4"), [
    "--ovcopts-add=flags=+pass2",
    "--ovcopts-add=x265-params=pass=2:stats=/tmp/.ninnin-out.mp4.passlog",
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
  const cmdRes = buildCommand(new Region(), START_TIME, END_TIME)!;
  deepEqual(cmdRes.args, [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
    "--ovc=libx264",
    "--ovcopts-add=preset=slow",
    "--ovcopts-add=crf=20",
    "--oac=aac",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--sub-ass-override=yes",
    "--sub-ass-vsfilter-aspect-compat=yes",
    "--sub-auto=exact",
    "--sub-pos=100.000000",
    "--sub-delay=0.000000",
    "--video-rotate=0",
    "--deinterlace=no",
    "--ofopts-add=movflags=+faststart",
    "--oset-metadata=title=%14%test 비디오",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});

test("buildCommand x264/aac_at", () => {
  enableVideoToolbox();
  const cmdRes = buildCommand(new Region(), START_TIME, END_TIME)!;
  const cmd = cmdRes.args;
  deepEqual(cmd.includes("--oac=aac_at"), true, JSON.stringify(cmd));
});

test("buildCommand x265/aac_at", () => {
  enableVideoToolbox();
  options.output_format = "x265";
  const cmdRes = buildCommand(new Region(), START_TIME, END_TIME)!;
  deepEqual(cmdRes.args, [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
    "--ovc=libx265",
    "--ovcopts-add=preset=fast",
    "--ovcopts-add=crf=20",
    "--oac=aac_at",
    "--oacopts-add=aac_at_mode=cvbr",
    "--oacopts-add=b=192k",
    "--vid=1",
    "--aid=1",
    "--sid=no",
    "--sub-ass-override=yes",
    "--sub-ass-vsfilter-aspect-compat=yes",
    "--sub-auto=exact",
    "--sub-pos=100.000000",
    "--sub-delay=0.000000",
    "--video-rotate=0",
    "--deinterlace=no",
    "--vf-add=format=yuv420p10le",
    "--ofopts-add=movflags=+faststart",
    "--oset-metadata=title=%14%test 비디오",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});

test("buildCommand hevc_vtb/aac_at", () => {
  enableVideoToolbox();
  options.output_format = "hevc_vtb";
  const cmdRes = buildCommand(new Region(), START_TIME, END_TIME)!;
  deepEqual(cmdRes.args, [
    "mpv",
    "/home/user/video.mp4",
    "--no-terminal",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
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
    "--sub-ass-override=yes",
    "--sub-ass-vsfilter-aspect-compat=yes",
    "--sub-auto=exact",
    "--sub-pos=100.000000",
    "--sub-delay=0.000000",
    "--video-rotate=0",
    "--deinterlace=no",
    "--vf-add=format=p010le",
    "--ofopts-add=movflags=+faststart",
    "--oset-metadata=title=%14%test 비디오",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});
