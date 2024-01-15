import test from "node:test";
import { deepEqual } from "node:assert/strict";

import { format_filename } from "../src/utils";
import { formatByName } from "../src/formats";
import { exportedForTesting as encodeTesting } from "../src/encode";
import { exportedForTesting as capsTesting } from "../src/caps";
import { Region } from "../src/video-to-screen";

import { enableMock, enableVideoToolbox } from "./mock";
import options from "../src/options";

enableMock();

const START_TIME = 1.41708333333333;
const END_TIME = 3.0427083333333;

test("format_filename", () => {
  const filename = format_filename(START_TIME, END_TIME, formatByName.x264);
  // %F-[%s-%e]%M
  deepEqual(filename, "video-[00.01.417-00.03.042].mp4");
});

test("buildCommand x264/aac", () => {
  const cmdRes = encodeTesting.buildCommand(new Region(), START_TIME, END_TIME);
  deepEqual(cmdRes.command, [
    "mpv",
    "/home/user/video.mp4",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
    "--ovc=libx264",
    "--ovcopts-add=preset=slow",
    "--ovcopts-add=crf=23",
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
    "--oset-metadata=title=%5%video",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});

test("buildCommand aac_at", () => {
  capsTesting.resetCaps();
  enableVideoToolbox();
  const cmdRes = encodeTesting.buildCommand(new Region(), START_TIME, END_TIME);
  const cmd = cmdRes.command;
  deepEqual(cmd.includes("--oac=aac_at"), true, JSON.stringify(cmd));
});

test("buildCommand x265/aac_at", () => {
  options.output_format = "x265";
  const cmdRes = encodeTesting.buildCommand(new Region(), START_TIME, END_TIME);
  deepEqual(cmdRes.command, [
    "mpv",
    "/home/user/video.mp4",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
    "--ovc=libx265",
    "--ovcopts-add=preset=fast",
    "--ovcopts-add=crf=23",
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
    "--oset-metadata=title=%5%video",
    "--o=/home/user/Downloads/video-[00.01.417-00.03.042].mp4",
  ]);
});
