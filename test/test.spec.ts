import test from "node:test";
import { deepEqual } from "node:assert/strict";

import "./mock";

import { format_filename } from "../src/utils";
import { formats } from "../src/formats";
import { exportedForTesting as encodeTesting } from "../src/encode";
import { Region } from "../src/video-to-screen";

const START_TIME = 1.41708333333333;
const END_TIME = 3.0427083333333;

test("format_filename", () => {
  const filename = format_filename(START_TIME, END_TIME, formats.avc);
  // %F-[%s-%e]%M
  deepEqual(filename, "video-[00.01.417-00.03.042]-audio.mp4");
});

test("buildCommand", () => {
  const cmdRes = encodeTesting.buildCommand(new Region(), START_TIME, END_TIME);
  deepEqual(!!cmdRes, true);

  deepEqual(cmdRes.command, [
    "mpv",
    "/home/user/video.mp4",
    "--start=0:00:01.417",
    "--end=0:00:03.042",
    "--loop-file=no",
    "--no-pause",
    "--ovc=libx264",
    "--oac=aac",
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
    "--ovcopts-add=threads=4",
    "--ovcopts-add=b=0",
    "--ovcopts-add=crf=23",
    "--o=/home/user/video-[00.01.417-00.03.042]-audio.mp4",
  ]);
});
