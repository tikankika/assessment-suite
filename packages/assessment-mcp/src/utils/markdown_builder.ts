/**
 * Markdown Builder Utility
 *
 * Helps build structured markdown documents for Phase 9-12 outputs.
 * Provides a fluent API for constructing complex markdown.
 */

/**
 * Markdown Builder class for constructing documents
 */
export class MarkdownBuilder {
  private lines: string[] = [];

  /**
   * Add a heading
   */
  heading(level: 1 | 2 | 3 | 4 | 5 | 6, text: string): this {
    this.lines.push(`${'#'.repeat(level)} ${text}`);
    this.lines.push('');
    return this;
  }

  /**
   * Add H1 heading
   */
  h1(text: string): this {
    return this.heading(1, text);
  }

  /**
   * Add H2 heading
   */
  h2(text: string): this {
    return this.heading(2, text);
  }

  /**
   * Add H3 heading
   */
  h3(text: string): this {
    return this.heading(3, text);
  }

  /**
   * Add H4 heading
   */
  h4(text: string): this {
    return this.heading(4, text);
  }

  /**
   * Add a paragraph
   */
  paragraph(text: string): this {
    this.lines.push(text);
    this.lines.push('');
    return this;
  }

  /**
   * Add bold text on its own line
   */
  bold(text: string): this {
    this.lines.push(`**${text}**`);
    return this;
  }

  /**
   * Add italic text on its own line
   */
  italic(text: string): this {
    this.lines.push(`*${text}*`);
    return this;
  }

  /**
   * Add a key-value metadata line
   */
  metadata(key: string, value: string): this {
    this.lines.push(`**${key}:** ${value}`);
    return this;
  }

  /**
   * Add multiple metadata lines
   */
  metadataBlock(items: Record<string, string>): this {
    for (const [key, value] of Object.entries(items)) {
      this.metadata(key, value);
    }
    this.lines.push('');
    return this;
  }

  /**
   * Add a horizontal rule
   */
  hr(): this {
    this.lines.push('');
    this.lines.push('---');
    this.lines.push('');
    return this;
  }

  /**
   * Add an unordered list
   */
  list(items: string[]): this {
    for (const item of items) {
      this.lines.push(`- ${item}`);
    }
    this.lines.push('');
    return this;
  }

  /**
   * Add an ordered list
   */
  orderedList(items: string[]): this {
    items.forEach((item, index) => {
      this.lines.push(`${index + 1}. ${item}`);
    });
    this.lines.push('');
    return this;
  }

  /**
   * Add a blockquote
   */
  blockquote(text: string): this {
    const lines = text.split('\n');
    for (const line of lines) {
      this.lines.push(`> ${line}`);
    }
    this.lines.push('');
    return this;
  }

  /**
   * Add a code block
   */
  codeBlock(code: string, language: string = ''): this {
    this.lines.push(`\`\`\`${language}`);
    this.lines.push(code);
    this.lines.push('```');
    this.lines.push('');
    return this;
  }

  /**
   * Add inline code
   */
  inlineCode(code: string): this {
    this.lines.push(`\`${code}\``);
    return this;
  }

  /**
   * Add a simple table
   */
  table(headers: string[], rows: string[][]): this {
    // Header row
    this.lines.push(`| ${headers.join(' | ')} |`);

    // Separator
    this.lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

    // Data rows
    for (const row of rows) {
      this.lines.push(`| ${row.join(' | ')} |`);
    }

    this.lines.push('');
    return this;
  }

  /**
   * Add a blank line
   */
  blank(): this {
    this.lines.push('');
    return this;
  }

  /**
   * Add raw text (no formatting)
   */
  raw(text: string): this {
    this.lines.push(text);
    return this;
  }

  /**
   * Add multiple raw lines
   */
  rawLines(lines: string[]): this {
    this.lines.push(...lines);
    return this;
  }

  /**
   * Add a section with heading and content
   */
  section(level: 1 | 2 | 3 | 4, title: string, content: string): this {
    this.heading(level, title);
    this.paragraph(content);
    return this;
  }

  /**
   * Add a collapsible details section (GitHub-flavored markdown)
   */
  details(summary: string, content: string): this {
    this.lines.push('<details>');
    this.lines.push(`<summary>${summary}</summary>`);
    this.lines.push('');
    this.lines.push(content);
    this.lines.push('');
    this.lines.push('</details>');
    this.lines.push('');
    return this;
  }

  /**
   * Build the final markdown string
   */
  build(): string {
    return this.lines.join('\n');
  }

  /**
   * Clear all content
   */
  clear(): this {
    this.lines = [];
    return this;
  }

  /**
   * Get current line count
   */
  lineCount(): number {
    return this.lines.length;
  }
}

/**
 * Create a new MarkdownBuilder instance
 */
export function createMarkdownBuilder(): MarkdownBuilder {
  return new MarkdownBuilder();
}

/**
 * Format a date for markdown display
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}


/**
 * Create a progress bar in markdown
 */
export function progressBar(current: number, total: number, width: number = 20): string {
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage}% (${current}/${total})`;
}

/**
 * Format a number as percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format points display
 */
export function formatPoints(points: number, maxPoints: number): string {
  return `${points}/${maxPoints}p`;
}
