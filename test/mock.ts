global.mp = {
  utils: {
    getcwd: () => "/home/user",
  },
  get_property(prop) {
    switch (prop) {
      case "filename":
        return "video.mp4";
      case "filename/no-ext":
        return "video";
      case "stream-open-filename":
        return "/home/user/video.mp4";
      case "media-title":
        return "test video";
    }
    throw new Error("get_property: unknown prop " + prop);
  },
  get_property_native(prop) {
    switch (prop) {
      case "aid":
        return 1;
      case "mute":
        return false;
      case "height":
        return 1080;
    }
    throw new Error("get_property_native: unknown prop " + prop);
  },
  get_property_bool(prop) {
    switch (prop) {
      case "demuxer-via-network":
        return false;
    }
    throw new Error("get_property_bool: unknown prop " + prop);
  },
};
