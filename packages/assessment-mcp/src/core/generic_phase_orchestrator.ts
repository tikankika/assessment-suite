/**
 * GenericPhaseOrchestrator — RFC-030 P2
 *
 * Replaces per-phase orchestrator classes (1,289 lines for Phase 9 alone)
 * with a config-driven ~200-line generic orchestrator.
 *
 * Two tools, no continue():
 *   start()    — load input data + methodology, create session
 *   complete() — dual-write (Complete_ + standalone), cleanup
 *
 * The LLM reads methodology and drives the dialogue.
 * For drafts during dialogue, the LLM calls the existing student_report_update tool.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { BaseSessionManager, generateSessionId } from './base_session_manager.js';
import { MethodologyLoader } from './methodology_loader.js';
import { updateStudentReportSection, removeStudentReportSection } from '../utils/student_report_updater.js';
import { setupProjectLogging, logPhaseStart } from '../utils/logging_config.js';
import { logWorkflowAction } from '../shared/project_state_manager.js';
import { FOLDERS } from '../shared/folder_constants.js';
import { PHASE_CONFIGS } from './phase_configs.js';
import { assertSafeIdentifier } from './path_validator.js';
import type {
  PhaseConfig,
  GenericPhaseSession,
  GenericPhaseStartResult,
  GenericPhaseCompleteResult,
} from '../types/generic_phase_types.js';

// ============================================================
// SESSION MANAGER
// ============================================================

class GenericPhaseSessionManager extends BaseSessionManager<GenericPhaseSession> {
  createSession(
    projectPath: string,
    studentId: string,
    phasePrefix: string,
  ): GenericPhaseSession {
    const session: GenericPhaseSession = {
      session_id: generateSessionId(phasePrefix, studentId),
      project_path: projectPath,
      student_id: studentId,
      course_name: '',
      exam_name: '',
      methodology: '',
      current_step: 'active',
      started_at: new Date(),
      last_updated: new Date(),
      loaded_data: {},
    };
    this.addSession(session);
    return session;
  }
}

// Singleton per phase (keyed by phaseId)
const managers = new Map<string, GenericPhaseSessionManager>();

function getSessionManager(phaseId: string): GenericPhaseSessionManager {
  let mgr = managers.get(phaseId);
  if (!mgr) {
    mgr = new GenericPhaseSessionManager();
    managers.set(phaseId, mgr);
  }
  return mgr;
}

// ============================================================
// ORCHESTRATOR
// ============================================================

export class GenericPhaseOrchestrator {
  private config: PhaseConfig;
  private sessionManager: GenericPhaseSessionManager;
  private methodologyLoader: MethodologyLoader;
  private loadMethodology: () => Promise<string>;

  constructor(
    config: PhaseConfig,
    sessionManager?: GenericPhaseSessionManager,
    methodologyLoader?: MethodologyLoader,
  ) {
    this.config = config;
    this.sessionManager = sessionManager || getSessionManager(config.phaseId);
    this.methodologyLoader = methodologyLoader || new MethodologyLoader();

    // Validate methodology loader method at construction time (fail-fast)
    const method = this.methodologyLoader[config.methodologyLoader as keyof MethodologyLoader];
    if (typeof method !== 'function') {
      throw new Error(
        `PhaseConfig error: '${config.methodologyLoader}' is not a method on MethodologyLoader`,
      );
    }
    this.loadMethodology = (method as () => Promise<string>).bind(this.methodologyLoader);
  }

  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------

  async start(projectPath: string, studentId: string): Promise<GenericPhaseStartResult> {
    const cfg = this.config;

    // Security: studentId is interpolated into output filenames (see complete()).
    // It is not a PATH_ARG_NAME, so the server-level workspace gate never sees
    // it — reject traversal here before any file op. (Vuln 1, RFC-035 gap.)
    assertSafeIdentifier(studentId, 'student_id');

    // 1. Setup logging
    await setupProjectLogging(projectPath);
    await logPhaseStart(cfg.phaseNumber, `phase${cfg.phaseNumber}_start`, { student: studentId });

    // 2. Create session
    const session = this.sessionManager.createSession(
      projectPath,
      studentId,
      `phase${cfg.phaseNumber}`,
    );

    // 3. Load input files
    const loadedData: Record<string, unknown> = {};
    for (const spec of cfg.inputFiles) {
      const fileName = spec.filePattern.replace('{studentId}', studentId);
      const filePath = join(projectPath, spec.folder, fileName);

      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        loadedData[spec.label] = spec.parser === 'json' ? JSON.parse(raw) : raw;
      } catch (error) {
        if (spec.optional) {
          loadedData[spec.label] = null;
        } else {
          // Clean up session on failure
          this.sessionManager.deleteSession(session.session_id);
          throw new Error(`Missing required input: ${spec.label} (${filePath}): ${error}`);
        }
      }
    }

    // 4. Load methodology (validated at construction time)
    const methodology = await this.loadMethodology();

    // 5. Load project info + assessment purpose
    const projectInfo = await this.loadProjectInfo(projectPath);
    const assessmentPurpose = await this.loadAssessmentPurpose(projectPath);

    // 6. Update session
    this.sessionManager.updateSession(session.session_id, {
      loaded_data: loadedData,
      methodology,
      course_name: projectInfo.courseName,
      exam_name: projectInfo.examName,
    } as Partial<GenericPhaseSession>);

    // 7. Log workflow action
    await logWorkflowAction(
      projectPath,
      cfg.phaseNumber,
      `phase${cfg.phaseNumber}_start`,
      'session_start',
      { student_id: studentId },
      { session_id: session.session_id, input_files_loaded: Object.keys(loadedData).length },
    );

    return {
      session_id: session.session_id,
      loaded_data: loadedData,
      methodology,
      project_info: projectInfo,
      assessment_purpose: assessmentPurpose,
    };
  }

  // ----------------------------------------------------------
  // COMPLETE
  // ----------------------------------------------------------

  async complete(sessionId: string, content: string): Promise<GenericPhaseCompleteResult> {
    const cfg = this.config;

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let reportPath = '';

    // For student-level phases, update the Complete_ report
    if (!cfg.classLevel) {
      reportPath = join(
        session.project_path,
        FOLDERS.COMPLETE_ASSESSMENT,
        `Complete_${session.student_id}.md`,
      );

      // 1. Remove draft section (if any)
      await removeStudentReportSection(reportPath, `${cfg.phaseId}_DRAFT`);

      // 2. Write final section to Complete_ report
      const updateResult = await updateStudentReportSection({
        reportPath,
        phaseId: cfg.phaseId,
        sectionTitle: cfg.sectionTitle,
        content,
        author: 'Claude + Lärare',
        changeDescription: cfg.sectionTitle,
      });

      if (!updateResult.success) {
        throw new Error(`Failed to update student report: ${updateResult.error}`);
      }
    }

    // 3. Write standalone file
    const outputDir = join(session.project_path, cfg.outputFolder);
    await fs.mkdir(outputDir, { recursive: true });
    const standaloneFileName = cfg.standaloneFilePattern.replace('{studentId}', session.student_id);
    const standalonePath = join(outputDir, standaloneFileName);
    await fs.writeFile(standalonePath, content, 'utf-8');

    // 4. Log workflow action
    await logWorkflowAction(
      session.project_path,
      cfg.phaseNumber,
      `phase${cfg.phaseNumber}_complete`,
      'session_complete',
      { session_id: sessionId, student_id: session.student_id },
      { output_path: reportPath, standalone_path: standalonePath },
    );

    // 5. Cleanup session
    this.sessionManager.deleteSession(sessionId);

    return {
      success: true,
      output_path: reportPath,
      standalone_path: standalonePath,
      next_step: `Proceed to Phase ${cfg.phaseNumber + 1}`,
    };
  }

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  private async loadAssessmentPurpose(
    projectPath: string,
  ): Promise<string | null> {
    try {
      const purposePath = join(projectPath, 'assessment_purpose.md');
      return await fs.readFile(purposePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private async loadProjectInfo(
    projectPath: string,
  ): Promise<{ courseName: string; examName: string }> {
    try {
      const sourcesPath = join(projectPath, 'sources.yaml');
      const content = await fs.readFile(sourcesPath, 'utf-8');
      const nameMatch = content.match(/name:\s*(.+)/);
      const projectName = nameMatch?.[1]?.trim() || '';
      const parts = projectName.split('_');
      return {
        courseName: parts[0] || projectName,
        examName: parts.slice(1).join('_') || 'Exam',
      };
    } catch {
      return { courseName: 'Unknown Course', examName: 'Unknown Exam' };
    }
  }
}
