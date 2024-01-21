import options, { type Options, saveOptions, resetOptions } from "../options";
import { formats } from "../encode/formats";
import { ArrayEntries, ObjectEntries, ObjectFromEntries } from "../lib/helpers";
import {
  type EncOption,
  EncOptionBool,
  EncOptionInt,
  EncOptionList,
  type EncOptionListOpts as ListOpts,
} from "./enc-option";
import Page from "./page";
import Ass from "../lib/ass";

export default class EncodeOptionsPage extends Page {
  private currentOption = 0;
  private options: [keyof Options, EncOption<any, any>][];
  private optionByName: { [key: string]: EncOption<any, any> };

  constructor(private callback: () => void) {
    super();

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
    const audiobOpts = {
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

    const xPresetOpts: ListOpts<string> = [
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
    const svtPresetOpts = {
      step: 1,
      min: 0,
      max: 12,
    };
    const xCrfOpts = {
      step: 1,
      min: 0,
      max: 51,
    };
    const vtbCrfOpts = {
      step: 1,
      min: 0,
      max: 100,
    };
    const av1CrfOpts = {
      step: 1,
      min: 0,
      max: 63,
    };

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

      ["x264_preset", new EncOptionList("Preset", options.x264_preset, xPresetOpts, () => this.x264Selected())],
      ["x265_preset", new EncOptionList("Preset", options.x265_preset, xPresetOpts, () => this.x265Selected())],
      ["svtav1_preset", new EncOptionInt("Preset", options.svtav1_preset, svtPresetOpts, () => this.svtav1Selected())],

      ["x_crf", new EncOptionInt("Video quality", options.x_crf, xCrfOpts, () => this.xCrfVisible())],
      ["vtb_crf", new EncOptionInt("Video quality", options.vtb_crf, vtbCrfOpts, () => this.vtbCrfVisible())],
      ["av1_crf", new EncOptionInt("Video quality", options.av1_crf, av1CrfOpts, () => this.av1CrfVisible())],

      ["audio_bitrate", new EncOptionInt("Audio bitrate", options.audio_bitrate, audiobOpts)],
      ["fps", new EncOptionList("FPS", options.fps, fpsOpts)],
      ["force_10bit", new EncOptionBool("Force 10-bit", options.force_10bit, null)],

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
      s: this.saveOpts.bind(this),
      r: this.resetOpts.bind(this),
    };
  }

  formatName(): string {
    return this.optionByName.output_format.getValue();
  }
  filesize() {
    return this.optionByName.target_filesize.getValue();
  }
  x264Selected() {
    return this.formatName() === "x264";
  }
  x265Selected() {
    return this.formatName() === "x265";
  }
  svtav1Selected() {
    return this.formatName() === "svtav1";
  }
  xCrfVisible() {
    return (this.x264Selected() || this.x265Selected()) && !this.filesize();
  }
  vtbCrfVisible() {
    return this.formatName() === "hevc_vtb" && !this.filesize();
  }
  av1CrfVisible() {
    return this.svtav1Selected() && !this.filesize();
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

  applyOpts() {
    for (const [optName, opt] of this.options) {
      options[optName] = opt.getValue() as never;
    }
  }

  confirmOpts() {
    this.applyOpts();
    this.hide();
    this.callback();
  }

  cancelOpts() {
    this.hide();
    this.callback();
  }

  saveOpts() {
    this.applyOpts();
    saveOptions();
    this.hide();
    this.callback();
  }

  resetOpts() {
    resetOptions();
    for (const [key, value] of ObjectEntries(options)) {
      const opt = this.optionByName[key];
      if (opt) {
        opt.setValue(value);
      }
    }
    this.currentOption = 0;
    this.draw();
  }

  draw() {
    const { width: window_w, height: window_h } = mp.get_osd_size()!;
    const ass = new Ass();
    ass.new_event();
    this.setup_text(ass);
    ass.append_2nl(`${ass.bold("ninnin options")}`);
    for (const [i, optPair] of ArrayEntries(this.options)) {
      const opt = optPair[1];
      if (opt.optVisible()) {
        opt.draw(ass, this.currentOption === i);
      }
    }
    ass.append_nl("\\N▲ / ▼: navigate");
    ass.append_nl(`${ass.bold("ENTER:")} confirm`);
    ass.append_nl(`${ass.bold("ESC:")} cancel`);
    ass.append_nl(`${ass.bold("s:")} save options`);
    ass.append_nl(`${ass.bold("r:")} reset options`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }
}
