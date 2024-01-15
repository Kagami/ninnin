import { getCaps } from "./caps";
import { ObjectFromEntries } from "./lib/polyfills";
import options from "./options";

// A basic format class, which specifies some fields to be set by child classes.
export class Format {
  protected displayName = "";
  public videoCodec = "";
  public audioCodec = "";
  public outputExtension = "";
  public twoPassRequired = false; // libvpx/libaom have better resulting quality with 2-pass

  getDisplayName() {
    return this.displayName;
  }

  // Filters that should be applied before the transformations we do (crop, scale)
  // Should be a array of ffmpeg filters e.g. {"colormatrix=bt709", "sub"}.
  getPreFilters() {
    return [] as string[];
  }

  // Similar to getPreFilters, but after our transformations.
  getPostFilters() {
    return [] as string[];
  }

  // A list of flags, to be appended to the command line.
  getPostFlags() {
    return [] as string[];
  }

  // Video codec flags
  getVideoFlags() {
    return [`--ovc=${this.videoCodec}`];
  }
  getVideoQualityFlags() {
    // FIXME: is it ok to use global options here?
    return [`--ovcopts-add=crf=${options.crf}`];
  }

  // Audio codec flags
  getAudioFlags() {
    return [`--oac=${this.audioCodec}`];
  }

  // Method to modify commandline arguments just before the command is executed
  // postCommandModifier(
  //   command: string[],
  //   region: Region,
  //   startTime: number,
  //   endTime: number
  // ) {
  //   return command;
  // }
}

class X264 extends Format {
  public videoCodec = "libx264";
  public audioCodec = "aac";
  public outputExtension = "mp4";

  getDisplayName(): string {
    return getCaps().has_aac_at ? "x264/aac_at" : "x264/aac";
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.x264_preset}`,
    ];
  }

  getAudioFlags() {
    if (getCaps().has_aac_at) {
      // FIXME: TVBR vs CVBR?
      return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
    } else {
      return ["--oac=aac"];
    }
  }

  getPostFlags() {
    return ["--ofopts-add=movflags=+faststart"];
  }
}

class X265 extends X264 {
  public videoCodec = "libx265";

  getDisplayName() {
    return getCaps().has_aac_at ? "x265/aac_at" : "x265/aac";
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.x265_preset}`,
    ];
  }

  getPostFilters() {
    // Quality should be a bit better with Main10 profile even on 8bit content.
    // FIXME: is that no-op in case of 10bit content?
    // FIXME: maybe should be before scale for better quality or resize?
    return ["format=yuv420p10le"];
  }
}

export const formats: [string, Format][] = [
  ["x264", new X264()],
  ["x265", new X265()],
];
export const formatByName = ObjectFromEntries(formats);

export function getCurrentFormat() {
  return formatByName[options.output_format];
}
