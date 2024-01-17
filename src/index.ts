import "mpv-promise";

import "./lib/global";
import options from "./options";
import { monitor_dimensions } from "./video-to-screen";
import MainPage from "./page/main-page";

function mainInteractive() {
  mp.options.read_options(options);

  monitor_dimensions();
  const mainPage = new MainPage();
  mp.add_key_binding(
    options.keybind,
    "display-ninnin",
    mainPage.show.bind(mainPage),
    {
      repeatable: false,
    }
  );
  mp.register_event(
    "file-loaded",
    mainPage.setupStartAndEndTimes.bind(mainPage)
  );

  mp.msg.verbose("Loaded ninnin script");
  // emit_event("script-loaded");
}

function mainEncoding(logPath: string) {
  setInterval(function () {
    mp.utils.write_file("file://" + logPath, mp.get_property("time-pos", "-1"));
  }, 500);
}

const encodingLogPath = mp.get_opt("ninnin-encoding");
if (encodingLogPath) {
  mainEncoding(encodingLogPath);
} else {
  mainInteractive();
}
