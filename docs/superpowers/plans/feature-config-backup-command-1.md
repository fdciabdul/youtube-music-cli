---
goal: Add config backup command to youtube-music-cli
version: 1.0
date_created: 2026-09-13
last_updated: 2026-09-13
owner: planning agent
status: 'Completed'
tags: ['feature', 'cli', 'config', 'backup']
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This plan describes the implementation of a new `youtube-music-cli config backup` command that backs up all user configuration and data files from `~/.youtube-music-cli/` to a timestamped backup directory under `~/.youtube-music-cli/backups/`.

The command will support:

- Creating full backups of all config files
- Listing available backups
- Restoring from a specific backup
- Cleaning old backups (retention policy)
- Optional compression (zip/tar.gz)

## 1. Requirements & Constraints

- **REQ-001**: Implement `youtube-music-cli config backup` subcommand with help text in CLI
- **REQ-002**: Backup all files in `CONFIG_DIR` (`~/.youtube-music-cli/`): config.json, favorites.json, history.json, player-state.json, downloads-index.json, invidious-health.json, musixmatch-token.json
- **REQ-003**: Create backups in `~/.youtube-music-cli/backups/` with timestamped directory names (e.g., `backup-2026-09-13T14-30-00/`)
- **REQ-004**: Support `config backup --list` to show available backups with timestamps and sizes
- **REQ-005**: Support `config backup --restore <backup-name>` to restore from a specific backup
- **REQ-006**: Support `config backup --clean [--keep=N]` to remove old backups keeping only N most recent (default: 10)
- **REQ-007**: Support `config backup --compress` to create compressed archive (zip on Windows, tar.gz on Unix)
- **REQ-008**: Use existing config service patterns (atomic writes, error handling, logging)
- **REQ-009**: Add proper TypeScript types for backup metadata
- **REQ-010**: Follow existing CLI command patterns in `source/cli.tsx`

- **SEC-001**: Never overwrite existing backups; use unique timestamps
- **SEC-002**: Validate backup integrity before restore (check required files exist)
- **SEC-003**: Don't backup the backups directory itself (avoid recursion)

- **CON-001**: Must work on Windows (PowerShell) and Unix-like systems
- **CON-002**: Use Bun/Node.js built-in APIs only (no external dependencies)
- **CON-003**: Follow existing code style (Prettier, ESLint, strict TypeScript)

- **GUD-001**: Follow existing `config doctor` pattern for subcommand structure
- **GUD-002**: Use existing logger service for output
- **GUD-003**: Use existing constants from `source/utils/constants.ts` for paths

- **PAT-001**: Use meow flag parsing like other subcommands
- **PAT-002**: Create new service file `source/services/config/backup.service.ts`
- **PAT-003**: Add types to `source/types/config.types.ts` or new `source/types/backup.types.ts`

## 2. Implementation Steps

### Implementation Phase 1: Types and Service Layer

- GOAL-001: Create backup types and core backup service

| Task     | Description                                                                                               | Completed | Date       |
| -------- | --------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Create `source/types/backup.types.ts` with `BackupMetadata`, `BackupOptions`, `RestoreOptions` interfaces | ✅        | 2026-09-13 |
| TASK-002 | Create `source/services/config/backup.service.ts` with `BackupService` class                              | ✅        | 2026-09-13 |
| TASK-003 | Implement `createBackup(options: BackupOptions): Promise<BackupMetadata>` method                          | ✅        | 2026-09-13 |
| TASK-004 | Implement `listBackups(): Promise<BackupMetadata[]>` method                                               | ✅        | 2026-09-13 |
| TASK-005 | Implement `restoreBackup(backupName: string, options: RestoreOptions): Promise<void>` method              | ✅        | 2026-09-13 |
| TASK-006 | Implement `cleanBackups(keepCount: number): Promise<number>` method                                       | ✅        | 2026-09-13 |
| TASK-007 | Implement `getBackupPath(backupName: string): string` helper                                              | ✅        | 2026-09-13 |
| TASK-008 | Add singleton getter `getBackupService()` following existing patterns                                     | ✅        | 2026-09-13 |
| TASK-009 | Export service from `source/services/config/index.ts` (if exists) or create barrel export                 | ✅        | 2026-09-13 |

### Implementation Phase 2: CLI Integration

- GOAL-002: Add `config backup` subcommand to CLI with all flags

