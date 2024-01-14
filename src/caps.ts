import type { MP } from "./lib/mpv";
import { ObjectAssign } from "./lib/polyfills";

const DEFAULT_CAPS = {
  has_hevc_videotoolbox: false,
  has_aac_at: false,
};

const caps = { ...DEFAULT_CAPS };
export type Caps = typeof caps;

let capsInited = false;

function initCaps() {
  if (capsInited) return;
  const encoders = mp.get_property_native("encoder-list") as MP.Encoder[];
  for (const enc of encoders) {
    if (enc.driver === "hevc_videotoolbox") {
      caps.has_hevc_videotoolbox = true;
    }
    if (enc.driver === "aac_at") {
      caps.has_aac_at = true;
    }
  }
  capsInited = true;
}

export function getCaps() {
  initCaps();
  return caps;
}

function resetCaps() {
  capsInited = false;
  ObjectAssign(caps, DEFAULT_CAPS);
}

const exportedForTesting = { resetCaps };
export { exportedForTesting };
