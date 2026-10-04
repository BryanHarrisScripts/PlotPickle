use fframes::{AudioMap, Color, Duration, EncoderOptions, FFramesContext, Frame, MediaDirectory, RenderOptions, Svgr, Video, cli};
use serde::Deserialize;
use std::{fs, process::ExitCode};

const FPS: usize = 24;
const WIDTH: usize = 1280;
const HEIGHT: usize = 720;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
    request_id: String,
    project_id: String,
    block_number: u8,
    mini_block_number: u8,
    frames: Vec<FrameInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrameInput {
    position: u8,
    file_name: String,
    duration_ms: u32,
}

#[derive(Debug)]
struct PlotPickleVideo {
    request: Request,
}

impl PlotPickleVideo {
    fn selected_frame(&self, second: f32) -> Option<&FrameInput> {
        let elapsed_ms = (second.max(0.0) * 1000.0) as u64;
        let mut cursor = 0_u64;
        for item in &self.request.frames {
            cursor += u64::from(item.duration_ms);
            if elapsed_ms < cursor {
                return Some(item);
            }
        }
        self.request.frames.last()
    }

    fn duration_seconds(&self) -> f32 {
        self.request.frames.iter().map(|item| item.duration_ms as f32 / 1000.0).sum()
    }
}

impl Video for PlotPickleVideo {
    const FPS: usize = FPS;
    const WIDTH: usize = WIDTH;
    const HEIGHT: usize = HEIGHT;
    const BACKGROUND_COLOR: Color = Color::BLACK;

    fn duration(&self) -> Duration<'_> {
        Duration::Seconds(self.duration_seconds())
    }

    fn audio(&self) -> AudioMap<'_> {
        AudioMap::none()
    }

    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let Some(item) = self.selected_frame(frame.seconds()) else {
            return Svgr::empty();
        };
        let Some(image) = ctx.get_image(&item.file_name) else {
            return fframes::svgr!(
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
                    <rect width="1280" height="720" fill="#000" />
                    <text x="640" y="360" text-anchor="middle" fill="#fff" font-size="36">
                        {format!("Missing Storyboard position {:02}", item.position)}
                    </text>
                </svg>
            );
        };
        fframes::svgr!(
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
                <rect width="1280" height="720" fill="#000" />
                <image href={image.href()} x="0" y="0" width="1280" height="720" preserveAspectRatio="xMidYMid meet" />
            </svg>
        )
    }
}

fn load_request() -> Result<Request, String> {
    let text = fs::read_to_string("plotpickle-request.json")
        .map_err(|error| format!("could not read PlotPickle request: {error}"))?;
    let request: Request = serde_json::from_str(&text)
        .map_err(|error| format!("could not parse PlotPickle request: {error}"))?;
    if request.frames.is_empty() || request.frames.len() > 25 {
        return Err("PlotPickle bridge requires between 1 and 25 frames.".to_owned());
    }
    if request.block_number == 0 || request.mini_block_number == 0 {
        return Err("PlotPickle bridge received an invalid story address.".to_owned());
    }
    if request.request_id.trim().is_empty() || request.project_id.trim().is_empty() {
        return Err("PlotPickle bridge requires request and project identity.".to_owned());
    }
    Ok(request)
}

fn run() -> Result<ExitCode, String> {
    let request = load_request()?;
    let media_dir = MediaDirectory::read_folder("assets")
        .map_err(|error| format!("could not read staged Storyboard assets: {error}"))?;
    let media = media_dir
        .process_media_source()
        .map_err(|error| format!("could not prepare staged Storyboard assets: {error}"))?;
    let video = PlotPickleVideo { request };
    Ok(cli::new(
        &video,
        RenderOptions {
            media: Some(&media),
            // Use the LGPL software encoder deterministically. GPU availability
            // is a separate hardware capability, never inferred from FFrames.
            video_encoder_options: EncoderOptions {
                preferred_encoder: Some("mpeg4"),
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .run())
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(error) => {
            eprintln!("plotpickle-fframes-bridge: {error}");
            ExitCode::FAILURE
        }
    }
}
