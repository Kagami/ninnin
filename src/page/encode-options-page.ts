import AssDraw from "../lib/assdraw";
import { formats } from "../formats";
import options, { type Options } from "../options";
import { ArrayEntries } from "../lib/polyfills";
import { bold } from "../utils";
import {
  type EncOption,
  // EncOptionBool,
  EncOptionInt,
  EncOptionList,
  type EncOptionListOpts as ListOpts,
} from "./encode-option";
import Page from "./page";

export default class EncodeOptionsPage extends Page {
  private currentOption = 0;
  private callback: (updated: boolean) => void;
  private options: [keyof Options, EncOption<any, any>][];

  constructor(callback: (updated: boolean) => void) {
    super();
    this.callback = callback;

    const scaleHeightOpts: ListOpts<number> = [
      [-1, "no"],
      [144],
      [240],
      [360],
      [480],
      [540],
      [720],
      [1080],
      [1440],
      [2160],
    ];

    const filesizeOpts = {
      step: 250,
      min: 0,
      altDisplayNames: {
        "0": "0 (constant quality)",
      },
    };

    const crfOpts = {
      step: 1,
      min: -1,
      altDisplayNames: {
        "-1": "disabled",
      },
    };

    const fpsOpts: ListOpts<number> = [
      [-1, "source"],
      [15],
      [24],
      [30],
      [48],
      [50],
      [60],
      [120],
      [240],
    ];

    const formatOpts: ListOpts<string> = formats.map((v) => [
      v[0],
      v[1].displayName,
    ]);

    // const gifDitherOpts: ListOpts<number> = [
    //   [0, "bayer_scale 0"],
    //   [1, "bayer_scale 1"],
    //   [2, "bayer_scale 2"],
    //   [3, "bayer_scale 3"],
    //   [4, "bayer_scale 4"],
    //   [5, "bayer_scale 5"],
    //   [6, "sierra2_4a"],
    // ];

    // TODO: can we enforce same type for options[key] and EncOption.value?
    // prettier-ignore
    this.options = [
      ["output_format", new EncOptionList("Output Format", options.output_format, formatOpts)],
      ["scale_height", new EncOptionList("Scale Height", options.scale_height, scaleHeightOpts)],
      ["target_filesize", new EncOptionInt("Target Filesize", options.target_filesize, filesizeOpts)],
      ["crf", new EncOptionInt("CRF", options.crf, crfOpts)],
      ["fps", new EncOptionList("FPS", options.fps, fpsOpts)],
      // ["apply_current_filters", new EncOptionBool("Apply Current Video Filters", options.apply_current_filters, null)],
      // ["gif_dither", new EncOptionList("GIF Dither Type", options.gif_dither, gifDitherOpts, () => this.options[0][1].getValue() === "gif")],
      // ["force_square_pixels", new EncOptionBool("Force Square Pixels", options.force_square_pixels, null)],
    ]

    this.keybinds = {
      LEFT: this.leftKey.bind(this),
      RIGHT: this.rightKey.bind(this),
      UP: this.prevOpt.bind(this),
      DOWN: this.nextOpt.bind(this),
      ENTER: this.confirmOpts.bind(this),
      ESC: this.cancelOpts.bind(this),
    };
  }

  getCurrentOption() {
    return this.options[this.currentOption][1];
  }

  leftKey() {
    this.getCurrentOption().leftKey();
    this.draw();
  }

  rightKey() {
    this.getCurrentOption().rightKey();
    this.draw();
  }

  prevOpt() {
    for (let i = this.currentOption - 1; i >= 0; i--) {
      if (this.options[i][1].optVisible()) {
        this.currentOption = i;
        break;
      }
    }
    this.draw();
  }

  nextOpt() {
    for (let i = this.currentOption + 1; i < this.options.length; i++) {
      if (this.options[i][1].optVisible()) {
        this.currentOption = i;
        break;
      }
      this.draw();
    }
  }

  confirmOpts() {
    for (const [optName, opt] of this.options) {
      // Set the global options object.
      options[optName] = opt.getValue() as never;
    }
    this.hide();
    this.callback(true);
  }

  cancelOpts() {
    this.hide();
    this.callback(false);
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size();
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    ass.append(`${bold("Options:")}\\N\\N`);
    for (const [i, optPair] of ArrayEntries(this.options)) {
      const opt = optPair[1];
      if (opt.optVisible()) {
        opt.draw(ass, this.currentOption === i);
      }
    }
    ass.append("\\N▲ / ▼: navigate\\N");
    ass.append(`${bold("ENTER:")} confirm options\\N`);
    ass.append(`${bold("ESC:")} cancel\\N`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }
}
