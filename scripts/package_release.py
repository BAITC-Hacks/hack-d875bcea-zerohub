"""Create a source release with a SHA-256 manifest; exclude local secrets and runtime data."""

import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {
    "node_modules",
    "dist",
    ".git",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "var",
    "test-output",
    "test-results",
    "playwright-report",
    "artifacts",
    "backups",
}
ROOT_FILES = {
    "README.md",
    "compose.yaml",
    ".gitignore",
    ".dockerignore",
    ".env.example",
}
FOLDERS = {"frontend", "backend", "data", "scripts", "docs", ".github"}
ALLOWED = {
    ".py",
    ".mjs",
    ".js",
    ".ts",
    ".tsx",
    ".json",
    ".css",
    ".svg",
    ".html",
    ".md",
    ".txt",
    ".toml",
    ".yaml",
    ".yml",
    ".lock",
    ".conf",
    ".example",
}


def included(path):
    rel = path.relative_to(ROOT)
    if any(part in SKIP for part in rel.parts):
        return False
    if path.name.startswith(".env") and not path.name.endswith(".example"):
        return False
    if len(rel.parts) == 1:
        return path.name in ROOT_FILES
    return rel.parts[0] in FOLDERS and (
        path.suffix in ALLOWED
        or path.name in {"Dockerfile", ".dockerignore", ".gitignore"}
    )


def package():
    destination = ROOT / "artifacts/akim-team-release.zip"
    destination.parent.mkdir(exist_ok=True)
    manifest = []
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(ROOT.rglob("*")):
            if not file.is_file() or file.is_symlink() or not included(file):
                continue
            rel = file.relative_to(ROOT).as_posix()
            content = file.read_bytes()
            archive.writestr("akim-team/" + rel, content)
            manifest.append(hashlib.sha256(content).hexdigest() + "  " + rel)
        archive.writestr("akim-team/SHA256SUMS", "\n".join(manifest) + "\n")
    print(destination)
    return destination


if __name__ == "__main__":
    package()
