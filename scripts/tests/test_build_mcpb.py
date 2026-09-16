"""Regression tests for the MCPB bundles.

The manifest checks always run. The bundle checks build both bundles, unpack
them and start each server with its manifest command, so they need Node, npm,
uv and network access; enable them with RUN_PACKAGING_TESTS=1.

Run from the repository root:
    RUN_PACKAGING_TESTS=1 uv run --project packages/assessment-data-mcp \
        python -m unittest discover -s scripts/tests -p 'test_build_mcpb.py'
"""

import asyncio
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

REPO = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO / "scripts" / "build_mcpb.py"
MANIFESTS = {
    "assessment": REPO / "packaging" / "mcpb" / "assessment" / "manifest.json",
    "data": REPO / "packaging" / "mcpb" / "data" / "manifest.json",
}


def package_versions():
    ts = json.loads((REPO / "packages/assessment-mcp/package.json").read_text())["version"]
    pyproject = (REPO / "packages/assessment-data-mcp/pyproject.toml").read_text()
    py = re.search(r'^version\s*=\s*"([^"]+)"', pyproject, re.M).group(1)
    return {"assessment": ts, "data": py}


def load_manifest(name):
    return json.loads(MANIFESTS[name].read_text())


class ManifestTest(unittest.TestCase):
    def test_versions_match_package_metadata(self):
        for name, version in package_versions().items():
            with self.subTest(bundle=name):
                self.assertEqual(load_manifest(name)["version"], version)

    def test_one_server_per_bundle_with_expected_runtime(self):
        self.assertEqual(load_manifest("assessment")["server"]["type"], "node")
        self.assertEqual(load_manifest("data")["server"]["type"], "uv")

    def test_workspace_is_required_and_passed_to_the_server(self):
        for name in MANIFESTS:
            with self.subTest(bundle=name):
                manifest = load_manifest(name)
                workspace = manifest["user_config"]["workspace"]
                self.assertEqual(workspace["type"], "directory")
                self.assertTrue(workspace["required"])
                args = manifest["server"]["mcp_config"]["args"]
                index = args.index("--workspace")
                self.assertEqual(args[index + 1], "${user_config.workspace}")

    def test_methodology_setting_is_optional_and_defaults_to_empty(self):
        # An optional setting without a default reaches the server as the
        # literal placeholder. An empty default is read as "not set".
        for name in MANIFESTS:
            with self.subTest(bundle=name):
                manifest = load_manifest(name)
                setting = manifest["user_config"]["methodology"]
                self.assertEqual(setting["type"], "directory")
                self.assertFalse(setting["required"])
                self.assertEqual(setting["default"], "")
                env = manifest["server"]["mcp_config"]["env"]
                self.assertEqual(env["METHODOLOGY_PATH"], "${user_config.methodology}")


def substitute(value, dirname, user_config):
    value = value.replace("${__dirname}", str(dirname))
    for key, setting in user_config.items():
        value = value.replace("${user_config.%s}" % key, setting)
    return value


def launch_parameters(unpacked, user_config):
    from mcp import StdioServerParameters

    manifest = json.loads((unpacked / "manifest.json").read_text())
    config = manifest["server"]["mcp_config"]
    command = shutil.which(config["command"])
    args = [substitute(a, unpacked, user_config) for a in config["args"]]
    env = {k: substitute(v, unpacked, user_config) for k, v in config.get("env", {}).items()}
    return StdioServerParameters(command=command, args=args, env={**os.environ, **env})


async def call_server(unpacked, user_config, tool=None, arguments=None):
    from mcp import ClientSession
    from mcp.client.stdio import stdio_client

    async with stdio_client(launch_parameters(unpacked, user_config)) as (read, write):
        async with ClientSession(read, write) as session:
            info = (await session.initialize()).serverInfo
            tools = {t.name for t in (await session.list_tools()).tools}
            text = None
            if tool:
                result = await session.call_tool(tool, arguments or {})
                text = "".join(c.text for c in result.content if hasattr(c, "text"))
            return tools, text, info


