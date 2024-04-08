// Prevents additional console window on WebviewWindow s in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    borrow::Cow,
    path::Path,
    sync::{Arc, Mutex},
};
use tauri::{Manager, State, Window};
use tokio::{
    fs::File,
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};
use urlencoding::decode;
use uuid::Uuid;

#[derive(Serialize)]
struct VideoProcessingStats {
    frame: i32,
    fps: f32,
    out_time_ms: f32,
}


#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const FFMPEG_VERSION: &str = "7.0";

fn convert_tauri_url_to_path(url: String) -> Result<String, Box<dyn std::error::Error>> {
    // URL decode
    let decoded: Cow<str> = decode(url.as_str())?;

    // Remove the 'https://asset.localhost/' prefix
    let path = decoded.replace("http://asset.localhost/", "");

    // Replace %5C (backslash) with a normal backslash if needed
    let final_path = path.replace("%5C", "\\");

    Ok(final_path)
}

async fn watch_progress_file(progress_file_path: String, window: Window) {
    let mut stats = VideoProcessingStats {
        frame: 0,
        fps: 0.0,
        out_time_ms: 0.0,
    };
    let mut end_detected = false;

    println!("Watching progress file: {}", progress_file_path);

    match File::open(&progress_file_path).await {
        Ok(file) => {
            let mut reader = BufReader::new(file).lines();

            loop {
                let mut updated = false;
                while let Ok(Some(line)) = reader.next_line().await {
                    if line.starts_with("frame=") {
                        let frame = line.replace("frame=", "").parse::<i32>().unwrap();
                        if frame > stats.frame {
                            println!("Frame: {}", frame);
                            stats.frame = frame;
                            updated = true;
                        }
                    } else if line.starts_with("fps=") {
                        let fps = line.replace("fps=", "").parse::<f32>().unwrap();
                        if fps > stats.fps {
                            stats.fps = fps;
                            updated = true;
                        }
                    } else if line.starts_with("out_time_ms=") {
                        let time = line.replace("out_time_ms=", "").parse::<f32>().unwrap();
                        if time > stats.out_time_ms {
                            stats.out_time_ms = time;
                            updated = true;
                        }
                    } else if line.starts_with("progress=") {
                        let progress = line.replace("progress=", "");
                        if progress == "end" {
                            if end_detected {
                                println!("Video processing complete");
                                window.emit("video-processing-complete", &stats).unwrap();
                                return;
                            } else {
                                println!("End detected, waiting for continue");
                                window.emit("video-processing-complete", &stats).unwrap();
                                end_detected = true;
                            }
                        } else if progress == "continue" {
                            end_detected = false;
                        }
                    }
                }

                if updated {
                    window.emit("video-processing-stats", &stats).unwrap();
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
        Err(e) => {
            eprintln!("Error opening progress file: {}", e);
        }
    }
}

async fn run_ffmpeg(args: &[&str]) -> Result<(), Box<dyn std::error::Error>> {
    // Select the correct FFmpeg binary based on the OS (ffmpeg[version]-[os])
    let ffmpeg_path = if cfg!(target_os = "windows") {
        format!("./src/binaries/ffmpeg{}-win.exe", FFMPEG_VERSION)
    } else if cfg!(target_os = "macos") {
        format!("./src/binaries/ffmpeg{}-macos", FFMPEG_VERSION)
    } else {
        panic!("Unsupported OS");
    };

    println!("Running FFmpeg with args: {:?}", args);

    let mut child = Command::new(ffmpeg_path)
        .args(args)
        .stdout(std::process::Stdio::inherit())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()?;

    let stderr = child.stderr.take().unwrap();
    let mut reader = tokio::io::BufReader::new(stderr).lines();

    while let Some(_line) = reader.next_line().await? {
        //println!("{}", line);
    }

    let status = child.wait().await?;
    if !status.success() {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "FFmpeg command failed",
        )));
    }

    println!("FFmpeg command completed successfully");

    Ok(())
}

