/**
 * write_json_file - Helper tool for writing JSON data to files
 *
 * Solves the problem where Claude Desktop can't write directly to Mac filesystem.
 * Claude Desktop calls this tool to write data, then uses the file path in other tools.
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { validatePath } from '../core/path_validator.js';

export interface WriteJsonFileInput {
  file_path: string;
  data: unknown;
  pretty?: boolean;
}

export interface WriteJsonFileOutput {
  success: boolean;
  file_path: string;
  size_bytes: number;
  message: string;
}

export async function writeJsonFile(
  input: WriteJsonFileInput
): Promise<WriteJsonFileOutput> {
  const { file_path, data, pretty = true } = input;

  // Security: Validate path and use resolved path for all operations
  const pathValidation = validatePath(file_path);
  if (!pathValidation.valid) {
    return {
      success: false,
      file_path,
      size_bytes: 0,
      message: `❌ Security: ${pathValidation.error}`
    };
  }
  const resolvedPath = pathValidation.resolvedPath!;

  try {
    // Ensure directory exists
    await fs.mkdir(dirname(resolvedPath), { recursive: true });

    // Serialize data
    const content = pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    // Write file
    await fs.writeFile(resolvedPath, content, 'utf-8');

    // Get file size
    const stats = await fs.stat(resolvedPath);

    return {
      success: true,
      file_path,
      size_bytes: stats.size,
      message: `✅ Wrote ${(stats.size / 1024).toFixed(1)} KB to ${file_path}`
    };
  } catch (err) {
    return {
      success: false,
      file_path,
      size_bytes: 0,
      message: `❌ Failed to write file: ${err}`
    };
  }
}
