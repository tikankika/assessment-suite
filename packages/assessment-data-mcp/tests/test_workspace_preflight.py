"""Tests for workspace pre-flight validation (RFC-035 §9).

Pre-flight runs at server startup, after argparse but before MCP connect.
It refuses obviously dangerous workspace values and warns on broad home
top-level directories like ~/Documents.
"""

import os
import tempfile
from pathlib import Path

import pytest

from assessment_data_mcp.validators.workspace_preflight import (
    validate_workspace_arg,
)


class TestRefusesDangerousAbsolutePaths:
    def test_refuses_root(self):
        result = validate_workspace_arg("/")
        assert result["ok"] is False
        assert "too broad" in result["error"].lower() or "system" in result["error"].lower()

    @pytest.mark.parametrize("path", ["/Users", "/home", "/var", "/tmp", "/etc"])
    def test_refuses_system_path(self, path):
        result = validate_workspace_arg(path)
        assert result["ok"] is False

    def test_refuses_home_directory_exactly(self):
        result = validate_workspace_arg(str(Path.home()))
        assert result["ok"] is False
        assert "home directory" in result["error"].lower()


class TestRefusesInvalidPaths:
    def test_refuses_nonexistent_path(self):
        result = validate_workspace_arg("/tmp/preflight-nonexistent-py-xyz-789")
        assert result["ok"] is False
        assert "does not exist" in result["error"].lower() or "not found" in result["error"].lower()

    def test_refuses_a_file_not_a_directory(self, tmp_path):
        f = tmp_path / "not-a-dir.txt"
        f.write_text("x")
        result = validate_workspace_arg(str(f))
        assert result["ok"] is False
        assert "not a directory" in result["error"].lower()


class TestAcceptsValidWorkspaces:
    def test_accepts_fresh_tmp_dir_no_warning(self, tmp_path):
        result = validate_workspace_arg(str(tmp_path))
        assert result["ok"] is True
        assert result.get("warning") is None

    def test_accepts_path_with_trailing_slash(self, tmp_path):
        result = validate_workspace_arg(str(tmp_path) + "/")
        assert result["ok"] is True

    def test_accepts_deep_subdirectory_of_home(self):
        docs = Path.home() / "Documents"
        if not docs.exists():
            pytest.skip("~/Documents does not exist on this machine")
        nested = tempfile.mkdtemp(prefix="preflight-deep-py-", dir=str(docs))
        try:
            result = validate_workspace_arg(nested)
            assert result["ok"] is True
            # Dedicated subfolder, not the broad ~/Documents itself — no warning
            assert result.get("warning") is None
        finally:
            os.rmdir(nested)


class TestWarnsOnBroadHomeTopLevel:
    def test_warns_when_workspace_is_documents_exactly(self):
        docs = Path.home() / "Documents"
        if not docs.exists():
            pytest.skip("~/Documents does not exist on this machine")
        result = validate_workspace_arg(str(docs))
        assert result["ok"] is True
        warning = result.get("warning")
        assert warning is not None
        assert "broad" in warning.lower() or "top-level" in warning.lower()
