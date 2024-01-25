import * as Path from "node:path";

import options from "../src/options";
import { testingResetCaps } from "../src/caps";
import { testingResetPlatform } from "../src/lib/os";

const DEFAULT_OPTIONS = { ...options };

let currentPlatform = "linux";
let videoToolboxEnabled = false;

const localFile = {
  local: true,
  filename: "video.mp4",
  "filename/no-ext": "video",
  path: "/home/user/video.mp4",
};
const remoteFile = {
  local: false,
  filename: "watch?v=ABCDEF-1234",
  "filename/no-ext": "watch?v=ABCDEF-1234",
  path: "https://www.youtube.com/watch?v=ABCDEF-1234&t=123",
};
let currentFile = localFile;

const mp = {
  get_script_file() {
    return "/home/user/.config/mpv/scripts/ninnin.js";
  },
  utils: {
    getenv(env) {
      if (env === "HOME") {
        return "/home/user";
      }
      throw new Error("getenv " + env);
    },
    getcwd() {
      return "/home/user";
    },
    get_user_path(path: string) {
      return path.replace(/~\//g, "/home/user/");
    },
    // file_info(path) {
    //   return path === "/home/user/video.mp4" ? {} : null;
    // },
    split_path(path) {
      return [Path.dirname(path), Path.basename(path)];
    },
    join_path(dname, fname) {
      return Path.join(dname, fname);
    },
  },
  msg: {
    info: (msg) => {},
    warn: (msg) => {},
    verbose: (msg) => {},
  },
  get_property(prop) {
    switch (prop) {
      case "filename":
        return currentFile.filename;
      case "filename/no-ext":
        return currentFile["filename/no-ext"];
      case "path":
      case "stream-open-filename":
        return currentFile.path;
      case "media-title":
        return "test 비디오";
      case "sub-ass-override":
        return "yes";
      case "sub-ass-style-overrides":
        return "";
      case "sub-ass-vsfilter-aspect-compat":
        return "yes";
      case "sub-auto":
        return "exact";
      case "sub-pos":
        return "100.000000";
      case "sub-delay":
        return "0.000000";
      case "video-rotate":
        return "0";
      case "ytdl-format":
        return "";
      case "deinterlace":
        return "no";
      case "platform":
        return currentPlatform;
    }
    throw new Error("get_property: " + prop);
  },
  get_property_native(prop) {
    switch (prop) {
      case "aid":
        return 1;
      case "track-list":
        return [
          {
            id: 1,
            type: "video",
            selected: true,
            external: false,
            "external-filename": "",
          },
          {
            id: 1,
            type: "audio",
            selected: true,
            external: false,
            "external-filename": "",
          },
        ];
      case "vf":
        return [];
      case "encoder-list":
        return videoToolboxEnabled
          ? [{ driver: "hevc_videotoolbox" }, { driver: "aac_at" }]
          : [];
    }
    throw new Error("get_property_native: " + prop);
  },
  get_property_number(prop) {
    switch (prop) {
      case "height":
        return 1080;
      case "brightness":
      case "contrast":
      case "saturation":
        return 0;
      case "speed":
        return 1;
    }
    throw new Error("get_property_number: " + prop);
  },
  get_property_bool(prop) {
    switch (prop) {
      case "demuxer-via-network":
        return !currentFile.local;
      case "mute":
        return false;
      case "sub-visibility":
        return false;
    }
    throw new Error("get_property_bool: " + prop);
  },
  command_native(table) {
    const [cmd, args] = Array.isArray(table)
      ? [table[0], table.slice(1)]
      : [table.name, table.args];
    switch (cmd) {
      case "expand-text":
        return args[0].replace(
          "${filename/no-ext}",
          currentFile["filename/no-ext"]
        );
      case "subprocess":
        if (args[0] === "nproc") {
          return { stdout: "3" };
        }
        throw new Error("subprocess: " + table);
    }
    throw new Error("command_native: " + cmd);
  },
};

export function setMock() {
  global.mp = mp as any;
}

export function setPlatform(platform: string) {
  testingResetPlatform();
  currentPlatform = platform;
}

export function setFile({ local } = { local: true }) {
  currentFile = local ? localFile : remoteFile;
}

export function enableVideoToolbox() {
  testingResetCaps();
  videoToolboxEnabled = true;
}

export function resetOpts() {
  Object.assign(options, DEFAULT_OPTIONS);
  testingResetPlatform();
  testingResetCaps();
  currentPlatform = "linux";
  currentFile = localFile;
  videoToolboxEnabled = false;
}
