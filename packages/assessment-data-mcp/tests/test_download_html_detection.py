"""download_url treats a response as HTML by content type or by exact host.

The Skolverket special case must match the host exactly. A prefix check on
the URL string also matches look-alike hosts such as
www.skolverket.se.example.com.
"""

import pytest

from assessment_data_mcp.utils import file_ops


class FakeResponse:
    def __init__(self, body, content_type):
        self._body = body
        self.headers = {"content-type": content_type}
        self.encoding = "utf-8"

    def raise_for_status(self):
        pass

    def iter_content(self, chunk_size):
        yield self._body


@pytest.fixture
def fetch(monkeypatch):
    monkeypatch.setattr(file_ops, "_validate_url", lambda url: (True, ""))

    def respond(content_type):
        body = b"<html><body><h1>Kursplan</h1><p>Syfte</p></body></html>"
        monkeypatch.setattr(
            file_ops.requests, "get",
            lambda url, timeout, stream: FakeResponse(body, content_type),
        )
    return respond


def test_skolverket_host_is_converted_without_html_content_type(fetch, tmp_path):
    fetch("application/octet-stream")
    target = tmp_path / "syllabus.md"
    assert file_ops.download_url("https://www.skolverket.se/kursplan", target)
    assert "# Kursplan" in target.read_text()


@pytest.mark.parametrize("url", [
    "https://www.skolverket.se.example.com/kursplan",
    "https://www.skolverket.sex/kursplan",
])
def test_look_alike_host_is_not_treated_as_skolverket(fetch, tmp_path, url):
    fetch("application/octet-stream")
    with pytest.raises(ValueError, match="Unsupported content type"):
        file_ops.download_url(url, tmp_path / "syllabus.md")


def test_html_content_type_is_converted_for_any_host(fetch, tmp_path):
    fetch("text/html; charset=utf-8")
    target = tmp_path / "syllabus.md"
    assert file_ops.download_url("https://example.com/kursplan", target)
    assert "# Kursplan" in target.read_text()
