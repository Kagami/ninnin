import type { MP } from "mpv.d.ts";

import { type Format } from "./formats";

type Track = MP.Prop.Track;
interface ActiveTracks {
  video: Track[];
  audio: Track[];
  sub: Track[];
}
type TrackType = keyof ActiveTracks;

function getAllActiveTracks(): ActiveTracks {
  const accepted = {
    video: true,
    audio: !mp.get_property_bool("mute"),
    sub: mp.get_property_bool("sub-visibility"),
  };
  const active: ActiveTracks = {
    video: [],
    audio: [],
    sub: [],
  };
  for (const track of mp.get_property_native("track-list") as Track[]) {
    if (track.selected && accepted[track.type]) {
      active[track.type].push(track);
    }
  }
  return active;
}

export function getSupportedTracks(format: Format): ActiveTracks {
  const hasVideoCodec = !!format.videoCodec;
  const hasAudioCodec = !!format.audioCodec;
  const allTracks = getAllActiveTracks();
  const activeTracks = {
    video: hasVideoCodec ? allTracks.video : [],
    audio: hasAudioCodec ? allTracks.audio : [],
    sub: hasVideoCodec ? allTracks.sub : [],
  };

  const hasVideoTrack = !!activeTracks.video.length;
  // Video track is required for video format
  if (hasVideoCodec && !hasVideoTrack)
    throw new Error("No video track selected");
  // It's ok to have no audio for video format
  const hasAudioTrack = !!activeTracks.audio.length;
  // Can't encode without video/audio tracks
  if (!hasVideoTrack && !hasAudioTrack)
    throw new Error("No video and audio tracks selected");

  return activeTracks;
}

function listTracks(activeTracks: ActiveTracks) {
  const ret: [TrackType, Track[]][] = [];
  ret.push(["video", activeTracks["video"]]);
  ret.push(["audio", activeTracks["audio"]]);
  ret.push(["sub", activeTracks["sub"]]);
  return ret;
}

function append_track(out: string[], track: Track) {
  const external_flag = {
    audio: "audio-file",
    sub: "sub-file",
  };
  const internal_flag = {
    video: "vid",
    audio: "aid",
    sub: "sid",
  };

  // The external tracks rely on the behavior that, when using
  // audio-file/sub-file only once, the track is selected by default.
  // Also, for some reason, ytdl-hook produces external tracks with absurdly long
  // filenames; this breaks our command line. Try to keep it sane, under 2048 characters.
  const trType = track.type as keyof typeof external_flag;
  if (track.external && track["external-filename"].length <= 2048) {
    out.push(`--${external_flag[trType]}=${track["external-filename"]}`);
  } else {
    out.push(`--${internal_flag[trType]}=${track.id}`);
  }
}

function append_audio_tracks(out: string[], tracks: Track[]) {
  // Some additional logic is needed for audio tracks because it seems
  // multiple active audio tracks are a thing? We probably only can reliably
  // use internal tracks for this so, well, we keep track of them and see if
  // more than one is active.
  const internal_tracks: Track[] = [];

  for (const track of tracks) {
    if (track.external) {
      // For external tracks, just do the same thing.
      append_track(out, track);
    } else {
      internal_tracks.push(track);
    }
  }

  if (internal_tracks.length > 1) {
    // We have multiple audio tracks, so we use a lavfi-complex
    // filter to mix them.
    let filter_string = "";
    for (const track of internal_tracks) {
      filter_string += `[aid${track.id}]`;
    }
    filter_string += "amix[ao]";
    out.push(`--lavfi-complex=${filter_string}`);
  } else if (internal_tracks.length === 1) {
    append_track(out, internal_tracks[0]);
  }
}

export function getTrackFlags(activeTracks: ActiveTracks): string[] {
  const args: string[] = [];
  // FIXME: does order of codec/track flags matter?
  // Append selected tracks
  for (const [track_type, tracks] of listTracks(activeTracks)) {
    if (track_type === "audio") {
      append_audio_tracks(args, tracks);
    } else {
      for (const track of tracks) {
        append_track(args, track);
      }
    }
  }
  // Disable non-selected tracks
  for (const [track_type, tracks] of listTracks(activeTracks)) {
    if (tracks.length) continue;
    switch (track_type) {
      case "video":
        args.push("--vid=no");
        break;
      case "audio":
        args.push("--aid=no");
        break;
      case "sub":
        args.push("--sid=no");
        break;
    }
  }
  return args;
}
