use std::{
    error::Error,
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const API_HOST: &str = "127.0.0.1";
const API_PORT: u16 = 17329;
const DEV_UI_URL: &str = "http://127.0.0.1:5173";

struct ManagedServer(Mutex<Option<Child>>);

fn setup_error(message: impl Into<String>) -> Box<dyn Error> {
    Box::new(std::io::Error::new(
        std::io::ErrorKind::Other,
        message.into(),
    ))
}

fn app_root(app: &tauri::App) -> Result<PathBuf, Box<dyn Error>> {
    if cfg!(debug_assertions) {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        return Ok(manifest_dir
            .parent()
            .expect("src-tauri must live under the project root")
            .to_path_buf());
    }

    Ok(app.path().resource_dir()?)
}

fn api_addr() -> String {
    format!("{API_HOST}:{API_PORT}")
}

fn api_url() -> String {
    format!("http://{API_HOST}:{API_PORT}")
}

fn node_executable(root: &std::path::Path) -> PathBuf {
    let bundled = root.join("bin/node");
    if bundled.exists() {
        return bundled;
    }
    PathBuf::from("node")
}

fn is_api_ready() -> bool {
    TcpStream::connect(api_addr()).is_ok()
}

fn wait_for_api(timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if is_api_ready() {
            return true;
        }
        thread::sleep(Duration::from_millis(120));
    }
    false
}

fn spawn_api_server(root: PathBuf) -> Result<Option<Child>, Box<dyn Error>> {
    if is_api_ready() {
        return Ok(None);
    }

    let server_js = root.join("server.js");
    let node = node_executable(&root);
    let child = Command::new(&node)
        .arg(server_js)
        .current_dir(root)
        .env("HOST", API_HOST)
        .env("PORT", API_PORT.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| {
            setup_error(format!(
                "启动本地 Node API 服务失败，请确认 Node 运行时可用（{}）：{err}",
                node.display()
            ))
        })?;

    Ok(Some(child))
}

fn stop_api_server(app: &tauri::AppHandle) {
    let Some(state) = app.try_state::<ManagedServer>() else {
        return;
    };
    let Ok(mut child) = state.0.lock() else {
        return;
    };
    let Some(mut child) = child.take() else {
        return;
    };
    let _ = child.kill();
    let _ = child.wait();
}

fn main() {
    let context = tauri::generate_context!();
    let app = tauri::Builder::default()
        .manage(ManagedServer(Mutex::new(None)))
        .setup(|app| {
            let root = app_root(app)?;
            let child = spawn_api_server(root)?;
            if let Some(child) = child {
                let state = app.state::<ManagedServer>();
                *state.0.lock().expect("managed server mutex poisoned") = Some(child);
            }

            if !wait_for_api(Duration::from_secs(8)) {
                stop_api_server(app.handle());
                return Err(setup_error(format!(
                    "本地 API 服务未在 8 秒内就绪：{}",
                    api_url()
                )));
            }

            let window_url = if cfg!(debug_assertions) {
                DEV_UI_URL.to_string()
            } else {
                api_url()
            };

            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(window_url.parse().expect("valid desktop window URL")),
            )
            .title("WeChat Multi Manager")
            .inner_size(1180.0, 780.0)
            .min_inner_size(980.0, 680.0)
            .build()?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. })
                && window.label() == "main"
            {
                window.app_handle().exit(0);
            }
        })
        .build(context)
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
        ) {
            stop_api_server(app_handle);
        }
    });
}
