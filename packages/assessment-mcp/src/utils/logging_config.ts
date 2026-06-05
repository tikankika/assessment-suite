/**
 * Logging Configuration for Assessment MCP (TypeScript)
 *
 * Configures logging to write to project-specific log files.
 * Compatible with the Python logging_config.py - writes to same log file.
 *
 * Usage:
 *   import { setupProjectLogging, logPhaseStart, logPhaseComplete, logger } from '../utils/logging_config.js';
 *
 *   // At the start of any phase tool:
 *   setupProjectLogging(projectPath);
 *   logPhaseStart(9, 'phase9_start', { student: studentId });
 *
 *   // Use logger for debug/info messages:
 *   logger.info('Processing started');
 *   logger.warn('Something unusual');
 *   logger.error('Something failed');
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// Log levels
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Track configured projects
const configuredProjects = new Set<string>();

// Current log file path
let currentLogFile: string | null = null;

// Log level filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

let currentLogLevel: LogLevel = 'INFO';

/**
 * Format a log message with timestamp and level
 */
function formatLogMessage(level: LogLevel, name: string, message: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `${timestamp} [${level}] ${name}: ${message}`;
}

/**
 * Write a log entry to file (append mode)
 * NOTE: Never write to console - it interferes with MCP protocol!
 */
async function writeToLogFile(message: string): Promise<void> {
  if (!currentLogFile) return;

  try {
    await fs.appendFile(currentLogFile, message + '\n', 'utf-8');
  } catch {
    // Silently fail if we can't write to log file
    // DO NOT use console.error - it breaks MCP!
  }
}

/**
 * Log a message at specified level
 * NOTE: Only writes to file - never to console (breaks MCP protocol)
 */
async function logMessage(level: LogLevel, name: string, message: string): Promise<void> {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLogLevel]) return;

  const formatted = formatLogMessage(level, name, message);

  // Write to file only - NEVER to console (breaks MCP protocol!)
  await writeToLogFile(formatted);
}

/**
 * Logger object for easy use
 */
export const logger = {
  debug: (message: string, name = 'assessment-mcp') => logMessage('DEBUG', name, message),
  info: (message: string, name = 'assessment-mcp') => logMessage('INFO', name, message),
  warn: (message: string, name = 'assessment-mcp') => logMessage('WARN', name, message),
  error: (message: string, name = 'assessment-mcp') => logMessage('ERROR', name, message),
};

/**
 * Setup project-specific logging.
 *
 * Creates logs directory and configures logging to write to assessment.log.
 *
 * @param projectPath - Path to project root directory
 * @param logLevel - Minimum log level (default: INFO)
 * @param forceReconfigure - Force reconfiguration even if already done
 * @returns Path to the log file
 */
export async function setupProjectLogging(
  projectPath: string,
  logLevel: LogLevel = 'INFO',
  forceReconfigure = false
): Promise<string> {
  // Skip if already configured (unless forced)
  if (configuredProjects.has(projectPath) && !forceReconfigure) {
    return join(projectPath, 'logs', 'assessment.log');
  }

  // Create logs directory
  const logsDir = join(projectPath, 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  // Set log file path
  currentLogFile = join(logsDir, 'assessment.log');
  currentLogLevel = logLevel;

  // Mark as configured
  configuredProjects.add(projectPath);

  // Log startup message
  const projectName = projectPath.split('/').pop() || 'unknown';
  await logger.info(`=== Logging started for project: ${projectName} ===`);
  await logger.info(`Log file: ${currentLogFile}`);

  return currentLogFile;
}

/**
 * Log the start of a phase with consistent formatting.
 */
export async function logPhaseStart(
  phase: number | string,
  tool: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  await logger.info(
    `[Phase ${phase}] ${tool} started${contextStr ? ': ' + contextStr : ''}`,
    'phase'
  );
}

/**
 * Log the completion of a phase with consistent formatting.
 */
export async function logPhaseComplete(
  phase: number | string,
  tool: string,
  success: boolean,
  context: Record<string, unknown> = {}
): Promise<void> {
  const status = success ? 'completed' : 'FAILED';
  const contextStr = Object.entries(context)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  if (success) {
    await logger.info(
      `[Phase ${phase}] ${tool} ${status}${contextStr ? ': ' + contextStr : ''}`,
      'phase'
    );
  } else {
    await logger.error(
      `[Phase ${phase}] ${tool} ${status}${contextStr ? ': ' + contextStr : ''}`,
      'phase'
    );
  }
}