async fn run_ffprobe(args: &[&str]) -> Result<String, Box<dyn std::error::Error>> {
    // Select the correct FFprobe binary based on the OS (ffprobe[version]-[os])
    let ffprobe_path = if cfg!(target_os = "windows") {
        format!("./src/binaries/ffprobe{}-win.exe", FFMPEG_VERSION)
    } else if cfg!(target_os = "macos") {
        format!("./src/binaries/ffprobe{}-macos", FFMPEG_VERSION)
    } else {
        panic!("Unsupported OS");
    };

    println!("Running FFprobe with args: {:?}", args);

    let mut child = Command::new(ffprobe_path)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()?;

    let stdout = child.stdout.take().unwrap();
    let mut reader_out = BufReader::new(stdout).lines();

    let mut output = String::new(); // String to store the output

    while let Some(line) = reader_out.next_line().await? {
        output.push_str(&line);
        output.push('\n');
    }

    let status = child.wait().await?;
    if !status.success() {
        return Err(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            "FFprobe command failed",
        )));
    }

    println!("FFprobe command completed successfully");

    Ok(output)
}

#[tauri::command]
async fn simple_video_processing<'a>(
    url: String,
    window: Window,
    state: State<'a, GlobalState>,
) -> Result<String, ()> {
    let path = match convert_tauri_url_to_path(url) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error converting URL to path: {}", e);
            return Err(());
        }
    };

    let usr_data_dir = state.app_data_dir.lock().unwrap().clone();
    let random_uuid = Uuid::new_v4();

    let progress_file_path = format!(
        "{}/tauri-ffmpeg-progress-{}.txt",
        usr_data_dir.as_str(),
        random_uuid
    );
    let progress_file_clone = progress_file_path.clone();

    // Create a progress file
    if let Err(e) = std::fs::write(&progress_file_path, "") {
        eprintln!("Error creating progress file: {}", e);
        return Err(());
    }

    // Check if the user data directory exists, if not create it
    if !Path::new(&usr_data_dir).exists() {
        if let Err(e) = std::fs::create_dir_all(&usr_data_dir) {
            eprintln!("Error creating user data directory: {}", e);
            return Err(());
        }
    }

    println!("Processing video at path: {}", path);
    println!("Progress file path: {}", progress_file_path);

    // The output file should be the same location as the input file but with -output appended
    let output_path = path.replace(".mp4", "-output.mp4");

    tokio::spawn(async move {
        let path_clone = path.clone();
        let args = [
            "-i",
            &path_clone,
            "-hide_banner",
            // Flushes the output after each frame to get the progress
            "-flush_packets",
            "1",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-vf",
            "scale=1280:-2",
            "-y",
            &output_path,
            "-progress",
            &progress_file_path,
        ];

        if let Err(e) = run_ffmpeg(&args).await {
            eprintln!("Error processing video: {}", e);
        }
    });

    tokio::spawn(async move {
        watch_progress_file(progress_file_clone, window).await;
    });

    Ok("Simple video processing started".to_string())
}

#[derive(Serialize, Deserialize)]
struct VideoInfo {
    width: i64,
    height: i64,
    nb_packets: i64,
    bit_rate: i64,
}

#[tauri::command]
async fn get_video_stats(url: String) -> Result<Vec<VideoInfo>, ()> {
    let path = match convert_tauri_url_to_path(url) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Error converting URL to path: {}", e);
            return Err(());
        }
    };

    let args = [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-count_packets",
        "-show_entries",
        "stream=width,height,nb_read_packets,bit_rate",
        "-of",
        "json",
        &path,
    ];

    let output = match run_ffprobe(&args).await {
        Ok(o) => o,
        Err(e) => {
            eprintln!("Error getting video stats: {}", e);
            return Err(());
        }
    };

    match serde_json::from_str::<Value>(&output) {
        Ok(json) => {
            let mut videos = Vec::new();
            if let Some(streams) = json["streams"].as_array() {
                for video in streams {
                    let width = video["width"].as_i64().unwrap_or_default();
                    let height = video["height"].as_i64().unwrap_or_default();
                    let bit_rate = video["bit_rate"].as_str().unwrap_or("0").parse::<i64>().unwrap_or_default();
                    let nb_packets = video["nb_read_packets"].as_str().unwrap_or("0").parse::<i64>().unwrap_or_default();

                    videos.push(VideoInfo {
                        width,
                        height,
                        nb_packets,
                        bit_rate,
                    });
                }
            }
            Ok(videos)
        },
        Err(e) => {
            eprintln!("Error parsing video stats: {}", e);
            Err(())
        }
    }
}



struct GlobalState {
    app_data_dir: Arc<Mutex<String>>,
}

fn main() {
    let state = GlobalState {
        app_data_dir: Arc::new(Mutex::new(String::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(state)
        .setup(move |app| {
            let state = app.state::<GlobalState>();
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir")
                .display()
                .to_string();
            *state.app_data_dir.lock().unwrap() = app_data_dir;

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![simple_video_processing, get_video_stats])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
