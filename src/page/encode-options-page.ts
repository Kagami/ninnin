import AssDraw from "../assdraw";
import { formats } from "../formats";
import options, { type Options } from "../options";
import { bold } from "../utils";
import Page from "./page";

interface EncOptionType {
  min?: number;
  max?: number;
  step?: number;
  // FIXME: object intead of tuple?
  possibleValues?: (readonly [number] | readonly [number | string, string])[];
  altDisplayNames?: { [key: string]: string };
}

type VisibleCheckFn = () => boolean;

export type EncOptsCallbackFn = (updated: boolean) => void;

class EncOption {
  // If optType is a "bool" or an "int", @value is the boolean/integer value of the option.
  // Additionally, when optType is an "int":
  //     - opts.step specifies the step on which the values are changed.
  //     - opts.min specifies a minimum value for the option.
  //     - opts.max specifies a maximum value for the option.
  //     - opts.altDisplayNames is a int->string dict, which contains alternative display names
  //       for certain values.
  // If optType is a "list", @value is the index of the current option, inside opts.possibleValues.
  // opts.possibleValues is a array in the format
  // {
  //		{value, displayValue}, -- Display value can be omitted.
  // 		{value}
  // }
  // setValue will be called for the constructor argument.
  // visibleCheckFn is a function to check for visibility, it can be used to hide options based on rules
  private optType: string;
  private displayText: string;
  private value: number | boolean | string; // FIXME: subclasses
  private opts: EncOptionType;
  private visibleCheckFn: VisibleCheckFn | null;

  constructor(
    optType: string,
    displayText: string,
    value: number | boolean | string,
    opts: EncOptionType = {},
    visibleCheckFn: VisibleCheckFn | null = null
  ) {
    this.optType = optType;
    this.displayText = displayText;
    this.value = 0;
    this.opts = opts;
    this.visibleCheckFn = visibleCheckFn;
    this.setValue(value);
  }

  // Whether we have a "previous" option (for left key)
  hasPrevious() {
    switch (this.optType) {
      case "bool":
        return true;
      case "int":
        if (this.opts.min) {
          return (this.value as number) > this.opts.min;
        } else {
          return true;
        }
      case "list":
        return (this.value as number) > 0;
    }
    throw new Error("Invalid option type");
  }

  // Analogous of hasPrevious.
  hasNext() {
    switch (this.optType) {
      case "bool":
        return true;
      case "int":
        if (this.opts.max) {
          return (this.value as number) < this.opts.max;
        } else {
          return true;
        }
      case "list":
        return (this.value as number) < this.opts.possibleValues!.length - 1;
    }
    throw new Error("Invalid option type");
  }

  leftKey() {
    switch (this.optType) {
      case "bool":
        this.value = !this.value;
        break;
      case "int":
        (this.value as number) -= this.opts.step!;
        if (this.opts.min && this.opts.min > (this.value as number)) {
          this.value = this.opts.min;
        }
        break;
      case "list":
        if ((this.value as number) > 0) {
          (this.value as number) -= 1;
        }
        break;
    }
    throw new Error("Invalid option type");
  }

  rightKey() {
    switch (this.optType) {
      case "bool":
        this.value = !this.value;
        break;
      case "int":
        (this.value as number) += this.opts.step!;
        if (this.opts.max && this.opts.max < (this.value as number)) {
          this.value = this.opts.max;
        }
        break;
      case "list":
        if ((this.value as number) < this.opts.possibleValues!.length - 1) {
          (this.value as number) += 1;
        }
        break;
    }
    throw new Error("Invalid option type");
  }

  getValue() {
    switch (this.optType) {
      case "bool":
        return this.value;
      case "int":
        return this.value;
      case "list":
        return this.opts.possibleValues![this.value as number][0];
    }
    throw new Error("Invalid option type");
  }

  setValue(value: number | boolean | string) {
    switch (this.optType) {
      case "bool":
        this.value = value;
        break;
      case "int":
        // TODO Should we obey opts.min/max? Or just trust the script to do the right thing(tm)?
        this.value = value;
        break;
      case "list": {
        let set = false;
        // TODO: use ES6 Array.prototype.entries
        for (let i = 0; i < this.opts.possibleValues!.length; i++) {
          const possibleValue = this.opts.possibleValues![i][0];
          if (possibleValue === value) {
            set = true;
            this.value = i;
            break;
          }
        }
        if (!set) {
          mp.msg.warn(
            `Tried to set invalid value ${value} to ${this.displayText} option.`
          );
        }
        break;
      }
    }
  }

