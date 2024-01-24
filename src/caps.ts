import type { MP } from "mpv.d.ts";

let capsInited = false;
const caps = {
  has_hevc_videotoolbox: false,
  has_aac_at: false,
};

function initCaps() {
  if (capsInited) return;
  const encoders = mp.get_property_native("encoder-list") as MP.Prop.Encoder[];
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

// For testing
export function testingResetCaps() {
  capsInited = false;
  caps.has_hevc_videotoolbox = false;
  caps.has_aac_at = false;
}
