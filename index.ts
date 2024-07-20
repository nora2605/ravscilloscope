import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import decodeAudio from 'audio-decode';
import options from './args';

const RES_X = options.res_x;
const RES_Y = options.res_y;
const FPS = options.fps;
const VIDEO_CODEC = options.vid_codec;
const AUDIO_CODEC = options.aud_codec;
const LINE_WIDTH = options.line_width;
const BG_COLOR = options.bg_color;
const FG_COLOR = options.fg_color;
const INPUT_FILE = options.input;
const OUTPUT_FILE = options.output;
const FADE = options.fade;

const FRAMES_DIR = 'frames_' + OUTPUT_FILE.replace(/[/\\\.]/g, '_');

const rgb2css = (rgb: number[]) => `rgba(${rgb.join(',')})`;

const handle = Bun.file(INPUT_FILE);
if (!await handle.exists()) {
    console.error('Failed to open file');
    process.exit(1);
}

const audio = await decodeAudio(await handle.arrayBuffer())
console.log(
`Audio duration: ${audio.duration} seconds
Audio sample rate: ${audio.sampleRate} Hz
Audio channels: ${audio.numberOfChannels}
Audio length: ${audio.length} samples`
);

if (audio.numberOfChannels != 2) {
    console.error('Audio must have 2 channels');
    process.exit(1);
}

const canvas = createCanvas(RES_X, RES_Y);
const ctx = canvas.getContext('2d');
ctx.lineWidth = LINE_WIDTH;

const samples_l = audio.getChannelData(0);
const samples_r = audio.getChannelData(1);

const bg_color_fade = (fade: number) => [BG_COLOR[0], BG_COLOR[1], BG_COLOR[2], fade];
const fg_color_fade = (fade: number) => [FG_COLOR[0], FG_COLOR[1], FG_COLOR[2], fade];

const max_pad = Math.ceil(Math.log10(audio.duration * FPS));
const w_stdout = Bun.stdout.writer();

if (!options.skip_render) {
    console.log("Creating/Cleaning frames directory...");
    // node api :(
    if (!(await import('fs')).existsSync(FRAMES_DIR))
        (await import('fs')).mkdirSync(FRAMES_DIR);
    else {
        // clean up
        (await import('fs')).rmdirSync(FRAMES_DIR, { recursive: true });
        (await import('fs')).mkdirSync(FRAMES_DIR);
    }

    console.log("Generating points...");

    // calculate screenspace points
    let screenspace_x = Array.from(samples_l).map(s => RES_X / 2 + s * RES_X / 2);
    let screenspace_y = Array.from(samples_r).map(s => RES_Y / 2 - s * RES_Y / 2);
    let screenspace_points: { x: number, y: number }[] = screenspace_x.map((x, i) => ({ x, y: screenspace_y[i] }));

    // draw background
    ctx.fillStyle = rgb2css(BG_COLOR);
    ctx.fillRect(0, 0, RES_X, RES_Y);
    ctx.strokeStyle = rgb2css(FG_COLOR);
    

    console.log("Rendering frames...");
    for (let i = 0; i < audio.duration * FPS; i++) {
        let start = Math.floor(i * audio.sampleRate / FPS);
        let end = Math.floor((i + 1) * audio.sampleRate / FPS);
        if (end > audio.length)
            end = audio.length;

        // transparent overlay over the last frame
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgb2css(bg_color_fade(FADE));
        ctx.fillRect(0, 0, RES_X, RES_Y);

        ctx.globalCompositeOperation = 'lighter';
        drawCurve(ctx, screenspace_points.slice(start, end), 0.5);

        w_stdout.write(`Frame ${i + 1}/${Math.ceil(audio.duration * FPS)}\r`);
        await Bun.write(`${FRAMES_DIR}/frame${i.toString().padStart(max_pad, '0')}.png`, canvas.createPNGStream().read());
    }
    console.log("Done!");
}

// assume no errors
if (!options.no_video) {
    await Bun.spawn(['ffmpeg', '-y',
        '-r', `${FPS}`,
        '-i', `${FRAMES_DIR}/frame%${max_pad.toString().padStart(2, '0')}d.png`,
        '-i', INPUT_FILE,
        '-c:v', `${VIDEO_CODEC}`,
        '-c:a', `${AUDIO_CODEC}`,
        '-r', `${FPS}`,
        '-pix_fmt', 'yuv420p',
        '-map', '0:v',
        '-map', '1:a',
        ...options.ffmpeg_options,
        `${OUTPUT_FILE}`
    ]).exited;
    if (options.show_after) {
        Bun.spawn(['ffplay', `${OUTPUT_FILE}`]);
    }
}

/**
 * 
 * @param ctx Canvas Context
 * @param points Array of points (will be intersected by canonical spline)
 * @param tension Tension for the canonical splint
 * @param decay Amount of decay per sample (will apply a layer of 0x01 alpha of the background whenever cur_sample_index * acc_decay is greater than 1/255)
 */
function drawCurve(ctx: CanvasRenderingContext2D, points: { x: number, y: number }[], tension?: number) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    let t = tension ?? 1;
    for (let i = 0; i < points.length - 1; i++) {
        let p0 = points[Math.max(i - 1, 0)];
        let p1 = points[i];
        let p2 = points[i + 1];
        let p3 = points[Math.min(i + 2, points.length - 1)];

        let cp1x = p1.x + (p2.x - p0.x) / 6 * t;
        let cp1y = p1.y + (p2.y - p0.y) / 6 * t;
        let cp2x = p2.x - (p3.x - p1.x) / 6 * t;
        let cp2y = p2.y - (p3.y - p1.y) / 6 * t;

        if (options.lineto)
            ctx.lineTo(p2.x, p2.y);
        else
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        ctx.strokeStyle = rgb2css(fg_color_fade(Math.min(1, ((RES_X + RES_Y) / 4) / (dx + dy))));
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
    }
    
}