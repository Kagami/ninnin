import AssDraw from "mpv-assdraw";

import { formats } from "../encode/formats";
import options, { type Options } from "../options";
import { ArrayEntries, ObjectFromEntries } from "../lib/helpers";
import { bold } from "../utils";
import {
  type EncOption,
  EncOptionBool,
  EncOptionInt,
  EncOptionList,
  type EncOptionListOpts as ListOpts,
} from "./encode-option";
import Page from "./page";

export default class EncodeOptionsPage extends Page {
  private currentOption = 0;
  private callback: (updated: boolean) => void;
  private options: [keyof Options, EncOption<any, any>][];
  private optionByName: { [key: string]: EncOption<any, any> };

  constructor(callback: (updated: boolean) => void) {
    super();
    this.callback = callback;

    const formatOpts: ListOpts<string> = formats.map((v) => [
      v[0],
      v[1].getDisplayName(),
    ]);
    const scaleHeightOpts: ListOpts<number> = [
      [-1, "source"],
      [360],
      [480],
      [720],
      [1080],
      [1440],
      [2160],
    ];
    const filesizeOpts = {
      step: 512,
      min: 0,
      altDisplayNames: {
        "0": "quality",
      },
    };
    const presetOpts: ListOpts<string> = [
      ["ultrafast"],
      ["superfast"],
      ["veryfast"],
      ["faster"],
      ["fast"],
      ["medium"],
      ["slow"],
      ["slower"],
      ["veryslow"],
      ["placebo"],
    ];
    const crfOpts = {
      step: 1,
      min: 0,
      max: 51,
    };
    const vtbOpts = {
      step: 1,
      min: 0,
      max: 100,
    };
    const abOpts = {
      step: 64,
      min: 64,
      max: 320,
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
      ["output_format", new EncOptionList("Codec", options.output_format, formatOpts)],
      ["scale_height", new EncOptionList("Height", options.scale_height, scaleHeightOpts)],
      ["target_filesize", new EncOptionInt("File size", options.target_filesize, filesizeOpts)],

      ["x264_preset", new EncOptionList("Preset", options.x264_preset, presetOpts, () => this.shownX264Opts())],
      ["x265_preset", new EncOptionList("Preset", options.x265_preset, presetOpts, () => this.shownX265Opts())],

      ["crf", new EncOptionInt("Video quality", options.crf, crfOpts, () => this.shownCrfOpt())],
      ["vtb_qscale", new EncOptionInt("Video quality", options.vtb_qscale, vtbOpts, () => this.shownVtbOpt())],

      ["audio_bitrate", new EncOptionInt("Audio bitrate", options.audio_bitrate, abOpts)],
      ["fps", new EncOptionList("FPS", options.fps, fpsOpts)],

      ["write_metadata_title", new EncOptionBool("Write title", options.write_metadata_title, null)],
      // ["apply_current_filters", new EncOptionBool("Apply Current Video Filters", options.apply_current_filters, null)],
      // ["gif_dither", new EncOptionList("GIF Dither Type", options.gif_dither, gifDitherOpts, () => this.options[0][1].getValue() === "gif")],
      // ["force_square_pixels", new EncOptionBool("Force Square Pixels", options.force_square_pixels, null)],
    ]

    this.optionByName = ObjectFromEntries(this.options);

    this.keybinds = {
      LEFT: this.leftKey.bind(this),
      RIGHT: this.rightKey.bind(this),
      UP: this.prevOpt.bind(this),
      DOWN: this.nextOpt.bind(this),
      ENTER: this.confirmOpts.bind(this),
      ESC: this.cancelOpts.bind(this),
    };
  }

  formatOpt() {
    return this.optionByName.output_format.getValue();
  }
  filesizeOpt() {
    return this.optionByName.target_filesize.getValue();
  }
  shownX264Opts() {
    return this.formatOpt() === "x264";
  }
  shownX265Opts() {
    return this.formatOpt() === "x265";
  }
  shownCrfOpt() {
    return this.formatOpt() !== "hevc_vtb" && !this.filesizeOpt();
  }
  shownVtbOpt() {
    return this.formatOpt() === "hevc_vtb" && !this.filesizeOpt();
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
    if (this.currentOption === 0) {
      this.currentOption = this.options.length;
    }
    for (let i = this.currentOption - 1; i >= 0; i--) {
      if (this.options[i][1].optVisible()) {
        this.currentOption = i;
        break;
      }
    }
    this.draw();
  }

  nextOpt() {
    if (this.currentOption === this.options.length - 1) {
      this.currentOption = -1;
    }
    for (let i = this.currentOption + 1; i < this.options.length; i++) {
      if (this.options[i][1].optVisible()) {
        this.currentOption = i;
        break;
      }
    }
    this.draw();
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
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new AssDraw();
    ass.new_event();
    this.setup_text(ass);
    ass.append(`${bold("ninnin options")}\\N\\N`);
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
