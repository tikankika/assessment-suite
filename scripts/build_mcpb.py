#!/usr/bin/env python3
"""Build the two Assessment Suite MCPB bundles.

Each bundle keeps the repository layout (packages/<server>/ and methodology/)
because both servers locate the bundled methodology relative to their own
code. The data bundle additionally carries pyproject.toml and uv.lock at its
root, where Claude Desktop runs its uv set-up. The TypeScript server is compiled in a staging copy, so the checkout's
dist/ and node_modules/ are left untouched.

Usage:
    python3 scripts/build_mcpb.py [--out DIR]

Writes <out>/assessment-suite-<bundle>-<version>.mcpb and a .sha256 file
beside each bundle. The default output folder, dist/mcpb/, is ignored by git.
Requires Node.js with npm, and network access for npm and the pinned mcpb CLI.
"""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MCPB_CLI = "@anthropic-ai/mcpb@2.1.2"
TS_PACKAGE = REPO / "packages" / "assessment-mcp"
PY_PACKAGE = REPO / "packages" / "assessment-data-mcp"
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "*.egg-info", ".DS_Store")


def run(args, cwd):
    print("+", " ".join(str(a) for a in args), flush=True)
    executable = shutil.which(args[0])
    if executable is None:
        sys.exit(f"Required command not found: {args[0]}")
    subprocess.run([executable, *args[1:]], cwd=cwd, check=True)


def package_version(name):
    if name == "assessment":
        return json.loads((TS_PACKAGE / "package.json").read_text())["version"]
    pyproject = (PY_PACKAGE / "pyproject.toml").read_text()
    return re.search(r'^version\s*=\s*"([^"]+)"', pyproject, re.M).group(1)


def copy_manifest(name, bundle):
    source = REPO / "packaging" / "mcpb" / name / "manifest.json"
    manifest_version = json.loads(source.read_text())["version"]
    if manifest_version != package_version(name):
        sys.exit(
            f"{source.relative_to(REPO)} has version {manifest_version}, "
            f"but the package has {package_version(name)}"
        )
    shutil.copy2(source, bundle / "manifest.json")


def copy_shared(bundle):
    shutil.copytree(REPO / "methodology", bundle / "methodology", ignore=IGNORE)
    shutil.copy2(REPO / "LICENSE", bundle / "LICENSE")


def stage_assessment(stage):
    build = stage / "assessment-build"
    build.mkdir()
    shutil.copytree(TS_PACKAGE / "src", build / "src", ignore=IGNORE)
    for name in ("tsconfig.json", "package.json", "package-lock.json"):
        shutil.copy2(TS_PACKAGE / name, build / name)
    run(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], build)
    run(["npm", "run", "build"], build)

    bundle = stage / "assessment"
    package = bundle / "packages" / "assessment-mcp"
    package.mkdir(parents=True)
    shutil.copytree(build / "dist", package / "dist")
    for name in ("package.json", "package-lock.json"):
        shutil.copy2(build / name, package / name)
    run(["npm", "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], package)
    return bundle


def stage_data(stage):
    """Stage the Python server as a uv project rooted at the bundle root.

    Claude Desktop runs `uv sync` at the bundle root when a uv bundle is
    installed and expects pyproject.toml there. The source stays under
    packages/assessment-data-mcp/src so that the code's own path resolution
    still finds the bundled methodology folder; the root pyproject.toml points
    setuptools at that source tree, and the package's lockfile applies
    unchanged because the project name, version and dependencies are the same.
    """
    bundle = stage / "data"
    package = bundle / "packages" / "assessment-data-mcp"
    package.mkdir(parents=True)
    shutil.copytree(PY_PACKAGE / "src", package / "src", ignore=IGNORE)

    pyproject = (PY_PACKAGE / "pyproject.toml").read_text(encoding="utf-8")
    source = "packages/assessment-data-mcp/src"
    replacements = [
        ('package-dir = {"" = "src"}', f'package-dir = {{"" = "{source}"}}'),
        ('where = ["src"]', f'where = ["{source}"]'),
        ('readme = "README.md"\n', ""),
    ]
    for old, new in replacements:
        if pyproject.count(old) != 1:
            sys.exit(f"pyproject.toml: expected exactly one {old!r}")
        pyproject = pyproject.replace(old, new)
    (bundle / "pyproject.toml").write_text(pyproject, encoding="utf-8")
    shutil.copy2(PY_PACKAGE / "uv.lock", bundle / "uv.lock")
    run(["uv", "lock", "--check"], bundle)
    return bundle


def pack(name, bundle, out):
    copy_manifest(name, bundle)
    copy_shared(bundle)
    target = out / f"assessment-suite-{name}-{package_version(name)}.mcpb"
    target.unlink(missing_ok=True)
    run(["npx", "--yes", MCPB_CLI, "validate", str(bundle / "manifest.json")], REPO)
    run(["npx", "--yes", MCPB_CLI, "pack", str(bundle), str(target)], REPO)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    Path(f"{target}.sha256").write_text(f"{digest}  {target.name}\n")
    return target, digest


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=REPO / "dist" / "mcpb")
    out = parser.parse_args().out.resolve()
    out.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="assessment-mcpb-stage-") as temp:
        stage = Path(temp)
        results = [
            pack("assessment", stage_assessment(stage), out),
            pack("data", stage_data(stage), out),
        ]

    for target, digest in results:
        print(f"{target}\n  sha256 {digest}")


if __name__ == "__main__":
    main()
