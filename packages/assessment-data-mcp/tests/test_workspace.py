"""Tests for workspace enforcement (RFC-035)."""

import pytest
import tempfile
from pathlib import Path

from assessment_data_mcp.validators.path_validator import validate_workspace_access


class TestValidateWorkspaceAccess:
    """Test validate_workspace_access boundary checks."""

    def test_path_within_workspace(self, tmp_path):
        workspace = str(tmp_path)
        project = str(tmp_path / "project_A" / "exam.yaml")
        is_valid, error = validate_workspace_access(project, workspace)
        assert is_valid is True
        assert error == ""

    def test_workspace_root_itself(self, tmp_path):
        workspace = str(tmp_path)
        is_valid, error = validate_workspace_access(workspace, workspace)
        assert is_valid is True
        assert error == ""

    def test_path_outside_workspace(self, tmp_path):
        workspace = str(tmp_path)
        outside = "/home/user/Documents/secret.txt"
        is_valid, error = validate_workspace_access(outside, workspace)
        assert is_valid is False
        assert "Access denied" in error

    def test_path_traversal(self, tmp_path):
        workspace = str(tmp_path)
        traversal = str(tmp_path / ".." / "etc" / "passwd")
        is_valid, error = validate_workspace_access(traversal, workspace)
        assert is_valid is False
        assert "Access denied" in error

    def test_sibling_prefix_overlap(self, tmp_path):
        """Ensure /workspace-backup doesn't match /workspace."""
        workspace = str(tmp_path / "workspace")
        sibling = str(tmp_path / "workspace-backup" / "file.txt")
        is_valid, error = validate_workspace_access(sibling, workspace)
        assert is_valid is False
        assert "Access denied" in error

    def test_symlink_outside_workspace(self, tmp_path):
        """Symlink pointing outside workspace should be rejected."""
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        outside_dir = tmp_path / "outside"
        outside_dir.mkdir()
        secret = outside_dir / "secret.txt"
        secret.write_text("sensitive data")

        link = workspace / "sneaky_link"
        link.symlink_to(secret)

        is_valid, error = validate_workspace_access(str(link), str(workspace))
        assert is_valid is False
        assert "Access denied" in error

    def test_error_message_contains_paths(self, tmp_path):
        workspace = str(tmp_path)
        outside = "/other/path"
        is_valid, error = validate_workspace_access(outside, workspace)
        assert "outside workspace" in error


class TestWorkspaceViolationLogging:
    """Tests for stderr audit logging on workspace violations (RFC-035 §8 Q1)."""

    def test_logs_to_stderr_on_violation(self, tmp_path, capsys):
        workspace = str(tmp_path)
        is_valid, _ = validate_workspace_access(
            "/etc/passwd", workspace,
            tool="phase6_write", arg_name="q_file_path",
        )
        assert is_valid is False
        captured = capsys.readouterr()
        assert "[WORKSPACE VIOLATION]" in captured.err
        assert "phase6_write" in captured.err
        assert "q_file_path" in captured.err
        assert "/etc/passwd" in captured.err
        assert workspace in captured.err

    def test_logs_without_context_when_omitted(self, tmp_path, capsys):
        workspace = str(tmp_path)
        is_valid, _ = validate_workspace_access("/etc/passwd", workspace)
        assert is_valid is False
        captured = capsys.readouterr()
        assert "[WORKSPACE VIOLATION]" in captured.err
        assert "/etc/passwd" in captured.err

    def test_does_not_log_on_valid_path(self, tmp_path, capsys):
        workspace = str(tmp_path)
        inside = str(tmp_path / "file.md")
        is_valid, _ = validate_workspace_access(inside, workspace)
        assert is_valid is True
        captured = capsys.readouterr()
        assert "[WORKSPACE VIOLATION]" not in captured.err