| Task     | Description                                                                           | Completed | Date       |
| -------- | ------------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-010 | Add backup flags to `Flags` interface in `source/types/cli.types.ts`                  | ✅        | 2026-09-13 |
| TASK-011 | Add `config backup` help text to meow help string in `source/cli.tsx`                 | ✅        | 2026-09-13 |
| TASK-012 | Add `config backup` command handler in `source/cli.tsx` (after config doctor handler) | ✅        | 2026-09-13 |
| TASK-013 | Implement backup creation logic with progress output                                  | ✅        | 2026-09-13 |
| TASK-014 | Implement `--list` flag handler with formatted table output                           | ✅        | 2026-09-13 |
| TASK-015 | Implement `--restore <name>` flag handler with confirmation prompt                    | ✅        | 2026-09-13 |
| TASK-016 | Implement `--clean [--keep=N]` flag handler                                           | ✅        | 2026-09-13 |
| TASK-017 | Implement `--compress` flag handler (zip on Windows, tar.gz on Unix)                  | ✅        | 2026-09-13 |
| TASK-018 | Add `--dry-run` flag to preview what would be backed up/restored                      | ✅        | 2026-09-13 |

### Implementation Phase 3: Testing and Validation

- GOAL-003: Verify implementation works correctly

| Task     | Description                                                                 | Completed | Date       |
| -------- | --------------------------------------------------------------------------- | --------- | ---------- |
| TASK-019 | Run `bun run typecheck` to verify TypeScript compilation                    | ✅        | 2026-09-13 |
| TASK-020 | Run `bun run lint` to verify code style                                     | ✅        | 2026-09-13 |
| TASK-021 | Run `bun run build` to verify production build                              | ✅        | 2026-09-13 |
| TASK-022 | Test `ymc config backup` creates backup directory with all files            | ✅        | 2026-09-13 |
| TASK-023 | Test `ymc config backup --backup-list` shows backups correctly              | ✅        | 2026-09-13 |
| TASK-024 | Test `ymc config backup --backup-restore <name>` restores files correctly   | ✅        | 2026-09-13 |
| TASK-025 | Test `ymc config backup --backup-clean --backup-keep=5` removes old backups | ✅        | 2026-09-13 |
| TASK-026 | Test `ymc config backup --backup-compress` creates archive                  | ✅        | 2026-09-13 |
| TASK-027 | Test error handling: restore non-existent backup, corrupt backup, etc.      | ✅        | 2026-09-13 |

## 3. Alternatives

- **ALT-001**: Use external tool like `rsync` or `tar` - Rejected: Not cross-platform, adds dependency
- **ALT-002**: Backup only `config.json` - Rejected: User wants "settings anything inside users dir" - all data files
- **ALT-003**: Store backups in cloud - Rejected: Out of scope, local backup first
- **ALT-004**: Add to existing `config doctor` command - Rejected: Different purpose, backup is distinct operation

## 4. Dependencies

- **DEP-001**: Node.js `fs/promises`, `path`, `os` modules (built-in)
- **DEP-002**: Bun's `Bun.write` for atomic writes (optional, can use Node fs)
- **DEP-003**: Existing `CONFIG_DIR` constant from `source/utils/constants.ts`
- **DEP-004**: Existing `logger` service from `source/services/logger/logger.service.ts`

## 5. Files

- **FILE-001**: `source/types/backup.types.ts` (NEW) - Backup type definitions
- **FILE-002**: `source/services/config/backup.service.ts` (NEW) - Core backup service
- **FILE-003**: `source/types/cli.types.ts` (MODIFY) - Add backup flags to Flags interface
- **FILE-004**: `source/cli.tsx` (MODIFY) - Add config backup command handler and help text
- **FILE-005**: `source/services/config/index.ts` (MODIFY or CREATE) - Export backup service

## 6. Testing

- **TEST-001**: Unit tests for `BackupService` methods in `tests/backup.service.test.ts`
- **TEST-002**: Integration test for full backup/restore cycle
- **TEST-003**: Test backup with missing source files (graceful handling)
- **TEST-004**: Test restore with missing backup directory
- **TEST-005**: Test clean with various keep counts
- **TEST-006**: Test compressed backup creation and extraction

## 7. Risks & Assumptions

- **RISK-001**: Large download directories could make backups huge - Mitigation: Exclude downloads directory by default, only backup index file
- **RISK-002**: Restore could overwrite user data - Mitigation: Require confirmation prompt, show what will be restored
- **RISK-003**: Concurrent backup/restore operations - Mitigation: Use file locking like existing services
- **ASSUMPTION-001**: Config directory is `~/.youtube-music-cli/` (from constants.ts)
- **ASSUMPTION-002**: All config files are JSON (except logs which are text)
- **ASSUMPTION-003**: User has write permission to config directory

## 8. Related Specifications / Further Reading

- [CLI Command Structure](source/cli.tsx) - Existing command patterns
- [Config Service](source/services/config/config.service.ts) - Existing config patterns
- [Config Doctor](source/services/config/config-doctor.ts) - Similar subcommand pattern
- [Constants](source/utils/constants.ts) - CONFIG_DIR, CONFIG_FILE constants
