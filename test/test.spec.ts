import test from "node:test";
import { deepEqual } from "node:assert/strict";

import "./mock";

import { format_filename } from "../src/utils";
import { formats } from "../src/formats";

test("format_filename", () => {
  const filename = format_filename(1, 2, formats.avc);
  // %F-[%s-%e]%M
  deepEqual(filename, "video-[00.01.000-00.02.000]-audio.mp4");
});
