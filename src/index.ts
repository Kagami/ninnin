import "./lib/global";
import options from "./options";
import MainPage from "./page/main-page";
import { mainEncoding } from "./encode/script";
import { trackDimensions } from "./video-to-screen";

// Don't init objects/handlers before requested for performance reasons.
let mainPage: MainPage | undefined;
function showMainPage() {
  if (mainPage) {
    mainPage.show();
    return;
  }
  trackDimensions();
  mainPage = new MainPage();
  mp.register_event("file-loaded", mainPage.updateStartEnd.bind(mainPage));
  mainPage.updateStartEnd();
  mainPage.show();
}

function mainInteractive() {
  mp.options.read_options(options);
  mp.add_key_binding(options.keybind, showMainPage);
  // mp.msg.verbose("Loaded ninnin script");
  // emit_event("script-loaded");
}

function main() {
  const encodingLogPath = mp.get_opt("ninnin-encoding");
  if (encodingLogPath) {
    mainEncoding(encodingLogPath);
  } else {
    mainInteractive();
  }
}

main();
