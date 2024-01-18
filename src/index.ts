import "./lib/global";
import options from "./options";
import { monitor_dimensions } from "./video-to-screen";
import MainPage from "./page/main-page";
import { mainEncoding } from "./encode/script";

function mainInteractive() {
  mp.options.read_options(options);

  monitor_dimensions();
  const mainPage = new MainPage();
  mp.add_key_binding(options.keybind, mainPage.show.bind(mainPage));
  mp.register_event(
    "file-loaded",
    mainPage.setupStartAndEndTimes.bind(mainPage)
  );

  mp.msg.verbose("Loaded ninnin script");
  // emit_event("script-loaded");
}

const encodingLogPath = mp.get_opt("ninnin-encoding");
if (encodingLogPath) {
  mainEncoding(encodingLogPath);
} else {
  mainInteractive();
}
