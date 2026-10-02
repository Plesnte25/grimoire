#!/usr/bin/env bash
set -euo pipefail

: "${GRIMOIRE_DEPLOY_HOST:?Set GRIMOIRE_DEPLOY_HOST to the SSH host or alias}"
: "${GRIMOIRE_DEPLOY_DIR:?Set GRIMOIRE_DEPLOY_DIR to the absolute repository path on the server}"

branch="${GRIMOIRE_DEPLOY_BRANCH:-main}"
bundle="${GRIMOIRE_DEPLOY_BUNDLE:-}"
if [[ "$GRIMOIRE_DEPLOY_DIR" != /* || "$GRIMOIRE_DEPLOY_DIR" == "/" ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_DIR must be an absolute non-root path." >&2
  exit 2
fi
if [[ "$GRIMOIRE_DEPLOY_DIR" == *"'"* ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_DIR must not contain single quotes." >&2
  exit 2
fi
if [[ ! "$branch" =~ ^[A-Za-z0-9._/-]+$ || "$branch" == -* ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_BRANCH contains unsupported characters." >&2
  exit 2
fi
if [[ -n "$bundle" && ( "$bundle" != /* || "$bundle" == *"'"* ) ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_BUNDLE must be an absolute path without single quotes." >&2
  exit 2
fi

printf -v remote_dir '%q' "$GRIMOIRE_DEPLOY_DIR"
printf -v remote_backup_dir '%q' "$GRIMOIRE_DEPLOY_DIR/backups"
printf -v remote_branch '%q' "$branch"
if [[ -n "$bundle" ]]; then
  printf -v remote_bundle '%q' "$bundle"
  source_update="git fetch $remote_bundle $remote_branch &&
    git merge --ff-only FETCH_HEAD &&
    rm -- $remote_bundle"
else
  source_update="git pull --ff-only origin $remote_branch"
fi
remote_command="cd $remote_dir &&
  $source_update &&
  cd backend &&
  npm ci &&
  npx prisma generate &&
  npm run build &&
  cd ../frontend &&
  npm ci &&
  npm run build &&
  cd ../backend &&
  mkdir -p $remote_backup_dir &&
  backup_file=$remote_backup_dir/pre-deploy-\$(date -u +%Y%m%dT%H%M%SZ).db &&
  printf \"VACUUM INTO '%s';\\n\" \"\$backup_file\" | npx prisma db execute --stdin --schema prisma/schema.prisma &&
  test -s \"\$backup_file\" &&
  npx prisma migrate deploy &&
  sudo systemctl restart grimoire &&
  sudo systemctl is-active --quiet grimoire &&
  curl --fail --silent --show-error http://127.0.0.1:5050/health"

ssh -- "$GRIMOIRE_DEPLOY_HOST" "$remote_command"
