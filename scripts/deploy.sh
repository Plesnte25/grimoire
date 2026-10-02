#!/usr/bin/env bash
set -euo pipefail

: "${GRIMOIRE_DEPLOY_DIR:?Set GRIMOIRE_DEPLOY_DIR to the absolute repository path on the server}"

branch="${GRIMOIRE_DEPLOY_BRANCH:-main}"
instance="${GRIMOIRE_DEPLOY_INSTANCE:-grimoire}"
zone="${GRIMOIRE_DEPLOY_ZONE:-us-central1-a}"
project="${GRIMOIRE_DEPLOY_PROJECT:-azubiweg}"

if [[ "$GRIMOIRE_DEPLOY_DIR" != /* || "$GRIMOIRE_DEPLOY_DIR" == "/" || "$GRIMOIRE_DEPLOY_DIR" == *"'"* ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_DIR must be an absolute non-root path without single quotes." >&2
  exit 2
fi
if [[ ! "$branch" =~ ^[A-Za-z0-9._/-]+$ || "$branch" == -* ]]; then
  printf '%s\n' "GRIMOIRE_DEPLOY_BRANCH contains unsupported characters." >&2
  exit 2
fi
if [[ ! "$instance" =~ ^[a-z]([-a-z0-9]*[a-z0-9])?$ || ! "$zone" =~ ^[a-z]+-[a-z]+[0-9]+-[a-z]+$ || ! "$project" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
  printf '%s\n' "Set a valid Compute Engine instance name, zone, and project ID." >&2
  exit 2
fi

commit="$(git rev-parse --verify "$branch^{commit}")"
bundle_dir="$(mktemp -d /tmp/grimoire-deploy.XXXXXX)"
bundle_file="$bundle_dir/commit.bundle"
remote_bundle="/tmp/grimoire-deploy-${commit:0:12}.bundle"
printf -v remote_dir '%q' "$GRIMOIRE_DEPLOY_DIR"
printf -v remote_backup_dir '%q' "$GRIMOIRE_DEPLOY_DIR/backups"
printf -v remote_bundle_arg '%q' "$remote_bundle"
printf -v remote_branch '%q' "$branch"

cleanup() {
  rm -f -- "$bundle_file"
  rmdir -- "$bundle_dir"
}
trap cleanup EXIT

git bundle create "$bundle_file" "$branch"
gcloud compute ssh "$instance" --zone "$zone" --project "$project" --command "test ! -e '$remote_bundle'"
gcloud compute scp --zone "$zone" --project "$project" "$bundle_file" "$instance:$remote_bundle"

remote_command="cd $remote_dir &&
  git fetch $remote_bundle_arg $remote_branch &&
  git merge --ff-only FETCH_HEAD &&
  rm -- $remote_bundle_arg &&
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

gcloud compute ssh "$instance" --zone "$zone" --project "$project" --command "$remote_command"
