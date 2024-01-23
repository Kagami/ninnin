# ninnin

[mpv](https://mpv.io/)-based video encoding tool. Allows you to quickly cut clips
from video you're currently watching, including YouTube ones, without having to
download it fully or open in another program. Currently supported codecs:

- x264/aac
- x265/aac
- hevc_videotoolbox/aac_at
- svtav1/opus (default)

The main focus is simplicity and speed/size/quality tuned towards speed (30fps+
for 1080p), thus resorting to modern codecs which allow to keep size/quality
ratio still bearable for the web.

## Install

### Windows

TODO.

### Linux

Install mpv (check out [Linux packages](https://mpv.io/installation/#:~:text=Linux%20packages)).  
To install nightly build of ninnin (for latest commit), run:

```bash
mkdir -p ~/.config/mpv/scripts
wget https://github.com/Kagami/ninnin/releases/download/nightly/ninnin.js \
  -O ~/.config/mpv/scripts/ninnin.js
```

To update the script, simply re-run the command above.

### macOS

TODO.

## Formats

Which format to use for publishing on the web (2024)?

|                                   | Chrome | Firefox | Safari | efficient |
| --------------------------------: | :----: | :-----: | :----: | :-------: |
|                             H.264 |   +    |    +    |   +    |     −     |
| [H.265](https://caniuse.com/hevc) |   ±    |    −    |   +    |     +     |
|    [AV1](https://caniuse.com/av1) |   +    |    +    |   ±    |     +     |

H.265 if you care about Apple users more, AV1 if you care about Firefox users
more. However M3+/iPhone 15+ support AV1 and it's a bit more efficient than
H.265 so it's more future-proof.

## Development

You need fresh nodejs installed.

- `npm run build` to build `ninnin.js`
- `npm start` to watch updates and rebuild on changes
- `npm test` to run tests

## License

See [LICENSE](LICENSE). Initial code ported from [mpv-webm](https://github.com/ekisu/mpv-webm) (MoonScript) to TypeScript.
