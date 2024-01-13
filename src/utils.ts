import type { Format } from "./formats";
import options from "./options";
import { matchAll, endsWith } from "./polyfills";

function format_d(n: number) {
  return n + "";
}
function format_02d(n: number) {
  let s = n + "";
  if (s.length === 1) {
    s = "0" + s;
  }
  return s;
}
function format_03d(n: number) {
  let s = n + "";
  if (s.length === 1) {
    s = "00" + s;
  } else if (s.length === 2) {
    s = "0" + s;
  }
  return s;
}
function format_3f(n: number) {
  return n.toFixed(3);
}

export function bold(text: string) {
  return `{\\b1}${text}{\\b0}`;
}

// OSD message, using ass.
export function message(text: string, duration?: number) {
  let ass = mp.get_property_osd("osd-ass-cc/0");
  // wanted to set font size here, but it's completely unrelated to the font
  // size in set_osd_ass.
  ass += text;
  mp.osd_message(ass, duration || options.message_duration);
}

export function seconds_to_time_string(
  seconds: number,
  no_ms = false,
  full = false
) {
  if (seconds < 0) return "unknown";
  let ret = "";
  if (!no_ms) {
    ret = "." + format_03d((seconds * 1000) % 1000);
  }
  ret =
    format_02d(Math.floor(seconds / 60) % 60) +
    ":" +
    format_02d(Math.floor(seconds) % 60) +
    ret;
  if (full || seconds > 3600) {
    ret = Math.floor(seconds / 3600) + ret;
  }
  return ret;
}

function seconds_to_path_element(seconds: number, no_ms = false, full = false) {
  let time_string = seconds_to_time_string(seconds, no_ms, full);
  // Needed for Windows (and maybe for Linux? idk)
  time_string = time_string.replace(/:/g, ".");
  return time_string;
}

export function file_exists(name: string) {
  return !!mp.utils.file_info(name);
}

// FIXME: check correctness
function expand_properties(text: string, magic = "$") {
  const re = new RegExp(
    "\\" + magic + "\\{([?!]?)(=?)([^}:]*)(:?)([^}]*)(\\}*)}",
    "g"
  );
  for (const [_, origPrefix, raw, prop, colon, fallback, closing] of matchAll(
    text,
    re
  )) {
    let prefix = origPrefix;
    let actual_prop = prop;
    let compare_value: string | undefined;
    if (prefix) {
      const m = prop.match(/(.*?)==(.*)/);
      if (m) {
        actual_prop = m[1];
        compare_value = m[2];
      }
    }

    const get_prop_fn = raw === "=" ? mp.get_property : mp.get_property_osd;
    let prop_value =
      get_prop_fn(actual_prop, colon === ":" ? fallback : "(error)") + "";
    const err = mp.last_error();

    if (prefix === "?") {
      if (compare_value === undefined) {
        prop_value = !err ? fallback + closing : "";
      } else {
        prop_value = prop_value === compare_value ? fallback + closing : "";
      }
      prefix = "\\" + prefix;
    } else if (prefix === "!") {
      if (compare_value === undefined) {
        prop_value = err ? fallback + closing : "";
      } else {
        prop_value = prop_value !== compare_value ? fallback + closing : "";
      }
    } else {
      prop_value = prop_value + closing;
    }

    // XXX: gsub in Lua, but single replace should be enough?
    // XXX: don't need to escape \W here?
    if (colon === ":") {
      // prettier-ignore
      text = text.replace(
        "\\" + magic + "{" + prefix + raw + prop + ":" + fallback + closing + "}",
        expand_properties(prop_value)
      );
    } else {
      text = text.replace(
        "\\" + magic + "{" + prefix + raw + prop + closing + "}",
        prop_value
      );
    }
  }

  return text;
}

// FIXME: port
function lua_os_date(_format: string) {
  return "unknown";
}

