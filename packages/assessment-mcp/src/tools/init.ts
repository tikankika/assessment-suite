/**
 * init - Get critical instructions for Claude Desktop
 *
 * Called FIRST by Claude Desktop to receive the rules for using the MCP tools.
 *
 * Deliberately does NOT enumerate the available tools: the MCP client already
 * receives the full, authoritative tool list via the server's ListTools
 * handler. Duplicating it here only created drift (the list fell out of sync
 * when tools were renamed). This tool returns rules, not a catalogue.
 */
export async function init(): Promise<{
  instructions: string;
  criticalRules: string[];
}> {
  const instructions = `# Critical Instructions for Claude Desktop

## RULES:
1. NEVER use bash, find, ls, cat — use the MCP tools directly.
2. Files do NOT need to be uploaded — the MCP servers have full access to the
   workspace folder. Call tools directly with the path provided.
3. A NEW project starts with: scan_source_directory → initialize_project →
   convert_documents (assessment-data server).
4. The full set of available tools is visible to you directly — use the tool
   that fits the phase you are in.
`;

  return {
    instructions,
    criticalRules: [
      '🚨 NEW PROJECT = scan_source_directory → initialize_project → convert_documents',
      '❌ NEVER use bash / view / ls / cat — call the MCP tools directly',
      'MCP has FULL file access — never say "upload the file"',
    ],
  };
}
