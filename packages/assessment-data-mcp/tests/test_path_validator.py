"""
Tests for path_validator with fuzzy matching

Tests the enhanced error messages from ADR-005.
"""

import pytest
from pathlib import Path
import tempfile

from assessment_data_mcp.validators.path_validator import validate_path, _find_similar_files


def test_validate_path_exists():
    """Test that validate_path returns True for existing files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        test_file = tmp / "test.txt"
        test_file.write_text("test")

        assert validate_path(str(test_file), must_exist=True) is True


def test_validate_path_not_exists_no_suggestions():
    """Test that validate_path raises FileNotFoundError without suggestions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        nonexistent = tmp / "nonexistent.txt"

        with pytest.raises(FileNotFoundError, match="Path not found"):
            validate_path(str(nonexistent), must_exist=True, suggest_alternatives=False)


def test_validate_path_not_exists_with_suggestions():
    """Test that validate_path includes suggestions in error message."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create similar files
        (tmp / "exam_questions.pdf").write_bytes(b"x" * (25 * 1024 * 1024))
        (tmp / "exam_answers.pdf").write_bytes(b"x" * (10 * 1024 * 1024))

        # Try to access misspelled file
        nonexistent = tmp / "exam_questoins.pdf"  # typo: questoins instead of questions

        with pytest.raises(FileNotFoundError) as exc_info:
            validate_path(str(nonexistent), must_exist=True, suggest_alternatives=True)

        error_msg = str(exc_info.value)
        assert "Did you mean one of these?" in error_msg
        assert "exam_questions.pdf" in error_msg
        assert "explore_directory" in error_msg


def test_find_similar_files_exact_match():
    """Test fuzzy matching with very similar filename."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create test files
        (tmp / "exam_questions.pdf").write_bytes(b"x" * 100)
        (tmp / "rubric.pdf").write_bytes(b"x" * 100)

        # Search for similar to "exam_questoins.pdf" (typo)
        similar = _find_similar_files(tmp, "exam_questoins.pdf")

        assert len(similar) > 0
        assert similar[0]["path"] == "exam_questions.pdf"
        assert similar[0]["similarity"] > 0.8  # Very high similarity


def test_find_similar_files_partial_match():
    """Test fuzzy matching with partial filename match."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create test files with closer match
        (tmp / "exam_questions.pdf").write_bytes(b"x" * (15 * 1024 * 1024))
        (tmp / "another_file.pdf").write_bytes(b"x" * 100)

        # Search for similar name
        similar = _find_similar_files(tmp, "exam_question.pdf")  # Missing 's'

        assert len(similar) > 0
        # Should find the file with very similar name
        assert similar[0]["path"] == "exam_questions.pdf"


def test_find_similar_files_no_match():
    """Test that files with <50% similarity are filtered out."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create test files with very different names
        (tmp / "abc123.pdf").write_bytes(b"x" * 100)
        (tmp / "xyz789.pdf").write_bytes(b"x" * 100)

        # Search for completely different name
        similar = _find_similar_files(tmp, "exam_questions.pdf")

        # Should return empty or very few results (similarity < 50%)
        for match in similar:
            assert match["similarity"] > 0.5


def test_find_similar_files_includes_metadata():
    """Test that similar files include size and modification date."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create test file
        test_file = tmp / "exam.pdf"
        test_file.write_bytes(b"x" * (5 * 1024 * 1024))  # 5MB

        similar = _find_similar_files(tmp, "exan.pdf")  # typo

        assert len(similar) > 0
        match = similar[0]

        assert "path" in match
        assert "size" in match
        assert "modified" in match
        assert "similarity" in match

        # Check size format
        assert "MB" in match["size"]

        # Check date format (YYYY-MM-DD)
        assert len(match["modified"]) == 10
        assert match["modified"].count("-") == 2


def test_find_similar_files_sorted_by_similarity():
    """Test that results are sorted by similarity score."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create files with varying similarity to "exam.pdf"
        (tmp / "exam.pdf").write_bytes(b"x" * 100)  # Exact match (if we search for exam2.pdf)
        (tmp / "exam_questions.pdf").write_bytes(b"x" * 100)  # High similarity
        (tmp / "test_exam.pdf").write_bytes(b"x" * 100)  # Medium similarity
        (tmp / "rubric.pdf").write_bytes(b"x" * 100)  # Low similarity

        similar = _find_similar_files(tmp, "exam_question.pdf")

        # Should be sorted by similarity (highest first)
        if len(similar) > 1:
            for i in range(len(similar) - 1):
                assert similar[i]["similarity"] >= similar[i + 1]["similarity"]


def test_find_similar_files_max_five_results():
    """Test that maximum 5 results are returned."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create many similar files
        for i in range(10):
            (tmp / f"exam_test_{i}.pdf").write_bytes(b"x" * 100)

        similar = _find_similar_files(tmp, "exam.pdf")

        assert len(similar) <= 5


def test_find_similar_files_case_insensitive():
    """Test that matching is case-insensitive."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Create files with different cases
        (tmp / "EXAM_QUESTIONS.PDF").write_bytes(b"x" * 100)

        # Search with lowercase
        similar = _find_similar_files(tmp, "exam_questions.pdf")

        assert len(similar) > 0
        assert similar[0]["similarity"] > 0.9  # Should be very high despite case difference


def test_find_similar_files_permission_error():
    """Test that permission errors return empty list."""
    # This test might need to be skipped on some systems where permission control is different
    # Just ensure it doesn't crash
    similar = _find_similar_files(Path("/root"), "test.txt")
    assert isinstance(similar, list)


def test_validate_path_permission_error():
    """Test that validate_path raises PermissionError for unreadable files."""
    # Create a file and make it unreadable (Unix-specific)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        test_file = tmp / "test.txt"
        test_file.write_text("test")

        # Make file unreadable (chmod 000)
        test_file.chmod(0o000)

        try:
            with pytest.raises(PermissionError, match="Cannot read path"):
                validate_path(str(test_file), must_exist=True)
        finally:
            # Restore permissions for cleanup
            test_file.chmod(0o644)


def test_validate_path_must_exist_false():
    """Test that validate_path returns True for non-existent path if must_exist=False."""
    nonexistent = "/nonexistent/path/to/file.txt"

    # Should not raise error when must_exist=False
    assert validate_path(nonexistent, must_exist=False) is True
