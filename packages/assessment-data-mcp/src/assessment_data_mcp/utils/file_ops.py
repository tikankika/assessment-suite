"""File operations: copy, count, download.

Critical: download_url() converts Skolverket HTML to markdown (Q2 decision).
"""

import shutil
from pathlib import Path
from urllib.parse import urlparse
import requests
import html2text


def _validate_url(url: str) -> tuple[bool, str]:
    """
    Validate URL is safe to fetch.

    Checks:
    1. URL scheme must be http or https
    2. URL must have a valid netloc (domain)

    Args:
        url: URL to validate

    Returns:
        Tuple of (is_valid, error_message). Error message is empty if valid.
    """
    try:
        parsed = urlparse(url)

        # Must be http or https (blocks file://, ftp://, etc.)
        if parsed.scheme not in ("http", "https"):
            return False, f"URL scheme must be http or https, got: {parsed.scheme}"

        # Must have a valid domain
        if not parsed.netloc:
            return False, "URL must have a valid domain"

        return True, ""
    except Exception as e:
        return False, f"Invalid URL: {e}"


def copy_file(src: Path, dst: Path) -> bool:
    """
    Copy file preserving metadata.

    Args:
        src: Source file path
        dst: Destination file path

    Returns:
        True if successful

    Raises:
        FileNotFoundError: Source file doesn't exist
    """
    if not src.exists():
        raise FileNotFoundError(f"Source not found: {src}")

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)  # Preserves metadata
    return True


def copy_directory(src: Path, dst: Path, pattern: str = None) -> int:
    """
    Copy directory contents matching pattern.

    Args:
        src: Source directory
        dst: Destination directory
        pattern: File pattern to match (default: "*" - all files)

    Returns:
        Number of files copied

    Raises:
        ValueError: Source is not a directory
    """
    # Default to all files if no pattern specified
    if pattern is None:
        pattern = "*"

    if not src.is_dir():
        raise ValueError(f"Not a directory: {src}")

    dst.mkdir(parents=True, exist_ok=True)

    files_copied = 0
    for file_path in src.rglob(pattern):
        if file_path.is_file():
            rel_path = file_path.relative_to(src)
            dest_file = dst / rel_path
            dest_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(file_path, dest_file)
            files_copied += 1

    return files_copied


def count_files(path: Path, pattern: str = "*") -> int:
    """
    Count files in directory matching pattern.

    Args:
        path: Directory to count files in
        pattern: File pattern to match (default: all files)

    Returns:
        Number of files found

    Raises:
        ValueError: Path is not a directory
    """
    if not path.is_dir():
        raise ValueError(f"Not a directory: {path}")

    return sum(1 for _ in path.rglob(pattern) if _.is_file())


def download_url(url: str, output_path: Path) -> bool:
    """
    Download syllabus and convert HTML → markdown (Q2 decision).

    Skolverket serves HTML pages, not PDFs. Must convert using html2text.

    Args:
        url: URL to download from
        output_path: Where to save (will force .md extension)

    Returns:
        True if successful

    Raises:
        requests.RequestException: Download failed
        ValueError: Unsupported content type or invalid URL
    """
    # Security: Validate URL before fetching
    is_valid, url_error = _validate_url(url)
    if not is_valid:
        raise ValueError(f"Security: {url_error}")

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        content_type = response.headers.get('content-type', '')

        # Already markdown
        if url.endswith('.md') or 'text/markdown' in content_type:
            content = response.text

        # HTML → Markdown (Skolverket case)
        elif 'text/html' in content_type or url.startswith('https://www.skolverket.se'):
            h = html2text.HTML2Text()
            h.ignore_links = False      # Keep links
            h.ignore_images = False     # Keep images
            h.body_width = 0            # No line wrapping
            content = h.handle(response.text)

        else:
            raise ValueError(f"Unsupported content type: {content_type}")

        # Ensure output is .md
        if output_path.suffix != '.md':
            output_path = output_path.with_suffix('.md')

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding='utf-8')
        return True

    except requests.RequestException as e:
        raise requests.RequestException(f"Download failed: {e}")
