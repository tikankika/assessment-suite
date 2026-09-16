"""Opt-in wheel installation regression tests (requires uv).

Run with RUN_PACKAGING_TESTS=1 python -m unittest discover -s tests
-p test_distribution.py. Set UV_OFFLINE=1 to use an already populated cache.
Builds and installations take place only in temporary directories.
"""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


@unittest.skipUnless(sys.version_info >= (3, 10), "Packaging tests require Python >=3.10")
@unittest.skipUnless(os.environ.get("RUN_PACKAGING_TESTS") == "1", "opt-in packaging test")
class DistributionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.uv = shutil.which("uv")
        if not cls.uv:
            raise RuntimeError("The packaging test requires uv")
        cls.temp = tempfile.TemporaryDirectory(prefix="assessment-wheel-test-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        package = Path(__file__).resolve().parents[1]
        cls.source = cls.root / "source"
        cls.source.mkdir()
        for name in ("pyproject.toml", "README.md", "LICENSE"):
            shutil.copy2(package / name, cls.source / name)
        shutil.copytree(package / "src", cls.source / "src",
                        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.egg-info"))
        cls.run_checked([cls.uv, "build", "--wheel", "--out-dir",
                         str(cls.root / "dist"), str(cls.source)])
        cls.wheel = next((cls.root / "dist").glob("*.whl"))

    @classmethod
    def run_checked(cls, args):
        result = subprocess.run(args, cwd=cls.root, capture_output=True, text=True,
                                timeout=180)
        if result.returncode:
            raise AssertionError(result.stdout + result.stderr)
        return result

    def test_wheel_contains_runtime_modules(self):
        source = self.source / "src"
        expected = {p.relative_to(source).as_posix()
                    for p in (source / "assessment_data_mcp").rglob("*.py")}
        with zipfile.ZipFile(self.wheel) as wheel:
            missing = expected - set(wheel.namelist())
        self.assertFalse(missing, f"Missing runtime modules: {sorted(missing)}")

    def test_installed_server_imports_with_resolved_dependencies(self):
        env = self.root / "venv"
        self.run_checked([self.uv, "venv", "--python", sys.executable, str(env)])
        python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        self.run_checked([self.uv, "pip", "install", "--python", str(python),
                          str(self.wheel)])
        workspace = self.root / "workspace"
        workspace.mkdir()
        # -I and a separate cwd prevent imports from the source checkout.
        self.run_checked([str(python), "-I", "-B", "-c",
                          "import assessment_data_mcp.server", "--workspace",
                          str(workspace)])


if __name__ == "__main__":
    unittest.main()