const REPLACE_FIRST: [RegExp, string][] = [
  [/%mp/g, "%mH.%mM.%mS"],
  [/%mP/g, "%mH.%mM.%mS.%mT"],
  [/%p/g, "%wH.%wM.%wS"],
  [/%P/g, "%wH.%wM.%wS.%wT"],
];
export function format_filename(
  startTime: number,
  endTime: number,
  videoFormat: Format
) {
  const hasAudioCodec = !!videoFormat.audioCodec;
  // TODO: is that slow?
  const replaceTable: [RegExp, string][] = [
    [/%wH/g, format_02d(Math.floor(startTime / (60 * 60)))],
    [/%wh/g, format_d(Math.floor(startTime / (60 * 60)))],
    [/%wM/g, format_02d(Math.floor((startTime / 60) % 60))],
    [/%wm/g, format_d(Math.floor(startTime / 60))],
    [/%wS/g, format_02d(Math.floor(startTime % 60))],
    [/%ws/g, format_d(Math.floor(startTime))],
    [/%wf/g, format_d(startTime)],
    [/%wT/g, format_3f(startTime % 1).slice(2)],
    [/%mH/g, format_02d(Math.floor(endTime / (60 * 60)))],
    [/%mh/g, format_d(Math.floor(endTime / (60 * 60)))],
    [/%mM/g, format_02d(Math.floor((endTime / 60) % 60))],
    [/%mm/g, format_d(Math.floor(endTime / 60))],
    [/%mS/g, format_02d(Math.floor(endTime % 60))],
    [/%ms/g, format_d(Math.floor(endTime))],
    [/%mf/g, format_d(endTime)],
    [/%mT/g, format_3f(endTime % 1).slice(2)],
    [/%f/g, mp.get_property("filename")],
    [/%F/g, mp.get_property("filename/no-ext")],
    [/%s/g, seconds_to_path_element(startTime)],
    [/%S/g, seconds_to_path_element(startTime, true)],
    [/%e/g, seconds_to_path_element(endTime)],
    [/%E/g, seconds_to_path_element(endTime, true)],
    [/%T/g, mp.get_property("media-title")],
    [
      /%M/g,
      mp.get_property_native("aid") &&
      !mp.get_property_native("mute") &&
      hasAudioCodec
        ? "-audio"
        : "",
    ],
    [
      /%R/g,
      options.scale_height !== -1
        ? `-${options.scale_height}p`
        : `-${mp.get_property_native("height")}p`,
    ],
    [/%mb/g, options.target_filesize / 1000],
    [/%t%/g, "%"],
  ];

  let filename = options.output_template;
  for (const [format, value] of REPLACE_FIRST) {
    filename = filename.replace(format, value);
  }
  for (const [format, value] of replaceTable) {
    filename = filename.replace(format, value);
  }

  if (mp.get_property_bool("demuxer-via-network", false)) {
    filename = filename.replace(/%X{([^}]*)}/g, "$1");
    filename = filename.replace(/%x/g, "");
  } else {
    const f = mp.get_property("filename", "");
    let x = mp.get_property("stream-open-filename", "");
    if (endsWith(x, f)) {
      x = x.slice(0, -f.length);
    }
    filename = filename.replace(/%X{[^}]*}/g, x);
    filename = filename.replace(/%x/g, x);
  }

  filename = expand_properties(filename, "%");

  // Time expansion
  const formats = matchAll(
    filename,
    /%t([aAbBcCdDeFgGhHIjmMnprRStTuUVwWxXyYzZ])/g
  );
  for (const match of formats) {
    const format = match[1];
    // XXX: gsub in Lua, but single replace should be enough?
    filename = filename.replace("%t" + format, lua_os_date("%" + format));
  }

  // Remove invalid chars
  // Windows: < > : " / \ | ? *
  // Linux: /
  filename = filename.replace(/[<>:"\/\\|?*]/g, "");

  return `${filename}.${videoFormat.outputExtension}`;
}

export function parse_directory(dir: string) {
  let home_dir = mp.utils.getenv("HOME");
  if (!home_dir) {
    // Windows home dir is obtained by USERPROFILE, or, if it fails, HOMEDRIVE + HOMEPATH
    home_dir = mp.utils.getenv("USERPROFILE");
  }

  if (!home_dir) {
    const drive = mp.utils.getenv("HOMEDRIVE");
    const path = mp.utils.getenv("HOMEPATH");
    if (drive && path) {
      home_dir = mp.utils.join_path(drive, path);
    } else {
      mp.msg.warn("Couldn't find home dir.");
      home_dir = "";
    }
  }

  dir = dir.replace(/^~/, home_dir);
  return dir;
}

// FIXME: is that reliable?
const is_windows = (mp.utils.getcwd() || "")[0] !== "/";

// function get_null_path() {
//   if (file_exists("/dev/null")) {
//     return "/dev/null";
//   }
//   return "NUL";
// }

// FIXME: mp.command_native
export function run_subprocess(params: any) {
  const res = mp.utils.subprocess(params);
  mp.msg.verbose("Command stdout: ");
  mp.msg.verbose(res.stdout);
  if (res.status !== 0) {
    mp.msg.verbose(
      "Command failed! Reason: ",
      res.error,
      " Killed by us? ",
      res.killed_by_us ? "yes" : "no"
    );
    return false;
  }
  return true;
}

function shell_escape(args: string[]) {
  const ret: string[] = [];
  for (const a of args) {
    let s = a + "";
    if (/[^A-Za-z0-9_/:=-]/.test(s)) {
      // Single quotes for UNIX, double quotes for Windows.
      if (is_windows) {
        s = '"' + s.replace(/"/g, '"\\""') + '"';
      } else {
        s = "'" + s.replace(/'/g, "'\\''") + "'";
      }
    }
    ret.push(s);
  }
  let concat = ret.join(" ");
  if (is_windows) {
    // Add a second set of double-quotes because idk it works
    concat = '"' + concat + '"';
  }
  return concat;
}

// FIXME: port
function lua_io_popen(_command_line: string): any {
  throw new Error("not implemented");
}

export function run_subprocess_popen(command_line: string[]) {
  let command_line_string = shell_escape(command_line);
  // Redirect stderr to stdout, because for some reason
  // the progress is outputted to stderr???
  command_line_string += " 2>&1";
  mp.msg.verbose(`run_subprocess_popen: running ${command_line_string}`);
  return lua_io_popen(command_line_string);
}

export function calculate_scale_factor() {
  const baseResY = 720;
  const { height } = mp.get_osd_size();
  return height / baseResY;
}

export function should_display_progress() {
  if (options.display_progress === "auto") {
    return !is_windows;
  }
  return options.display_progress;
}

export function get_pass_logfile_path(encode_out_path: string) {
  return `${encode_out_path}-video-pass1.log`;
}

export function remove_file(_path: string) {
  // FIXME: implement via subprocess("rm", ...)?
  // FIXME: report to mpv
}
