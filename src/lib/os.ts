/** OS-dependent helpers. */

import type { MP } from "mpv.d.ts";

let platform: string | undefined;

export function getPlatform() {
  if (platform !== undefined) return platform;
  platform = mp.get_property("platform", "linux");
  return platform;
}

// FIXME: lacks in mp.utils: https://github.com/mpv-player/mpv/issues/13305
export function remove_file(path: string, { silentErrors = false } = {}) {
  const args = getPlatform() === "windows" ? ["del", path] : ["rm", path];
  mp.command_native({
    name: "subprocess",
    args,
    playback_only: false,
    capture_stderr: silentErrors,
  } as MP.Cmd.SubprocessArgs);
}

export function mkdirp(dir: string) {
  // In Windows, mkdir creates directory trees by default.
  // FIXME: silent errors on Windows?
  const args =
    getPlatform() === "windows" ? ["mkdir", dir] : ["mkdir", "-p", dir];
  mp.command_native({
    name: "subprocess",
    args,
    playback_only: false,
  } as MP.Cmd.SubprocessArgs);
}

export function getNullPath() {
  return getPlatform() === "windows" ? "NUL" : "/dev/null";
}
