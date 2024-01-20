import { getCaps } from "../caps";
import { ObjectFromEntries } from "../lib/helpers";
import options from "../options";

// A basic format class, which specifies some fields to be set by child classes.
export class Format {
  protected displayName = "";
  videoCodec = "";
  audioCodec = "";
  outputExtension = "";
  twoPassSupported = true;
  twoPassPreferable = false; // libvpx/libaom have better resulting quality with 2-pass

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

  // Container-specific flags
  getMuxerFlags() {
    return [] as string[];
  }

  // Two pass routines
  protected getPassLogPath(outPath: string) {
    const [dir, fname] = mp.utils.split_path(outPath);
    // custom log path for x264, x265
    const logName = `.ninnin-${fname}.passlog`;
    return mp.utils.join_path(dir, logName);
  }
  protected getPassCommonFlags(_outPath: string) {
    return [] as string[];
  }
  getPass0Flags(_outPath: string) {
    return [] as string[]; // flags for normal single pass mode
  }
  getPass1Flags(outPath: string) {
    return ["--ovcopts-add=flags=+pass1", ...this.getPassCommonFlags(outPath)];
  }
  getPass2Flags(outPath: string) {
    return ["--ovcopts-add=flags=+pass2", ...this.getPassCommonFlags(outPath)];
  }
  getPassFilePaths(outPath: string) {
    // created by mpv (empty in case of x264, x265)
    return [`${outPath}-video-pass1.log`];
  }
}

class X264 extends Format {
  videoCodec = "libx264";
  audioCodec = "aac";
  outputExtension = "mp4";

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

  getMuxerFlags() {
    return ["--ofopts-add=movflags=+faststart"];
  }

  getPassCommonFlags(outPath: string) {
    // specify passlog path for x264
    return [`--ovcopts-add=stats=${this.getPassLogPath(outPath)}`];
  }
  getPassFilePaths(outPath: string) {
    const pathMain = super.getPassLogPath(outPath); // normal log
    const pathMBtree = pathMain + ".mbtree"; // additional mbtree log
    const pathMainTemp = pathMain + ".temp"; // during pass1 run
    const pathMBtreeTemp = pathMBtree + ".temp"; // during pass1 run
    return super
      .getPassFilePaths(outPath)
      .concat([pathMain, pathMBtree, pathMainTemp, pathMBtreeTemp]);
  }
}

class X265 extends Format {
  videoCodec = "libx265";
  audioCodec = "aac";
  outputExtension = "mp4";

  getDisplayName() {
    return getCaps().has_aac_at ? "x265/aac_at" : "x265/aac";
  }

  getPostFilters() {
    // Quality should be a bit better with Main10 profile even on 8bit content.
    // FIXME: is that no-op in case of 10bit content?
    // FIXME: maybe should be before scale for better quality or resize?
    return ["format=yuv420p10le"];
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.x265_preset}`,
      `--ovcopts-add=codec_tag=0x31637668`, // hvc1 tag, for compatibility with Apple devices
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

  getMuxerFlags() {
    return ["--ofopts-add=movflags=+faststart"];
  }

  private getCommonX265Params() {
    return ["log-level=warning"];
  }
  private mergeX265Params(...params: string[]) {
    params = this.getCommonX265Params().concat(params);
    return "--ovcopts-add=x265-params=" + params.join(":");
  }

  // XXX: hackish method to merge all flags we need into single x265-params
  getPass0Flags(_outPath: string): string[] {
    return [this.mergeX265Params()];
  }
  getPass1Flags(outPath: string) {
    return [
      ...super.getPass1Flags(outPath),
      this.mergeX265Params("pass=1", `stats=${this.getPassLogPath(outPath)}`),
    ];
  }
  getPass2Flags(outPath: string) {
    return [
      ...super.getPass2Flags(outPath),
      this.mergeX265Params("pass=2", `stats=${this.getPassLogPath(outPath)}`),
    ];
  }
  getPassFilePaths(outPath: string) {
    const pathMain = this.getPassLogPath(outPath); // normal log
    const pathCUtree = pathMain + ".cutree"; // additional cutree log
    const pathMainTemp = pathMain + ".temp"; // during pass1 run
    const pathCUtreeTemp = pathCUtree + ".temp"; // during pass1 run
    return super
      .getPassFilePaths(outPath)
      .concat([pathMain, pathCUtree, pathMainTemp, pathCUtreeTemp]);
  }
}

class HEVC_VTB extends Format {
  protected displayName = "hevc_vtb/aac_at";
  videoCodec = "hevc_videotoolbox";
  audioCodec = "aac";
  outputExtension = "mp4";
  twoPassSupported = false; // FIXME: check
  private readonly FF_QP2LAMBDA = 118;

  getPostFilters() {
    return ["format=p010le"];
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=codec_tag=0x31637668`, // hvc1 tag, for compatibility with Apple devices
    ];
  }
  getVideoQualityFlags() {
    if (options.vtb_qscale < 0) return [];
    return [
      `--ovcopts-add=global_quality=${options.vtb_qscale * this.FF_QP2LAMBDA}`,
      "--ovcopts-add=flags=+qscale",
    ];
  }

  getAudioFlags() {
    return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
  }

  getMuxerFlags() {
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
