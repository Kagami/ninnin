import { getCaps } from "../caps";
import { ObjectFromEntries } from "../lib/helpers";
import { getHelperPath } from "../lib/os";
import options from "../options";
import { ffParamArg, mpvSubOpt } from "../utils";

/** A basic format class, which specifies some fields to be set by child classes. */
export class Format {
  protected displayName = "";
  videoCodec = "";
  audioCodec = "";
  outputExtension = "mp4";
  highBitDepthSupported = true;
  twoPassSupported = true;

  getDisplayName() {
    return this.displayName;
  }

  /**
   * Should be a array of ffmpeg filters e.g. {"colormatrix=bt709", "sub"}.
   * Filters that should be applied before the transformations we do (crop, scale).
   */
  getPreFilters(): string[] {
    return [];
  }

  /** Similar to getPreFilters, but after our transformations. */
  getPostFilters() {
    // Quality should be a bit better with Main10 profile even on 8bit content.
    // FIXME: is that no-op in case of 10bit content?
    // FIXME: maybe should be before scale for better quality or resize?
    if (options.force_10bit && this.highBitDepthSupported) {
      return ["format=yuv420p10le"];
    } else {
      return [];
    }
  }

  // Video codec flags
  getVideoFlags() {
    return [`--ovc=${this.videoCodec}`];
  }
  getVideoBitrateFlags(bitrate: number): string[] {
    return [`--ovcopts-add=b=${bitrate}k`];
  }
  getVideoQualityFlags(): string[] {
    return [];
  }

  // Audio codec flags
  getAudioFlags() {
    return [`--oac=${this.audioCodec}`];
  }
  getAudioBitrateFlags(bitrate: number): string[] {
    return [`--oacopts-add=b=${bitrate}k`];
  }

  // Container-specific flags
  getMetadataFlags(title: string) {
    return options.write_metadata_title && title
      ? ["--oset-metadata=title=" + mpvSubOpt(title)]
      : [];
  }
  getMuxerFlags() {
    return this.outputExtension === "mp4"
      ? ["--ofopts-add=movflags=+faststart"]
      : [];
  }

  // Two pass routines
  protected getPassLogPath(outPath: string): string {
    return getHelperPath(outPath, "passlog");
  }
  /** Flags for single pass mode */
  getPass0Flags(_outPath: string): string[] {
    return [];
  }
  getPass1Flags(_outPath: string): string[] {
    return [];
  }
  getPass2Flags(_outPath: string): string[] {
    return [];
  }
  getPassFilePaths(outPath: string): string[] {
    return [this.getPassLogPath(outPath)];
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

  getPass1Flags(outPath: string) {
    return [
      // FIXME: should we use -x264-params instead?
      "--ovcopts-add=flags=+pass1",
      "--ovcopts-add=stats=" + mpvSubOpt(this.getPassLogPath(outPath)),
    ];
  }
  getPass2Flags(outPath: string) {
    return [
      "--ovcopts-add=flags=+pass2",
      "--ovcopts-add=stats=" + mpvSubOpt(this.getPassLogPath(outPath)),
    ];
  }
  getPassFilePaths(outPath: string) {
    const pathMPV = `${outPath}-video-pass1.log`; // created by mpv
    const pathMain = this.getPassLogPath(outPath); // normal log
    const pathMainTemp = pathMain + ".temp"; // during pass1 run
    const pathMBtree = pathMain + ".mbtree"; // additional mbtree log
    const pathMBtreeTemp = pathMBtree + ".temp"; // during pass1 run
    return [pathMPV, pathMain, pathMainTemp, pathMBtree, pathMBtreeTemp];
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
      return ["--oac=aac_at", "--oacopts-add=aac_at_mode=cvbr"];
    } else {
      return ["--oac=aac"];
    }
  }

  private mergeX265Params(...custom: string[]) {
    const params = ["log-level=warning"].concat(custom);
    return ["--ovcopts-add=x265-params=" + mpvSubOpt(params.join(":"))];
  }

  getPass0Flags(_outPath: string) {
    return this.mergeX265Params();
  }
  getPass1Flags(outPath: string) {
    return this.mergeX265Params(
      "pass=1",
      "stats=" + ffParamArg(this.getPassLogPath(outPath))
    );
  }
  getPass2Flags(outPath: string) {
    return this.mergeX265Params(
      "pass=2",
      "stats=" + ffParamArg(this.getPassLogPath(outPath))
    );
  }
  getPassFilePaths(outPath: string) {
    const pathMain = this.getPassLogPath(outPath); // normal log
    const pathMainTemp = pathMain + ".temp"; // during pass1 run
    const pathCUtree = pathMain + ".cutree"; // additional cutree log
    const pathCUtreeTemp = pathCUtree + ".temp"; // during pass1 run
    return [pathMain, pathMainTemp, pathCUtree, pathCUtreeTemp];
  }
}

class SVTAV1 extends Format {
  displayName = "svtav1/opus";
  videoCodec = "libsvtav1";
  audioCodec = "libopus";
  outputExtension = "webm";
  twoPassSupported = false; // https://gitlab.com/AOMediaCodec/SVT-AV1/-/issues/1867

  getVideoFlags() {
    // https://gitlab.com/AOMediaCodec/SVT-AV1/-/blob/master/Docs/Parameters.md#gop-size-and-type-options
    // keyint = -2 = ~5s by default, should be ok
    return [
      `--ovc=${this.videoCodec}`,
      `--ovcopts-add=preset=${options.svtav1_preset}`,
    ];
  }
  getVideoQualityFlags() {
    // `--ovcopts-add=b=0` seems to be not necessary in recent FFmpeg:
    // https://trac.ffmpeg.org/wiki/Encode/AV1#ConstrainedQuality
    // > Note that in FFmpeg versions prior to 4.3, triggering the CRF mode also
    // > requires setting the bitrate to 0 with -b:v 0.
    return [`--ovcopts-add=crf=${options.av1_crf}`];
  }

  private mergeSVTAV1Params(...custom: string[]) {
    // subjective visual quality (with higher sharpness), instead of objective quality (PSNR)
    const params = ["tune=0"];
    // film-grain=8 recommended, but quite slow
    if (options.svtav1_film_grain) {
      params.push(`film-grain=${options.svtav1_film_grain}`);
    }
    params.push(...custom);
    return ["--ovcopts-add=svtav1-params=" + mpvSubOpt(params.join(":"))];
  }

  getPass0Flags(_outPath: string) {
    return this.mergeSVTAV1Params();
  }
}

export const formats: [string, Format][] = [
  ["x264", new X264()],
  ["x265", new X265()],
  ["svtav1", new SVTAV1()],
];
export const formatByName = ObjectFromEntries(formats);

export function getCurrentFormat() {
  return formatByName[options.output_format];
}

/** Pipe uncompressed format to process later. */
class RawPipe extends Format {
  videoCodec = "rawvideo";
  audioCodec = "pcm_s16le";
  outputExtension = "-";
  twoPassSupported = false;

  getVideoBitrateFlags(_bitrate: number) {
    return [];
  }
  getAudioBitrateFlags(_bitrate: number) {
    return [];
  }
  getMetadataFlags(_title: string) {
    return [];
  }
  getMuxerFlags() {
    // XXX: in case of yuv4mpegpipe and matroska VMAF filter outputs broken
    // score for some reason. Probably timestamp issues.
    return ["--of=nut"];
  }
}

/** Only raw video. */
class RawVideoPipe extends RawPipe {
  audioCodec = "";
}

export const rawPipe = new RawPipe();
export const rawVideoPipe = new RawVideoPipe();
