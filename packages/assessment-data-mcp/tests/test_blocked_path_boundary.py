"""Blocked-path boundary must use a separator, not a bare string prefix
(finding D): "/etc" must not catch a sibling like "/etcfoo".

Portable: picks a directory that is blocked on the running platform.
"""

import platform

from assessment_data_mcp.validators.path_validator import validate_path_security

_BLOCKED = {"Darwin": "/System", "Windows": "C:\\Windows"}.get(platform.system(), "/etc")


def test_blocks_system_dir_itself():
    ok, _ = validate_path_security(_BLOCKED)
    assert not ok


def test_blocks_children_of_system_dir():
    ok, _ = validate_path_security(_BLOCKED + "/x")
    assert not ok


def test_does_not_block_sibling_prefix():
    # e.g. "/etcfoo" must not be caught by "/etc"
    ok, _ = validate_path_security(_BLOCKED + "foo")
    assert ok
