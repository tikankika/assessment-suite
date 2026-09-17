import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MethodologyLoader - Loads Analytic Assessment methodology documents
 *
 * Provides methodology context to Claude Desktop for assessment support.
 *
 * Default source: ./methodology/ in project root (self-contained)
 * Override: Set METHODOLOGY_PATH environment variable
 *
 * Key documents:
 * - claude-desktop-instructions.md - CRITICAL: How to use MPC tools
 * - pedagogical/00_foundation.md - General methodology foundation
 * - pedagogical/phase6_assessment_method.md - Phase 6 assessment method
 */
export class MethodologyLoader {
  /**
   * Default methodology path - monorepo root (shared across packages)
   * Can be overridden via METHODOLOGY_PATH environment variable
   */
  private readonly DEFAULT_PATH =
    process.env.METHODOLOGY_PATH || join(__dirname, '../../../../methodology');

  /** Cache for methodology file contents — files don't change during a session */
  private readonly fileCache = new Map<string, string>();
  /** Cache for resolved paths — avoids repeated fs.access() calls */
  private readonly pathCache = new Map<string, string>();

  /**
   * Path to Claude Desktop instructions (in docs/mcp-usage)
   */
  private readonly INSTRUCTIONS_PATH = join(__dirname, '../../docs/mcp-usage');

  /**
   * Key methodology documents to load
   */
  private readonly METHODOLOGY_FILES = [
    'pedagogical/00_foundation.md',
    'pedagogical/phase6_assessment_method.md',
  ];

  /**
   * Claude Desktop instructions file (loaded first)
   */
  private readonly INSTRUCTIONS_FILE = 'claude-desktop-instructions.md';

  /**
   * Resolve methodology file path with subdirectory support and flat fallback.
   * Tries subdir/filename first, then filename in root (for existing projects).
   */
  private async resolveMethodologyPath(
    filename: string,
    subdir: 'pedagogical' | 'technical'
  ): Promise<string> {
    const key = `${subdir}/${filename}`;
    const cached = this.pathCache.get(key);
    if (cached !== undefined) return cached;

    const subdirPath = join(this.DEFAULT_PATH, subdir, filename);
    try {
      await fs.access(subdirPath);
      this.pathCache.set(key, subdirPath);
      return subdirPath;
    } catch {
      // Fallback for existing projects with flat structure
      const flatPath = join(this.DEFAULT_PATH, filename);
      try {
        await fs.access(flatPath);
        this.pathCache.set(key, flatPath);
        return flatPath;
      } catch {
        this.pathCache.set(key, subdirPath);
        return subdirPath; // Return subdirPath anyway — caller handles missing file
      }
    }
  }

  /**
   * Read a file with caching. Methodology files don't change during a session,
   * so repeated loads (e.g. hermeneutic_read called per student) skip disk I/O.
   */
  private async cachedReadFile(filePath: string): Promise<string> {
    const cached = this.fileCache.get(filePath);
    if (cached !== undefined) return cached;
    const content = await fs.readFile(filePath, 'utf-8');
    this.fileCache.set(filePath, content);
    return content;
  }

  /**
   * Load all methodology documents
   *
   * @param methodologyPath - Custom path (optional, uses default if not provided)
   * @returns Combined methodology text
   */
  async load(methodologyPath?: string): Promise<string> {
    const basePath = methodologyPath || this.DEFAULT_PATH;

    const sections: string[] = [];
    const loadedFiles: string[] = [];
    const failedFiles: string[] = [];

    // FIRST: Load Claude Desktop instructions (CRITICAL)
    try {
      const instructionsPath = join(this.INSTRUCTIONS_PATH, this.INSTRUCTIONS_FILE);
      const instructionsContent = await fs.readFile(instructionsPath, 'utf-8');
      sections.push('# KRITISKA INSTRUKTIONER FÖR MPC-VERKTYG\n\n' + instructionsContent);
      loadedFiles.push(this.INSTRUCTIONS_FILE);
    } catch (error) {
      failedFiles.push(this.INSTRUCTIONS_FILE);
    }

    // THEN: Load assessment methodology files
    for (const filename of this.METHODOLOGY_FILES) {
      try {
        const filePath = join(basePath, filename);
        let content: string;
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          // Fallback: try just the basename in flat structure
          const basename = filename.split('/').pop() ?? '';
          content = await fs.readFile(join(basePath, basename), 'utf-8');
        }

        sections.push(this.formatSection(filename, content));
        loadedFiles.push(filename);
      } catch (error) {
        failedFiles.push(filename);
      }
    }

