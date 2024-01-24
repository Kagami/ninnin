import Ass from "../lib/ass";
import options from "../options";
import { ObjectEntries } from "../lib/helpers";
import { calculate_scale_factor } from "../utils";

export default class Page {
  protected keybinds?: { [key: string]: () => void };
  protected visible = false;
  private sizeCallback?: () => void;

  // abstract
  draw() {}
  prepare() {}
  dispose() {}

  add_keybinds() {
    if (!this.keybinds) return;
    for (const [key, func] of ObjectEntries(this.keybinds)) {
      mp.add_forced_key_binding(key, key, func, { repeatable: true });
    }
  }

  remove_keybinds() {
    if (!this.keybinds) return;
    for (const key of Object.keys(this.keybinds)) {
      mp.remove_key_binding(key);
    }
  }

  observe_properties() {
    // We can't just pass the self\draw! function as it's resolved to a closure
    // internally, and closures can't be unobserved.
    this.sizeCallback = () => {
      this.draw();
    };
    // This is the same list of properties used in CropPage.
    // It might be a good idea to somehow unite those observers.
    const properties = [
      "keepaspect",
      "video-out-params",
      "video-unscaled",
      "panscan",
      "video-zoom",
      "video-align-x",
      "video-pan-x",
      "video-align-y",
      "video-pan-y",
      "osd-width",
      "osd-height",
    ];
    for (const p of properties) {
      mp.observe_property(p, "native", this.sizeCallback);
    }
  }

  unobserve_properties() {
    if (this.sizeCallback) {
      mp.unobserve_property(this.sizeCallback);
    }
    this.sizeCallback = undefined;
  }

  clear() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    mp.set_osd_ass(window_w, window_h, "");
    mp.osd_message("", 0);
  }

  show() {
    if (this.visible) return;

    this.visible = true;
    this.observe_properties();
    this.add_keybinds();
    this.prepare();
    this.clear();
    this.draw();
  }

  hide() {
    if (!this.visible) return;

    this.visible = false;
    this.unobserve_properties();
    this.remove_keybinds();
    this.clear();
    this.dispose();
  }

  setup_text(ass: Ass) {
    const scale = calculate_scale_factor();
    const margin = options.margin * scale;
    ass.append("{\\an7}");
    ass.pos(margin, margin);
    ass.append(`{\\fs${options.font_size * scale}}`);
  }

  setup_ass(): Ass {
    const ass = new Ass();
    ass.new_event();
    this.setup_text(ass);
    return ass;
  }
}
