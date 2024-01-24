/** OS-dependent helpers. */

import type { MP } from "mpv.d.ts";
import { StringStartsWith } from "./helpers";

let platform: string | undefined;
let numCores: number | undefined;

export function getPlatform(): string {
  if (platform !== undefined) return platform;
  platform = mp.get_property("platform", "linux");
  return platform;
}

// FIXME: lacks in mp.utils: https://github.com/mpv-player/mpv/issues/13305
export function remove_file(path: string, { silentErrors = false } = {}): void {
  const args = getPlatform() === "windows" ? ["del", path] : ["rm", path];
  mp.command_native({
    name: "subprocess",
    args,
    playback_only: false,
    capture_stderr: silentErrors,
  } as MP.Cmd.SubprocessArgs);
}

export function mkdirp(dir: string): void {
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

export function nproc(): number {
  if (numCores !== undefined) return numCores;
  let cores = "";
  if (getPlatform() === "windows") {
    // https://stackoverflow.com/a/32395352
    const env = mp.utils.get_env_list();
    for (const line of env) {
      if (StringStartsWith(line, "NUMBER_OF_PROCESSORS=")) {
        cores = line.slice("NUMBER_OF_PROCESSORS=".length);
        break;
      }
    }
  } else {
    const args =
      getPlatform() === "darwin"
        ? ["sysctl", "-n", "hw.ncpu"] // macOS
        : ["nproc", "--all"]; // Linux and other Unix
    const ret = mp.command_native({
      name: "subprocess",
      args,
      playback_only: false,
      capture_stdout: true,
    } as MP.Cmd.SubprocessArgs) as MP.Cmd.SubprocessResult;
    cores = ret.stdout!;
  }
  numCores = +cores || 8; // assume 8 cores if can't detect
  return numCores;
}
