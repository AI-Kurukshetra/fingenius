#!/bin/bash
# Pre-commit hook: runs typecheck and lint before allowing a commit.
# Claude Code hooks run automatically when configured in settings.json.
#
# HOW IT WORKS:
# - This script runs BEFORE Claude creates a git commit
# - If it exits with non-zero, the commit is blocked
# - This prevents broken code from being committed

set -e

echo "Running pre-commit checks..."

echo "1/2 Type checking..."
pnpm typecheck

echo "2/2 Linting..."
pnpm lint

echo "All pre-commit checks passed!"
