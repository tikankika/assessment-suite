"""SSRF guard tests for file_ops._validate_url.

download_url() fetches a URL and writes the response into the workspace, where
it can be surfaced back to the AI. _validate_url must therefore reject URLs that
resolve to non-public addresses (loopback, link-local, private, cloud-metadata),
not just non-http schemes.

All cases use IP literals or `localhost` so resolution is network-free.
"""

from assessment_data_mcp.utils.file_ops import _validate_url


def test_rejects_loopback_ipv4():
    ok, err = _validate_url("http://127.0.0.1/syllabus")
    assert not ok and "security" in err.lower()


def test_rejects_loopback_localhost_name():
    ok, _ = _validate_url("http://localhost/x")
    assert not ok


def test_rejects_loopback_ipv6():
    ok, _ = _validate_url("http://[::1]/x")
    assert not ok


def test_rejects_private_rfc1918():
    for host in ("10.0.0.1", "192.168.1.1", "172.16.0.1"):
        ok, _ = _validate_url(f"http://{host}/x")
        assert not ok, f"{host} should be blocked"


def test_rejects_link_local_cloud_metadata():
    ok, _ = _validate_url("http://169.254.169.254/latest/meta-data/")
    assert not ok


def test_rejects_non_http_scheme():
    ok, _ = _validate_url("file:///etc/passwd")
    assert not ok


def test_allows_public_ip_literal():
    ok, err = _validate_url("http://8.8.8.8/x")
    assert ok, err


def test_rejects_unresolvable_host():
    ok, _ = _validate_url("http://nonexistent.invalid./x")
    assert not ok
