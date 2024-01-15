import { getCaps } from "./caps";
import { ObjectFromEntries } from "./lib/polyfills";
import options from "./options";

// A basic format class, which specifies some fields to be set by child classes.
export class Format {
  protected displayName = "";
  public videoCodec = "";
  public audioCodec = "";
  public outputExtension = "";
  public twoPassSupported = true;
  public twoPassPreferable = false; // libvpx/libaom have better resulting quality with 2-pass

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
    // set video bitrate to 0. This might enable constant quality, or some
    // other encoding modes, depending on the codec.
    // command.push(`--ovcopts-add=b=0`); FIXME: libvpx/libaom
    // FIXME: is it ok to use global options here?
    if (options.crf < 0) return [];
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

const FF_QP2LAMBDA = 118;
class HEVC_VTB extends Format {
  protected displayName = "hevc_vtb/aac_at";
  public videoCodec = "hevc_videotoolbox";
  public audioCodec = "aac";
  public outputExtension = "mp4";
  public twoPassSupported = false; // FIXME: check

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=codec_tag=0x31637668`, // hvc1 tag, for compatibility with Apple devices
    ];
  }
  getVideoQualityFlags() {
    if (options.vtb_qscale < 0) return [];
    return [
      `--ovcopts-add=global_quality=${options.vtb_qscale * FF_QP2LAMBDA}`,
      "--ovcopts-add=flags=+qscale",
    ];
  }

  getAudioFlags() {
    return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
  }

  getPostFilters() {
    return ["format=p010le"];
  }

  getPostFlags() {
    return ["--ofopts-add=movflags=+faststart"];
  }
}

export const formats: [string, Format][] = [
  ["x264", new X264()],
  ["x265", new X265()],
  ["hevc_vtb", new HEVC_VTB()],
];
export const formatByName = ObjectFromEntries(formats);

export function getCurrentFormat() {
  return formatByName[options.output_format];
}