    if (loadedFiles.length === 0) {
      throw new Error(
        `No methodology files found in ${basePath}. ` +
          `Expected: ${this.METHODOLOGY_FILES.join(', ')}`
      );
    }

    // Build header with load status
    const header = this.buildHeader(basePath, loadedFiles, failedFiles);

    return `${header}\n\n${sections.join('\n\n---\n\n')}`;
  }

  /**
   * Load a single methodology document
   *
   * @param filename - Filename to load
   * @param methodologyPath - Custom path (optional)
   * @returns Document content
   */
  async loadDocument(
    filename: string,
    methodologyPath?: string
  ): Promise<string> {
    const basePath = methodologyPath || this.DEFAULT_PATH;
    const filePath = join(basePath, filename);

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load methodology document ${filename}: ${error}`);
    }
  }

  /**
   * Get condensed methodology summary (for context refresh)
   *
   * @param methodologyPath - Custom path (optional)
   * @returns Condensed summary
   */
  async getCondensed(methodologyPath?: string): Promise<string> {
    const basePath = methodologyPath || this.DEFAULT_PATH;

    try {
      const filePath = await this.resolveMethodologyPath('00_foundation.md', 'pedagogical');
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract key sections only
      return await this.extractKeySections(content);
    } catch (error) {
      return await this.getFallbackSummary(error);
    }
  }

  /**
   * Check if methodology files exist at path
   *
   * @param methodologyPath - Path to check
   * @returns Status of each file
   */
  async checkAvailability(methodologyPath?: string): Promise<{
    path: string;
    available: string[];
    missing: string[];
  }> {
    const basePath = methodologyPath || this.DEFAULT_PATH;
    const available: string[] = [];
    const missing: string[] = [];

    for (const filename of this.METHODOLOGY_FILES) {
      try {
        await fs.access(join(basePath, filename));
        available.push(filename);
      } catch {
        // Fallback: try just the basename in flat structure
        const basename = filename.split('/').pop() ?? '';
        try {
          await fs.access(join(basePath, basename));
          available.push(basename);
        } catch {
          missing.push(filename);
        }
      }
    }

    return { path: basePath, available, missing };
  }

  /**
   * Load Phase 4A Question Detection methodology
   *
   * Returns instructions for Claude on how to detect questions:
   * - Skip TOC (Page 1-2)
   * - Find real questions (Page 7+)
   * - Extract metadata
   * - Progressive verification workflow
   *
   * @returns Instructions markdown content
   */
  async loadPhase2B(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase2b_question_detection.md', 'technical');
    try {
      const content = await this.cachedReadFile(filePath);
      return this.formatSection('phase2b_question_detection.md', content);
    } catch (error) {
      throw this.missingMethodology('Phase 2B', 'technical/phase2b_question_detection.md', filePath, error);
    }
  }

  /**
   * Load Phase 4B Rubric Validation methodology
   *
   * Returns instructions for Claude on how to validate questions against rubric:
   * - Match questions to rubric sections
   * - Extract aspect breakdowns
   * - Auto-resolve conflicts when rubric confirms
   * - Flag missing rubric IDs
   *
   * @returns Instructions markdown content
   */
  async loadPhase4B(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase4b_rubric_validation.md', 'technical');
    try {
      const content = await this.cachedReadFile(filePath);
      return this.formatSection('phase4b_rubric_validation.md', content);
    } catch (error) {
      throw this.missingMethodology('Phase 4B', 'technical/phase4b_rubric_validation.md', filePath, error);
    }
  }

  /**
   * Load Phase 4C Student Report methodology
   *
   * Returns instructions for Claude on how to create per-student completion report:
   * - Analyze each student file
   * - Identify answered questions and word counts
   * - Flag short/missing answers
   * - Generate student_report.md
   *
   * @returns Instructions markdown content
   */
  async loadPhase4CSave(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase4c_save.md', 'technical');

    try {
      const content = await this.cachedReadFile(filePath);
      return this.formatSection('phase4c_save.md', content);
    } catch (error) {
      throw this.missingMethodology('Phase 4C', 'technical/phase4c_save.md', filePath, error);
    }
  }

  /**
   * Load Phase 4D Answer Boundaries methodology
   *
   * Returns instructions for Claude on how to detect per-question boundaries:
   * - Identify start/end markers that work for ALL students
   * - Verify consistency across students
   * - Handle Swedish vs English Inspera patterns
   *
   * @returns Instructions markdown content
   */
  async loadPhase2C(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase2c_answer_boundaries.md', 'technical');

    try {
      const content = await this.cachedReadFile(filePath);
      return this.formatSection('phase2c_answer_boundaries.md', content);
    } catch (error) {
      throw this.missingMethodology('Phase 2C', 'technical/phase2c_answer_boundaries.md', filePath, error);
    }
  }

  // ============================================================
  // ASSESSMENT PURPOSE METHODOLOGY
  // ============================================================

  /**
   * Load Assessment Purpose methodology
   *
   * Returns instructions for declaring assessment purpose and pipeline depth.
   * Used by the assessment_purpose tool.
   *
   * @returns Assessment Purpose methodology content
   */
  async loadAssessmentPurposeMethodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('assessment_purpose_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Assessment purpose', 'pedagogical/assessment_purpose_method.md', filePath, error);
    }
  }

  // ============================================================
  // PHASE 9-12: AI-ASSISTED DIALOGUE METHODOLOGY
  // ============================================================

  /**
   * Load Phase 9 Generalization methodology
   *
   * Returns instructions for qualitative generalization:
   * - Area-by-area analysis (STEG 1)
   * - Pattern identification (STEG 2)
   * - Overall generalization (STEG 3)
   *
   * Based on Hirsh (2019) Step 2 (Generalization)
   *
   * @returns Phase 9 methodology content (54 KB)
   */
  async loadPhase9Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase9_generalization_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 9', 'pedagogical/phase9_generalization_method.md', filePath, error);
    }
  }

  /**
   * Load Phase 10 Extrapolation methodology
   *
   * Returns instructions for criteria mapping:
   * - Map generalization to course criteria
   * - Identify evidence for each criterion
   * - Prepare for grading decision
   *
   * @returns Phase 10 methodology content
   */
  async loadPhase10Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase10_extrapolation_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 10', 'pedagogical/phase10_extrapolation_method.md', filePath, error);
    }
  }

  /**
   * Load Phase 11 Grading Decision methodology
   *
   * Returns instructions for grade determination:
   * - Apply criteria evidence
   * - Make holistic judgment
   * - Document reasoning
   *
   * @returns Phase 11 methodology content
   */
  async loadPhase11Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase11_grade_decision_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 11', 'pedagogical/phase11_grade_decision_method.md', filePath, error);
    }
  }

  /**
   * Load Phase 12 Feedback methodology
   *
   * Returns instructions for feedback generation:
   * - Lundahl's three-step model
   * - Forward-looking feedback
   * - Constructive suggestions
   *
   * @returns Phase 12 methodology content
   */
  async loadPhase12Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase12_feedback_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 12', 'pedagogical/phase12_feedback_method.md', filePath, error);
    }
  }

  /**
   * Load Phase 14 Student Feedback methodology
   *
   * Returns instructions for student-facing feedback generation:
   * - Student-friendly language
   * - Encouraging tone
   * - Concrete next steps
   *
   * @returns Phase 14 methodology content
   */
  async loadPhase13Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase13_teacher_summary_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 13', 'pedagogical/phase13_teacher_summary_method.md', filePath, error);
    }
  }

  async loadPhase14Methodology(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('phase14_student_feedback_method.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Phase 14', 'pedagogical/phase14_student_feedback_method.md', filePath, error);
    }
  }

  // ============================================================
  // HERMENEUTIC CIRCLE GUIDANCE (RFC-042)
  // ============================================================

  /**
   * Load hermeneutic guidance document with contextual theoretical
   * questions per phase/step. Used by hermeneutic_read tool.
   *
   * @returns Hermeneutic guidance content
   */
  async loadHermeneuticGuidance(): Promise<string> {
    const filePath = await this.resolveMethodologyPath('hermeneutic_guidance.md', 'pedagogical');

    try {
      const content = await this.cachedReadFile(filePath);
      return content;
    } catch (error) {
      throw this.missingMethodology('Hermeneutic guidance', 'pedagogical/hermeneutic_guidance.md', filePath, error);
    }
  }

  /**
   * Extract a specific workflow section from Phase 9 methodology
   *
   * @param step - The step to extract ('steg1', 'steg2', 'steg3')
   * @returns Relevant section content
   */
  async extractPhase9Section(step: 'steg1' | 'steg2' | 'steg3'): Promise<string> {
    const methodology = await this.loadPhase9Methodology();

    const stepPatterns: Record<string, RegExp> = {
      steg1: /## STEG 1[:\s]*([\s\S]*?)(?=## STEG 2|## DEL 2|$)/i,
      steg2: /## STEG 2[:\s]*([\s\S]*?)(?=## STEG 3|## DEL 3|$)/i,
      steg3: /## STEG 3[:\s]*([\s\S]*?)(?=## STEG 4|## AVSLUTNING|$)/i,
    };

    const match = methodology.match(stepPatterns[step]);
    if (match) {
      return `## STEG ${step.replace('steg', '').toUpperCase()}\n${match[1].trim()}`;
    }

    return `[Section ${step} not found in methodology]`;
  }

  /**
   * The error for a methodology document that cannot be loaded. The document
   * is the source of truth, so loaders stop rather than use text in code.
   * @private
   */
  private missingMethodology(stage: string, relativePath: string, resolvedPath: string, error: unknown): Error {
    const reason = error instanceof Error ? error.message : String(error);
    return new Error(
      `${stage} methodology file could not be loaded: methodology/${relativePath} ` +
      `(resolved to ${resolvedPath}). The methodology document is the source of truth; ` +
      `provide the file rather than running with degraded fallback instructions. ` +
      `Underlying error: ${reason}`
    );
  }

  /**
   * Format a document section with clear header
   * @private
   */
  private formatSection(filename: string, content: string): string {
    const title = this.filenameToTitle(filename);
    return `# METODOLOGI: ${title}\n\n${content}`;
  }

  /**
   * Convert filename to readable title
   * @private
   */
  private filenameToTitle(filename: string): string {
    return filename
      .replace('.md', '')
      .replace(/_/g, ' ')
      .replace(/v\d+$/, '')
      .trim();
  }

  /**
   * Build header with load status
   * @private
   */
  private buildHeader(
    path: string,
    loaded: string[],
    failed: string[]
  ): string {
    const lines = [
      '# ANALYTISK BEDÖMNING - METODOLOGI',
      '',
      `**Källa:** ${path}`,
      `**Laddade dokument:** ${loaded.join(', ')}`,
    ];

    if (failed.length > 0) {
      lines.push(`**Varning - kunde ej ladda:** ${failed.join(', ')}`);
    }

    lines.push('');
    lines.push('---');

    return lines.join('\n');
  }

  /**
   * Extract key sections from methodology document
   * @private
   */
  private async extractKeySections(content: string): Promise<string> {
    const sections: string[] = [];

    // Extract key principles section
    const principlesMatch = content.match(
      /##\s*(?:Grundprinciper|Key Principles|Principer)([\s\S]*?)(?=##|$)/i
    );
    if (principlesMatch) {
      sections.push('## Key Principles\n' + principlesMatch[1].trim());
    }

    // Extract quality levels section
    const levelsMatch = content.match(
      /##\s*(?:Kvalitetsnivåer|Quality Levels|Nivåer)([\s\S]*?)(?=##|$)/i
    );
    if (levelsMatch) {
      sections.push('## Quality Levels\n' + levelsMatch[1].trim());
    }

    // Extract symbols section
    const symbolsMatch = content.match(
      /##\s*(?:Symboler|Symbols)([\s\S]*?)(?=##|$)/i
    );
    if (symbolsMatch) {
      sections.push('## Symbols\n' + symbolsMatch[1].trim());
    }

    if (sections.length === 0) {
      return await this.getFallbackSummary();
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Summary document used when the foundation cannot be condensed.
   * Loads methodology/fallback-summary.md; stops if that is missing too.
   * @private
   */
  private async getFallbackSummary(cause?: unknown): Promise<string> {
    const summaryPath = join(this.DEFAULT_PATH, 'fallback-summary.md');
    try {
      return await fs.readFile(summaryPath, 'utf-8');
    } catch (error) {
      const why = cause instanceof Error ? ` (${cause.message})` : '';
      throw this.missingMethodology(
        'Condensed assessment',
        'fallback-summary.md',
        summaryPath,
        new Error(
          `methodology/pedagogical/00_foundation.md could not be condensed${why}, ` +
          `and the summary document could not be read: ${error instanceof Error ? error.message : String(error)}`
        ),
      );
    }
  }
}

/**
 * Process-wide singleton. The file/path caches are meant to live for the whole
 * server process (methodology files do not change during a session), so tools
 * import this shared instance instead of constructing a fresh, empty-cache loader.
 */
export const methodologyLoader = new MethodologyLoader();
