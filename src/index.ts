import "mpv-promise";

import "./lib/global";
import options from "./options";
import { monitor_dimensions } from "./video-to-screen";
import MainPage from "./page/main-page";

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
mp.register_event("file-loaded", mainPage.setupStartAndEndTimes.bind(mainPage));

mp.msg.verbose("Loaded ninnin script");
// emit_event("script-loaded");