  getDisplayValue() {
    switch (this.optType) {
      case "bool":
        return this.value ? "yes" : "no";
      case "int":
        if (
          this.opts.altDisplayNames &&
          this.opts.altDisplayNames[this.value as number]
        ) {
          return this.opts.altDisplayNames[this.value as number];
        } else {
          return this.value + "";
        }
      case "list":
        return (
          this.opts.possibleValues![this.value as number][1] ||
          this.opts.possibleValues![this.value as number][0] + ""
        );
    }
    throw new Error("Invalid option type");
  }

  draw(ass: AssDraw, selected: boolean) {
    if (selected) {
      ass.append(`${bold(this.displayText)}: `);
    } else {
      ass.append(`${this.displayText}: `);
    }
    // left arrow unicode
    if (this.hasPrevious()) {
      ass.append("◀ ");
    }
    ass.append(this.getDisplayValue()!);
    // right arrow unicode
    if (this.hasNext()) {
      ass.append(" ▶");
    }
    ass.append("\\N");
  }

  // Check if this option should be visible by calling its visibleCheckFn
  optVisible() {
    if (!this.visibleCheckFn) return true;
    return this.visibleCheckFn();
  }
}

export default class EncodeOptionsPage extends Page {
  private currentOption = 0;
  private callback: EncOptsCallbackFn;
  private options: [string, EncOption][];

  constructor(callback: EncOptsCallbackFn) {
    super();
    this.callback = callback;

    // TODO this shouldn't be here.
    const scaleHeightOpts = {
      possibleValues: [
        [-1, "no"] as const,
        [144] as const,
        [240] as const,
        [360] as const,
        [480] as const,
        [540] as const,
        [720] as const,
        [1080] as const,
        [1440] as const,
        [2160] as const,
      ],
    };
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

    const fpsOpts = {
      possibleValues: [
        [-1, "source"] as const,
        [15] as const,
        [24] as const,
        [30] as const,
        [48] as const,
        [50] as const,
        [60] as const,
        [120] as const,
        [240] as const,
      ],
    };

    // I really dislike hardcoding this here, but, as said below, order in dicts isn't
    // guaranteed, and we can't use the formats dict keys.
    // FIXME: refactor
    // const formatIds = ["av1", "hevc", "webm-vp9", "avc", "avc-nvenc", "webm-vp8", "gif", "mp3", "raw"]
    const formatOpts = {
      possibleValues: [["avc", formats.avc.displayName] as const],
    };

    const gifDitherOpts = {
      possibleValues: [
        [0, "bayer_scale 0"] as const,
        [1, "bayer_scale 1"] as const,
        [2, "bayer_scale 2"] as const,
        [3, "bayer_scale 3"] as const,
        [4, "bayer_scale 4"] as const,
        [5, "bayer_scale 5"] as const,
        [6, "sierra2_4a"] as const,
      ],
    };

    // This could be a dict instead of a array of pairs, but order isn't guaranteed
    // by dicts on Lua.
    // prettier-ignore
    this.options = [
      ["output_format", new EncOption("list", "Output Format", options.output_format, formatOpts)],
      ["twopass", new EncOption("bool", "Two Pass", options.twopass)],
      ["apply_current_filters", new EncOption("bool", "Apply Current Video Filters", options.apply_current_filters)],
      ["scale_height", new EncOption("list", "Scale Height", options.scale_height, scaleHeightOpts)],
      ["strict_filesize_constraint", new EncOption("bool", "Strict Filesize Constraint", options.strict_filesize_constraint)],
      ["write_filename_on_metadata", new EncOption("bool", "Write Filename on Metadata", options.write_filename_on_metadata)],
      ["target_filesize", new EncOption("int", "Target Filesize", options.target_filesize, filesizeOpts)],
      ["crf", new EncOption("int", "CRF", options.crf, crfOpts)],
      ["fps", new EncOption("list", "FPS", options.fps, fpsOpts)],
      ["gif_dither", new EncOption("list", "GIF Dither Type", options.gif_dither, gifDitherOpts, () => this.options[0][1].getValue() === "gif")],
      ["force_square_pixels", new EncOption("bool", "Force Square Pixels", options.force_square_pixels)],
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
      options[optName as keyof Options] = opt.getValue() as never; // FIXME: better types
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
    // TODO: use ES6 Array.prototype.entries
    this.options.forEach((optPair, i) => {
      const opt = optPair[1];
      if (opt.optVisible()) {
        opt.draw(ass, this.currentOption === i);
      }
    });
    ass.append("\\N▲ / ▼: navigate\\N");
    ass.append(`${bold("ENTER:")} confirm options\\N`);
    ass.append(`${bold("ESC:")} cancel\\N`);
    mp.set_osd_ass(window_w, window_h, ass.text);
  }
}
