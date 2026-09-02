import { spawn } from 'node:child_process';
import type { Logger } from '@video/shared/server';

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface RunCommandOptions {
  args: string[];
  onStdoutLine?: (line: string) => void;
  onStderrLine?: (line: string) => void;
  cwd?: string;
  timeoutMs?: number;
}

export function runCommand(
  binary: string,
  options: RunCommandOptions,
  logger: Logger,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    logger.info({ binary, args: options.args }, 'Spawning process');
    const child = spawn(binary, options.args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      callback();
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() => {
          reject(new Error(`${binary} timed out after ${options.timeoutMs}ms`));
        });
      }, options.timeoutMs);
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        options.onStdoutLine?.(line.trim());
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() ?? '';
      for (const line of lines) {
        options.onStderrLine?.(line);
      }
    });

    child.on('error', (error) => {
      finish(() => {
        reject(error);
      });
    });

    child.on('close', (code) => {
      finish(() => {
        if (stdoutBuffer.trim()) {
          options.onStdoutLine?.(stdoutBuffer.trim());
        }
        if (code === 0) {
          resolve({ stdout, stderr });
          return;
        }
        const error = new Error(`${binary} exited with code ${code ?? 'unknown'}`);
        Object.assign(error, { stderr, stdout, exitCode: code });
        reject(error);
      });
    });
  });
}

export function parseFfmpegProgress(line: string): number | null {
  if (!line.startsWith('out_time_ms=') && !line.startsWith('out_time_us=')) {
    return null;
  }
  const raw = line.split('=')[1];
  if (!raw || raw === 'N/A') {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (line.startsWith('out_time_us=') || line.startsWith('out_time_ms=')) {
    return value / 1_000_000;
  }
  return null;
}
