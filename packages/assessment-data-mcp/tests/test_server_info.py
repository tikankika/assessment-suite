"""The data server reports its own package version to MCP clients.

Without an explicit version the MCP SDK reports its own version instead, so a
client cannot tell which Assessment Suite release is installed.
"""

import sys

import pytest
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from assessment_data_mcp import __version__


@pytest.mark.asyncio
async def test_server_info_reports_package_version(tmp_path):
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "assessment_data_mcp.server", "--workspace", str(tmp_path)],
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            result = await session.initialize()

    assert result.serverInfo.name == "assessment-data"
    assert result.serverInfo.version == __version__
