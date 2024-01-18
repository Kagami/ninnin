// OS-dependent helpers

import type { MP } from "mpv.d.ts";

let platformInited = false;
let platform: string;

export function getPlatform() {
  if (platformInited) return platform;
  platform = mp.get_property("platform", "linux");
  platformInited = true;
  return platform;
}

// FIXME: lacks in mp.utils: https://github.com/mpv-player/mpv/issues/13305
export function remove_file(path: string, { silentErrors = false } = {}) {
  if (getPlatform() === "windows") {
    mp.command_native({
      name: "subprocess",
      args: ["del", path],
      playback_only: false,
      capture_stderr: silentErrors,
    } as MP.Cmd.SubprocessArgs);
  } else {
    mp.command_native({
      name: "subprocess",
      args: ["rm", path],
      playback_only: false,
      capture_stderr: silentErrors,
    } as MP.Cmd.SubprocessArgs);
  }
}
