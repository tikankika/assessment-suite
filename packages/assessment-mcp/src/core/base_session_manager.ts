/**
 * BaseSessionManager - Generic session management for Phase 10-12 orchestrators
 *
 * RFC-029 §15: Eliminates ~220 lines of identical CRUD code across three
 * phase orchestrators by extracting the shared Map-based session pattern.
 *
 * Each phase extends this class, keeping only its phase-specific
 * `createSession()` method and any extra helpers.
 */

/**
 * Common fields shared by all phase sessions (10, 11, 12).
 */
export interface BaseSession {
  session_id: string;
  project_path: string;
  student_id: string;
  course_name: string;
  exam_name: string;
  methodology: string;
  current_step: string;
  started_at: Date;
  last_updated: Date;
}

/**
 * Generate a unique session ID with a phase prefix.
 *
 * @param prefix - Phase prefix, e.g. "phase10", "phase11", "phase12"
 * @param studentId - Student identifier
 */
export function generateSessionId(prefix: string, studentId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${studentId}_${timestamp}_${random}`;
}

/**
 * Generic in-memory session manager.
 *
 * Subclasses implement `createSession()` with phase-specific initial state.
 * CRUD methods (get/update/delete) are identical across phases and live here.
 */
export class BaseSessionManager<T extends BaseSession> {
  protected sessions: Map<string, T> = new Map();

  /**
   * Store a newly created session. Called by subclass `createSession()`.
   */
  protected addSession(session: T): void {
    this.sessions.set(session.session_id, session);
  }

  /**
   * Retrieve a session by ID. Updates `last_updated` on access.
   */
  getSession(sessionId: string): T | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.last_updated = new Date();
    }
    return session;
  }

  /**
   * Partially update a session. Merges updates and bumps `last_updated`.
   */
  updateSession(sessionId: string, updates: Partial<T>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates, { last_updated: new Date() });
    }
  }

  /**
   * Remove a session (cleanup after completion).
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
