import { test, before, beforeEach } from "node:test";
import { deepEqual } from "node:assert/strict";

import options, { serializeOptions } from "../src/options";
import { byteLength } from "../src/utils";
import { formatByName } from "../src/encode/formats";
import { buildCommand, getMetadataTitle } from "../src/encode/cmd";
import { Region } from "../src/video-to-screen";
import { formatFilename } from "../src/pretty";

import { setMock, enableVideoToolbox, resetOpts, setFile } from "./mock";

const START_TIME = 1.41708333333333;
const END_TIME = 3.0420083333333;

function getCmd() {
  return buildCommand(new Region(), START_TIME, END_TIME)!;
}
function getArgs() {
  return getCmd().args;
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

test("formatFilename", () => {
  const filename = formatFilename(START_TIME, END_TIME, formatByName.x264);
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
  deepEqual(getArgs(), [
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
    "--oset-metadata=title=%14%test 비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);

  options.target_filesize = 1024;
  deepEqual(getCmd().argsPass1.slice(-2), ["--of=null", "--o=/dev/null"]);
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
    "--loop-file=no",
    "--no-pause",
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
    "--sub-ass-override=yes",
    "--sub-ass-vsfilter-aspect-compat=yes",
    "--sub-auto=exact",
    "--sub-pos=100.000000",
    "--sub-delay=0.000000",
    "--video-rotate=0",
    "--deinterlace=no",
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
    "--loop-file=no",
    "--no-pause",
    "--ovc=libsvtav1",
    "--ovcopts-add=svtav1-params=tune=0",
    "--ovcopts-add=crf=30",
    "--oac=libopus",
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
    "--oset-metadata=title=%14%test 비디오",
    "--ofopts-add=movflags=+faststart",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
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
