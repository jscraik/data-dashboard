/**
 * Filesystem watcher for ~/.codex/sessions
 * Auto-scores new session logs and reports completion
 */

import { watch, type FSWatcher } from "node:fs";
import { readFile, stat, mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname, basename, relative } from "node:path";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";

interface SessionScore {
  sessionId: string;
  filePath: string;
  timestamp: string;
  metrics: SessionMetrics;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
}

interface SessionMetrics {
  totalEvents: number;
  toolCalls: number;
  toolBreakdown: Record<string, number>;
  errors: number;
  duration?: number;
  userMessages: number;
  assistantMessages: number;
  reasoningEvents: number;
}

interface ScoreReport {
  lastScan: string;
  totalSessions: number;
  scores: SessionScore[];
}

const SESSIONS_DIR = process.env.SESSIONS_DIR || join(process.env.HOME || "~", ".codex", "sessions");
const SCORES_FILE = process.env.SCORES_FILE || join(process.cwd(), "session-scores.json");

/**
 * Parse a session JSONL file and extract metrics
 */
async function parseSessionFile(filePath: string): Promise<SessionMetrics> {
  const metrics: SessionMetrics = {
    totalEvents: 0,
    toolCalls: 0,
    toolBreakdown: {},
    errors: 0,
    userMessages: 0,
    assistantMessages: 0,
    reasoningEvents: 0,
  };

  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;

  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const event = JSON.parse(line);
      metrics.totalEvents++;

      // Track timestamps for duration
      if (event.timestamp) {
        const ts = new Date(event.timestamp);
        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
      }

      // Count by event type
      if (event.type === "response_item") {
        const payload = event.payload || {};

        if (payload.type === "function_call") {
          metrics.toolCalls++;
          const toolName = payload.name || "unknown";
          metrics.toolBreakdown[toolName] = (metrics.toolBreakdown[toolName] || 0) + 1;
        } else if (payload.type === "reasoning") {
          metrics.reasoningEvents++;
        } else if (payload.type === "message") {
          const role = payload.role || "unknown";
          if (role === "user") {
            metrics.userMessages++;
          } else if (role === "assistant" || role === "developer") {
            metrics.assistantMessages++;
          }
        }
      } else if (event.type === "event_msg") {
        const eventType = event.payload?.event_type;
        if (eventType === "error" || eventType === "tool_error") {
          metrics.errors++;
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (firstTimestamp && lastTimestamp) {
    metrics.duration = lastTimestamp.getTime() - firstTimestamp.getTime();
  }

  return metrics;
}

/**
 * Calculate a score based on session metrics
 * Returns a score from 0-100 and a letter grade
 */
function calculateScore(metrics: SessionMetrics): { score: number; grade: SessionScore["grade"]; summary: string } {
  let score = 100;

  // Deduct for errors (major penalty)
  score -= metrics.errors * 10;

  // Reward for tool usage variety (up to 15 points)
  const uniqueTools = Object.keys(metrics.toolBreakdown).length;
  score += Math.min(uniqueTools * 3, 15);

  // Reward for reasoning events (up to 10 points)
  score += Math.min(metrics.reasoningEvents * 5, 10);

  // Penalty for very short sessions (likely incomplete)
  if (metrics.totalEvents < 5) {
    score -= 20;
  }

  // Penalty for sessions with no tool calls (likely just chat)
  if (metrics.toolCalls === 0) {
    score -= 15;
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: SessionScore["grade"];
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  else grade = "F";

  // Generate summary
  const parts: string[] = [];
  parts.push(`${metrics.totalEvents} events`);
  parts.push(`${metrics.toolCalls} tool calls`);
  if (metrics.errors > 0) parts.push(`${metrics.errors} errors`);
  if (metrics.reasoningEvents > 0) parts.push(`${metrics.reasoningEvents} reasoning`);

  const summary = parts.join(", ");

  return { score, grade, summary };
}

/**
 * Score a single session file
 */
async function scoreSessionFile(filePath: string): Promise<SessionScore> {
  const metrics = await parseSessionFile(filePath);
  const { score, grade, summary } = calculateScore(metrics);

  // Extract session ID from filename
  const fileName = basename(filePath, ".jsonl");
  const sessionId = fileName.replace(/^rollout-/, "");

  return {
    sessionId,
    filePath,
    timestamp: new Date().toISOString(),
    metrics,
    score,
    grade,
    summary,
  };
}

/**
 * Load existing scores from disk
 */
async function loadScores(): Promise<ScoreReport> {
  try {
    await access(SCORES_FILE);
    const data = await readFile(SCORES_FILE, "utf-8");
    return JSON.parse(data) as ScoreReport;
  } catch {
    return {
      lastScan: new Date().toISOString(),
      totalSessions: 0,
      scores: [],
    };
  }
}

/**
 * Save scores to disk
 */
async function saveScores(report: ScoreReport): Promise<void> {
  await mkdir(dirname(SCORES_FILE), { recursive: true });
  await writeFile(SCORES_FILE, JSON.stringify(report, null, 2));
}

/**
 * Check if a file has already been scored
 */
function isAlreadyScored(filePath: string, report: ScoreReport): boolean {
  return report.scores.some((s) => s.filePath === filePath);
}

/**
 * Process a new session file
 */
async function processSessionFile(filePath: string, report: ScoreReport): Promise<void> {
  // Skip if already scored
  if (isAlreadyScored(filePath, report)) {
    return;
  }

  // Skip non-JSONL files
  if (!filePath.endsWith(".jsonl")) {
    return;
  }

  try {
    const score = await scoreSessionFile(filePath);
    report.scores.push(score);
    report.totalSessions = report.scores.length;
    report.lastScan = new Date().toISOString();

    // Save updated report
    await saveScores(report);

    // Report completion
    console.log(`[${new Date().toISOString()}] Scored session: ${score.sessionId}`);
    console.log(`  Grade: ${score.grade} (${score.score}/100)`);
    console.log(`  Summary: ${score.summary}`);
    console.log(`  Tools used: ${Object.keys(score.metrics.toolBreakdown).join(", ") || "none"}`);
    console.log("");
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error scoring ${filePath}:`, error);
  }
}

/**
 * Scan all existing session files
 */
async function scanAllSessions(): Promise<void> {
  const report = await loadScores();
  const { glob } = await import("glob");

  const pattern = join(SESSIONS_DIR, "**/*.jsonl");
  const files = await glob(pattern);

  console.log(`[${new Date().toISOString()}] Scanning ${files.length} session files...`);

  let newCount = 0;
  for (const file of files) {
    if (!isAlreadyScored(file, report)) {
      await processSessionFile(file, report);
      newCount++;
    }
  }

  console.log(`[${new Date().toISOString()}] Scan complete. ${newCount} new sessions scored.`);
  console.log(`[${new Date().toISOString()}] Total sessions in database: ${report.totalSessions}`);
}

/**
 * Start watching for new session files
 */
export function startWatcher(): FSWatcher {
  console.log(`[${new Date().toISOString()}] Starting session watcher...`);
  console.log(`  Watching: ${SESSIONS_DIR}`);
  console.log(`  Scores file: ${SCORES_FILE}`);
  console.log("");

  // Initial scan
  scanAllSessions().catch(console.error);

  // Set up watcher
  const watcher = watch(SESSIONS_DIR, { recursive: true }, async (eventType, filename) => {
    if (!filename || !filename.endsWith(".jsonl")) {
      return;
    }

    const filePath = join(SESSIONS_DIR, filename);

    // Small delay to ensure file is fully written
    await new Promise((resolve) => setTimeout(resolve, 100));

    const report = await loadScores();
    await processSessionFile(filePath, report);
  });

  return watcher;
}

/**
 * Get a summary report of all scores
 */
export async function getSummaryReport(): Promise<void> {
  const report = await loadScores();

  console.log("\n=== Session Scoring Report ===\n");
  console.log(`Last scan: ${report.lastScan}`);
  console.log(`Total sessions: ${report.totalSessions}`);

  if (report.scores.length === 0) {
    console.log("\nNo sessions scored yet.");
    return;
  }

  // Grade distribution
  const grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const score of report.scores) {
    grades[score.grade]++;
  }

  console.log("\nGrade Distribution:");
  for (const [grade, count] of Object.entries(grades)) {
    const bar = "█".repeat(count);
    console.log(`  ${grade}: ${bar} (${count})`);
  }

  // Average score
  const avgScore = report.scores.reduce((sum, s) => sum + s.score, 0) / report.scores.length;
  console.log(`\nAverage Score: ${avgScore.toFixed(1)}/100`);

  // Recent sessions
  console.log("\nRecent Sessions:");
  const recent = report.scores.slice(-5).reverse();
  for (const score of recent) {
    console.log(`  ${score.grade} ${score.score.toString().padStart(3)} - ${score.sessionId.slice(0, 20)}... (${score.summary})`);
  }

  console.log("\n");
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--report")) {
    await getSummaryReport();
    process.exit(0);
  }

  if (args.includes("--scan")) {
    await scanAllSessions();
    process.exit(0);
  }

  // Default: start watcher
  const watcher = startWatcher();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down watcher...");
    watcher.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    watcher.close();
    process.exit(0);
  });
}
