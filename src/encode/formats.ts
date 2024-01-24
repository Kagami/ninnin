import { getCaps } from "../caps";
import { ObjectFromEntries } from "../lib/helpers";
import options from "../options";

// A basic format class, which specifies some fields to be set by child classes.
export class Format {
  protected displayName = "";
  videoCodec = "";
  audioCodec = "";
  outputExtension = "mp4";
  twoPassSupported = true;
  highBitDepthSupported = true;
  hwAccelerated = false;
  metadataSupported = true;

  getDisplayName() {
    return this.displayName;
  }

  // Filters that should be applied before the transformations we do (crop, scale)
  // Should be a array of ffmpeg filters e.g. {"colormatrix=bt709", "sub"}.
  getPreFilters(): string[] {
    return [];
  }

  // Similar to getPreFilters, but after our transformations.
  getPostFilters() {
    // Quality should be a bit better with Main10 profile even on 8bit content.
    // FIXME: is that no-op in case of 10bit content?
    // FIXME: maybe should be before scale for better quality or resize?
    if (options.force_10bit && this.highBitDepthSupported) {
      if (this.hwAccelerated) {
        // like NV12 with 10bpp per component (packed)
        return ["format=p010le"];
      } else {
        return ["format=yuv420p10le"];
      }
    } else {
      return [];
    }
  }

  // Video codec flags
  getVideoFlags() {
    return [`--ovc=${this.videoCodec}`];
  }
  getVideoQualityFlags(): string[] {
    return [];
  }

  // Audio codec flags
  getAudioFlags() {
    return [`--oac=${this.audioCodec}`];
  }

  // Container-specific flags
  getMuxerFlags() {
    if (this.outputExtension === "mp4") {
      return ["--ofopts-add=movflags=+faststart"];
    } else {
      return [];
    }
  }

  // Two pass routines
  protected getPassLogPath(outPath: string) {
    const [dir, fname] = mp.utils.split_path(outPath);
    // custom log path for x264, x265
    const logName = `.ninnin-${fname}.passlog`;
    return mp.utils.join_path(dir, logName);
  }
  protected getPassCommonFlags(_outPath: string): string[] {
    return [];
  }
  getPass0Flags(_outPath: string): string[] {
    return []; // flags for normal single pass mode
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
  highBitDepthSupported = false; // High10 is too marginal

  getDisplayName(): string {
    return getCaps().has_aac_at ? "x264/aac_at" : "x264/aac";
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.x264_preset}`,
    ];
  }
  getVideoQualityFlags() {
    return [`--ovcopts-add=crf=${options.x_crf}`];
  }

  // FIXME: we use mp4 container, maybe copy AAC audio instead of re-encoding?
  // Although 192kbps should be almost transparent with AudioToolbox.
  getAudioFlags() {
    if (getCaps().has_aac_at) {
      // FIXME: TVBR vs CVBR?
      return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
    } else {
      return ["--oac=aac"];
    }
  }

  getPassCommonFlags(outPath: string) {
    // specify passlog path for x264
    return [`--ovcopts-add=stats=${this.getPassLogPath(outPath)}`];
  }
  getPassFilePaths(outPath: string) {
    const pathMain = this.getPassLogPath(outPath); // normal log
    const pathMBtree = pathMain + ".mbtree"; // additional mbtree log
    const pathMainTemp = pathMain + ".temp"; // during pass1 run
    const pathMBtreeTemp = pathMBtree + ".temp"; // during pass1 run
    return super
      .getPassFilePaths(outPath)
      .concat(pathMain, pathMBtree, pathMainTemp, pathMBtreeTemp);
  }
}

class X265 extends Format {
  videoCodec = "libx265";
  audioCodec = "aac";

  getDisplayName() {
    return getCaps().has_aac_at ? "x265/aac_at" : "x265/aac";
  }

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.x265_preset}`,
      `--ovcopts-add=codec_tag=0x31637668`, // hvc1 tag, for compatibility with Apple devices
    ];
  }
  getVideoQualityFlags() {
    return [`--ovcopts-add=crf=${options.x_crf}`];
  }

  getAudioFlags() {
    if (getCaps().has_aac_at) {
      // FIXME: TVBR vs CVBR?
      return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
    } else {
      return ["--oac=aac"];
    }
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
      .concat(pathMain, pathCUtree, pathMainTemp, pathCUtreeTemp);
  }
}

class HEVC_VTB extends Format {
  displayName = "hevc_vtb/aac_at";
  videoCodec = "hevc_videotoolbox";
  audioCodec = "aac";
  twoPassSupported = false; // FIXME: check
  hwAccelerated = true;
  private readonly FF_QP2LAMBDA = 118;

  getVideoFlags() {
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=codec_tag=0x31637668`, // hvc1 tag, for compatibility with Apple devices
    ];
  }
  getVideoQualityFlags() {
    return [
      `--ovcopts-add=global_quality=${options.vtb_crf * this.FF_QP2LAMBDA}`,
      "--ovcopts-add=flags=+qscale",
    ];
  }

  getAudioFlags() {
    return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
  }
}

class SVTAV1 extends Format {
  displayName = "svtav1/opus";
  videoCodec = "libsvtav1";
  audioCodec = "libopus";
  twoPassSupported = false; // FIXME: check

  private mergeSVTAV1Params() {
    // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Ffmpeg.md
    // subjective visual quality (with higher sharpness), instead of objective quality (PSNR)
    const params = ["tune=0"];
    // film-grain=8 recommended, but quite slow
    if (options.svtav1_film_grain) {
      params.push(`film-grain=${options.svtav1_film_grain}`);
    }
    return "--ovcopts-add=svtav1-params=" + params.join(":");
  }

  getVideoFlags() {
    // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Parameters.md#gop-size-and-type-options
    // keyint = -2 = ~5s by default, should be ok
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.svtav1_preset}`,
      this.mergeSVTAV1Params(),
    ];
  }
  getVideoQualityFlags() {
    // `--ovcopts-add=b=0` seems to be not necessary in recent FFmpeg:
    // https://trac.ffmpeg.org/wiki/Encode/AV1#ConstrainedQuality
    // > Note that in FFmpeg versions prior to 4.3, triggering the CRF mode also
    // > requires setting the bitrate to 0 with -b:v 0.
    return [`--ovcopts-add=crf=${options.av1_crf}`];
  }
}

export const formats: [string, Format][] = [
  ["x264", new X264()],
  ["x265", new X265()],
  ["hevc_vtb", new HEVC_VTB()],
  ["svtav1", new SVTAV1()],
];
export const formatByName = ObjectFromEntries(formats);

export function getCurrentFormat() {
  return formatByName[options.output_format];
}
