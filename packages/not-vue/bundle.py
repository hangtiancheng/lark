from __future__ import annotations

import argparse
import atexit
import http.server
import shutil
import signal
import socketserver
import subprocess
import sys
import tempfile
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


DEFAULT_PORT = 3000
TEMPLATE_PLACEHOLDER = "<!-- TEMPLATE -->"


@dataclass(frozen=True)
class BundleConfig:
    root_dir: Path
    template_html_path: Path
    index_html_path: Path
    vendor_ts_path: Path
    index_ts_path: Path
    vendor_js_path: Path
    index_js_path: Path


def new_bundle_config() -> BundleConfig:
    root_dir = Path(__file__).resolve().parent
    return BundleConfig(
        root_dir=root_dir,
        template_html_path=root_dir / "template.html",
        index_html_path=root_dir / "index.html",
        vendor_ts_path=root_dir / "vendor.ts",
        index_ts_path=root_dir / "index.ts",
        vendor_js_path=root_dir / "vendor.js",
        index_js_path=root_dir / "index.js",
    )


def run(mode: str) -> int:
    config = new_bundle_config()
    if mode == "dev":
        return run_dev(config)
    if mode == "build":
        return run_build(config)
    raise ValueError(f'unknown mode "{mode}", expected one of: dev, build')


def run_build(config: BundleConfig) -> int:
    cleanup = compile_typescript(config, remove_output_on_cleanup=False)
    try:
        print(f"build complete: {config.index_js_path}, {config.vendor_js_path}")
        return 0
    finally:
        cleanup()


def run_dev(config: BundleConfig) -> int:
    cleanup = compile_typescript(config, remove_output_on_cleanup=True)
    atexit.register(cleanup)

    class RequestHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(config.root_dir), **kwargs)

        def do_GET(self) -> None:
            if self.path == "/":
                self.path = "/index.html"
            return super().do_GET()

    class ThreadingTCPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    server = ThreadingTCPServer(("", DEFAULT_PORT), RequestHandler)
    stop_event = threading.Event()

    def shutdown_handler(_signum: int, _frame) -> None:
        if stop_event.is_set():
            return
        stop_event.set()
        print("shutting down dev server...")
        threading.Thread(target=server.shutdown, daemon=True).start()

    previous_sigint = signal.getsignal(signal.SIGINT)
    previous_sigterm = signal.getsignal(signal.SIGTERM)
    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        print(f"dev server running at http://localhost:{DEFAULT_PORT}")
        server.serve_forever()
        return 0
    finally:
        server.server_close()
        cleanup()
        signal.signal(signal.SIGINT, previous_sigint)
        signal.signal(signal.SIGTERM, previous_sigterm)


def compile_typescript(
    config: BundleConfig,
    remove_output_on_cleanup: bool,
) -> Callable[[], None]:
    generated_entry_path, cleanup_temp = prepare_generated_sources(config)
    cleanup_fns: list[Callable[[], None]] = [cleanup_temp]

    temp_output_dir = Path(tempfile.mkdtemp(prefix="proxy-tsc-out-"))
    cleanup_fns.append(lambda: shutil.rmtree(temp_output_dir, ignore_errors=True))

    try:
        run_tsc(generated_entry_path, temp_output_dir)
        compiled_index_js_path = temp_output_dir / "index.js"
        compiled_vendor_js_path = temp_output_dir / "vendor.js"

        if not compiled_index_js_path.exists():
            raise FileNotFoundError(
                f"compiled output missing: {compiled_index_js_path}"
            )
        if not compiled_vendor_js_path.exists():
            raise FileNotFoundError(
                f"compiled output missing: {compiled_vendor_js_path}"
            )

        copy_file(compiled_index_js_path, config.index_js_path)
        copy_file(compiled_vendor_js_path, config.vendor_js_path)

        if remove_output_on_cleanup:
            cleanup_fns.append(lambda: safe_unlink(config.index_js_path))
            cleanup_fns.append(lambda: safe_unlink(config.vendor_js_path))
    except Exception:
        run_cleanup(cleanup_fns)
        raise

    def cleanup() -> None:
        run_cleanup(cleanup_fns)

    return cleanup


def prepare_generated_sources(config: BundleConfig) -> tuple[Path, Callable[[], None]]:
    template_content = config.template_html_path.read_text(encoding="utf-8")
    vendor_ts_content = config.vendor_ts_path.read_text(encoding="utf-8")
    index_ts_content = config.index_ts_path.read_text(encoding="utf-8")

    if TEMPLATE_PLACEHOLDER not in index_ts_content:
        raise ValueError(f'placeholder "{TEMPLATE_PLACEHOLDER}" not found in index.ts')

    replaced = index_ts_content.replace(TEMPLATE_PLACEHOLDER, template_content, 1)

    temp_dir = Path(tempfile.mkdtemp(prefix="proxy-ts-src-"))
    generated_index_path = temp_dir / "index.ts"
    generated_vendor_path = temp_dir / "vendor.ts"

    generated_index_path.write_text(replaced, encoding="utf-8")
    generated_vendor_path.write_text(vendor_ts_content, encoding="utf-8")

    def cleanup() -> None:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return generated_index_path, cleanup


def run_tsc(entry_path: Path, out_dir: Path) -> None:
    command = resolve_tsc_command(entry_path, out_dir)
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"run typescript compiler: {error}") from error


def resolve_tsc_command(entry_path: Path, out_dir: Path) -> list[str]:
    base_args = [
        "--target",
        "ESNext",
        "--module",
        "ESNext",
        "--moduleResolution",
        "Bundler",
        "--lib",
        "ESNext,DOM",
        "--strict",
        "--skipLibCheck",
        "--pretty",
        "false",
        "--declaration",
        "false",
        "--sourceMap",
        "false",
        "--removeComments",
        "false",
        "--outDir",
        str(out_dir),
        str(entry_path),
    ]

    if shutil.which("tsc"):
        return ["tsc", *base_args]
    return ["npx", "--yes", "tsc", *base_args]


def copy_file(src_path: Path, dst_path: Path) -> None:
    shutil.copyfile(src_path, dst_path)


def safe_unlink(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def run_cleanup(cleanups: list[Callable[[], None]]) -> None:
    for cleanup in reversed(cleanups):
        try:
            cleanup()
        except Exception:
            pass


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="mini-vue build/dev tool")
    parser.add_argument(
        "mode",
        nargs="?",
        default="dev",
        choices=("dev", "build"),
        help="run mode",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        return run(args.mode)
    except Exception as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
