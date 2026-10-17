import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';

/** configuration file shape: mirrors the CLI flags (see the README for the schema) */
export interface BenchConfig {
  quick?: boolean;
  repeats?: number;
  framework?: string;
  scenario?: string;
  output?: string;
}

export interface LoadedBenchConfig {
  config: BenchConfig;
  /** path of the config file that was loaded, or null when none exists */
  path: string | null;
}

const VALID_KEYS = ['quick', 'repeats', 'framework', 'scenario', 'output'] as const;

const defaultConfigPath = fileURLToPath(new URL('../bench.config.toml', import.meta.url));

/**
 * Load benchmark configuration. An explicitly passed `--config` path must exist; the default
 * `bench.config.toml` is optional. CLI flags take precedence over config values, which take
 * precedence over the built-in defaults.
 */
export function loadBenchConfig(explicitPath?: string): LoadedBenchConfig {
  const path = explicitPath ? resolve(explicitPath) : defaultConfigPath;

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    if (explicitPath) {
      throw new Error(`cannot read config file '${explicitPath}'`);
    }
    return { config: {}, path: null };
  }

  return { config: parseBenchConfig(raw, path), path };
}

function parseBenchConfig(raw: string, path: string): BenchConfig {
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`config file '${path}' is not valid TOML${reason}`, { cause: error });
  }

  const config: BenchConfig = {};
  for (const [key, value] of Object.entries(parsed)) {
    switch (key) {
      case 'quick':
        if (typeof value !== 'boolean') {
          throw new Error(`config 'quick' must be a boolean, got ${jsonOf(value)}`);
        }
        config.quick = value;
        break;

      case 'repeats':
        if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
          throw new Error(`config 'repeats' must be a positive integer, got ${jsonOf(value)}`);
        }
        config.repeats = value;
        break;

      case 'framework':
      case 'scenario':
        if (typeof value === 'string') {
          config[key] = value;
        } else if (isStringArray(value)) {
          config[key] = value.join(',');
        } else {
          throw new Error(`config '${key}' must be a string or string[], got ${jsonOf(value)}`);
        }
        break;

      case 'output':
        if (typeof value !== 'string') {
          throw new Error(`config 'output' must be a string, got ${jsonOf(value)}`);
        }
        config.output = value;
        break;

      default:
        throw new Error(
          `config file '${path}' has unknown key '${key}'. Valid keys: ${VALID_KEYS.join(', ')}`,
        );
    }
  }

  return config;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function jsonOf(value: unknown): string {
  return JSON.stringify(value);
}
