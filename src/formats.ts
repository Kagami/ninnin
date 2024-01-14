import { ObjectFromEntries } from "./polyfills";

// A basic format class, which specifies some fields to be set by child classes.
export class Format {
  public displayName = "Basic";
  public videoCodec = "";
  public audioCodec = "";
  public outputExtension = "";
  public twoPassRequired = false; // libvpx/libaom have better resulting quality with 2-pass

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
  getFlags() {
    return [] as string[];
  }

  // The codec flags (ovc and oac)
  getCodecFlags() {
    const codecs: string[] = [];
    if (this.videoCodec) {
      codecs.push(`--ovc=${this.videoCodec}`);
    }
    if (this.audioCodec) {
      codecs.push(`--oac=${this.audioCodec}`);
    }
    return codecs;
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

class AVC extends Format {
  public displayName = "AVC (H.264/AAC)";
  public videoCodec = "libx264";
  public audioCodec = "aac";
  public outputExtension = "mp4";
}

export const formats: [string, Format][] = [["avc", new AVC()]];
export const formatByName = ObjectFromEntries(formats);