@unittest.skipUnless(os.environ.get("RUN_PACKAGING_TESTS") == "1", "opt-in packaging test")
class BundleTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="assessment-mcpb-test-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.out = cls.root / "out"
        result = subprocess.run(
            [sys.executable, str(BUILD_SCRIPT), "--out", str(cls.out)],
            cwd=REPO, capture_output=True, text=True, timeout=900,
        )
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)
        versions = package_versions()
        cls.bundles = {}
        for name in MANIFESTS:
            bundle = cls.out / f"assessment-suite-{name}-{versions[name]}.mcpb"
            unpacked = cls.root / "unpacked" / name
            with zipfile.ZipFile(bundle) as archive:
                archive.extractall(unpacked)
            cls.bundles[name] = (bundle, unpacked)

    def test_checksum_files_match_bundles(self):
        for name, (bundle, _) in self.bundles.items():
            with self.subTest(bundle=name):
                recorded = Path(f"{bundle}.sha256").read_text().split()[0]
                self.assertEqual(recorded, hashlib.sha256(bundle.read_bytes()).hexdigest())

    def test_bundles_keep_the_repository_layout(self):
        required = {
            "assessment": [
                "manifest.json", "LICENSE",
                "methodology/pedagogical/00_foundation.md",
                "methodology/technical/phase6_post_format_detection.md",
                "packages/assessment-mcp/package.json",
                "packages/assessment-mcp/dist/server.js",
                "packages/assessment-mcp/node_modules/@modelcontextprotocol/sdk/package.json",
            ],
            "data": [
                "manifest.json", "LICENSE",
                "methodology/pedagogical/00_foundation.md",
                "packages/assessment-data-mcp/pyproject.toml",
                "packages/assessment-data-mcp/uv.lock",
                "packages/assessment-data-mcp/src/assessment_data_mcp/server.py",
                "packages/assessment-data-mcp/src/assessment_data_mcp/utils/methodology_path.py",
            ],
        }
        for name, paths in required.items():
            unpacked = self.bundles[name][1]
            for relative in paths:
                with self.subTest(bundle=name, path=relative):
                    self.assertTrue((unpacked / relative).is_file())

    def test_bundles_exclude_development_material(self):
        # First-party paths only: third-party packages legitimately ship
        # folders such as src/ or tests/.
        first_party = re.compile(
            r"(^|/)(\.venv|__pycache__|[^/]+\.egg-info|tests|\.git)(/|$)|(^|/)\.env|\.map$"
        )
        dev_dependency = re.compile(r"^packages/assessment-mcp/node_modules/(vitest|typescript|@vitest|vite)(/|$)")
        for name, (_, unpacked) in self.bundles.items():
            for path in unpacked.rglob("*"):
                relative = path.relative_to(unpacked).as_posix()
                with self.subTest(bundle=name, path=relative):
                    self.assertIsNone(dev_dependency.search(relative))
                    if "/node_modules/" not in f"/{relative}":
                        self.assertIsNone(first_party.search(relative))
                        # The TypeScript bundle ships compiled output, not source.
                        self.assertFalse(relative.startswith("packages/assessment-mcp/src"))

    def test_servers_start_from_unpacked_bundles(self):
        workspace = self.root / "workspace"
        workspace.mkdir(exist_ok=True)
        config = {"workspace": str(workspace), "methodology": ""}
        expected = {
            "assessment": {"phase6_start", "phase6_write", "phase6_post_format"},
            "data": {"initialize_project", "extract_student_answers", "generate_reports"},
        }
        versions = package_versions()
        for name, (_, unpacked) in self.bundles.items():
            with self.subTest(bundle=name):
                tools, _, info = asyncio.run(call_server(unpacked, config))
                self.assertLessEqual(expected[name], tools)
                # The installed release must be identifiable from the client.
                self.assertEqual(info.version, versions[name])

    def test_methodology_setting_reaches_the_data_server(self):
        workspace = self.root / "workspace-methodology"
        (workspace / "exam").mkdir(parents=True)
        custom = self.root / "teacher-methodology" / "pedagogical"
        custom.mkdir(parents=True)
        (custom / "teacher_marker.md").write_text("# Teacher's own method\n")
        config = {"workspace": str(workspace), "methodology": str(custom.parent)}
        _, text, _ = asyncio.run(call_server(
            self.bundles["data"][1], config,
            "scan_source_directory", {"directory_path": str(workspace / "exam")},
        ))
        self.assertIn("teacher_marker.md", text)
        self.assertNotIn("00_foundation.md", text)


if __name__ == "__main__":
    unittest.main()
