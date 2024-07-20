import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
        help: { type: 'boolean', short: 'h', default: false },
        resolution: { type: 'string', short: 's', default: '800x800' },
        input: { type: 'string', short: 'i' },
        frame_rate: { type: 'string', short: 'r' },
        no_video: { type: 'boolean', short: 'n' },
        video_codec: { type: 'string', short: 'v' },
        audio_codec: { type: 'string', short: 'a' },
        output: { type: 'string', short: 'o' },
        line_width: { type: 'string', short: 'l' },
        bg_color: { type: 'string', short: 'b' },
        fg_color: { type: 'string', short: 'f' },
        show_after: { type: 'boolean', short: 'w' },
        fade: { type: 'string', short: 'd' },
        lineto: { type: 'boolean', short: 'p' }
    },
    strict: true,
    allowPositionals: true
});

if (values.help || positionals && positionals[0] === 'help' || Bun.argv.length < 3) {
    console.log(`Ravscilloscope Version 1
Syntax: npx ravscilloscope [FLAGS] -- [FFMPEG_OPTIONS]

FLAGS:
    --audio_codec, -a   Specifies the codec to use to encode the audio (must be an ffmpeg codec)
    --bg_color, -b      Specifies the Background color of the rendered images (must be specified in #hex)
    --fade, -d          How much the background should overlay per second (0.0 - 1.0)
    --fg_color, -f      Specifies the stroke line color (must be specified in #hex, rgb and rgba supported).
    --frame_rate, -r    Specifies the frame-rate the frames should be rendered at.
    --help, -h          Shows this
    --input, -i         Specifies input file.
    --line_width, -l    Specifies the stroke line width used to render the oscilloscope.
    --no_video, -n      Do not render frames into a video after generating (if you don't have ffmpeg!)
    --output, -o        Specifies the output file. Note that this must include a file extension to a valid container format.
    --resolution, -s    Specifies resolution in the form <width>x<height>
    --show_after, -w    If given, opens ffplay afterwards to show result.
    --video_codec, -v   Specifies the codec to use to encode the video (must be an ffmpeg codec)
    --lineto, -p        Uses lines instead of Bezier curves to connect the points.
FFMPEG_OPTIONS:
    See the official FFMpeg documentation. Can be used to specify bitrate. Note however that the previous options still apply:
    ffmpeg -y -r <fps> -i <frames> -i <input> -c:v <video_codec> -c:a <audio_codec> \\
        -r <fps> -pix_fmt yuv420p -map 0:v -map 1:a [FFMPEG_OPTIONS] <output>
`);
    process.exit(0);
}

let resolutions = values.resolution?.split('x');
if (!resolutions || resolutions.length != 2) {
    console.error(`Invalid Resolution "${values.resolution}"`);
    process.exit(1);
}
const res_x = parseInt(resolutions[0]);
const res_y = parseInt(resolutions[1]);

let input: string = values.input ?? '';
let output: string = values.output ?? 'output.mp4';

if (!input) {
    console.error('No input file given!');
    process.exit(1);
}

function hex2rgbarr(hexstring: string) {
    if (hexstring.startsWith('#'))
        hexstring = hexstring.slice(1);
    let color_int = parseInt(hexstring, 16);
    if (color_int > parseInt('ffffff', 16)) {
        return [
            (color_int >> 24) & 255,
            (color_int >> 16) & 255,
            (color_int >> 8) & 255,
            color_int & 255
        ];
    } else return [
        (color_int >> 16) & 255,
        (color_int >> 8) & 255,
        (color_int) & 255,
        255
    ];
}


export default {
    res_x,
    res_y,
    input,
    output,
    fps: parseInt(values.frame_rate ?? '24'),
    no_video: values.no_video ?? false,
    vid_codec: values.video_codec ?? 'libx264',
    aud_codec: values.audio_codec ?? 'aac',
    line_width: parseInt(values.line_width ?? '1'),
    bg_color: hex2rgbarr(values.bg_color ?? '#000000'),
    fg_color: hex2rgbarr(values.fg_color ?? '#ffffff'),
    show_after: values.show_after ?? false,
    fade: parseFloat(values.fade ?? '0.3'),
    ffmpeg_options: positionals,
    lineto: values.lineto ?? false
};