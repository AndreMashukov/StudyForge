#!/usr/bin/env bash
# One-time setup for the release pipeline's keyless GitHub → GCP auth (Workload Identity Federation).
# Safe to re-run: existing resources are kept and bindings are idempotent.
#
#   gcloud auth login               # as a project owner
#   scripts/release/setup-release-identity.sh
#
# Creates:
#   - pool `github-actions` + provider `github` (only this repository's OIDC tokens are accepted)
#   - SA `github-release`          — deploy identity, usable only from refs/heads/main
#   - SA `github-release-preview`  — read-only, usable from any ref (PR plan previews)
# Then prints the repository variables to set.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-study-forge-202604}"
REPO="${REPO:-AndreMashukov/StudyForge}"
POOL="github-actions"
PROVIDER="github"
DEPLOY_SA="github-release@${PROJECT_ID}.iam.gserviceaccount.com"
PREVIEW_SA="github-release-preview@${PROJECT_ID}.iam.gserviceaccount.com"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}"

echo "Project ${PROJECT_ID} (${PROJECT_NUMBER}), repo ${REPO}"

# cloudbilling: firebase deploy checks the Blaze plan before a functions deploy; with a service
# account the call is billed to this project, so the API must be enabled here.
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com \
  cloudbilling.googleapis.com --project "$PROJECT_ID"

if ! gcloud iam workload-identity-pools describe "$POOL" --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL" --location=global --project "$PROJECT_ID" \
    --display-name="GitHub Actions"
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER" --workload-identity-pool="$POOL" \
  --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --workload-identity-pool="$POOL" --location=global --project "$PROJECT_ID" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository == '${REPO}'"
fi

for SA in github-release github-release-preview; do
  if ! gcloud iam service-accounts describe "${SA}@${PROJECT_ID}.iam.gserviceaccount.com" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SA" --project "$PROJECT_ID" --display-name="Release pipeline (${SA})"
  fi
done

# Deploy identity. Resource-level IAM only — no projectIamAdmin.
# Role set follows Firebase's CI deploy guidance for Hosting + Functions v2 + rules/indexes,
# plus Firestore read/write for migrations and the Migration ledger. Trim if a deploy proves one unnecessary.
DEPLOY_ROLES=(
  roles/firebase.admin                    # Hosting, rules releases, Firebase project metadata
  roles/firebaserules.admin
  roles/cloudfunctions.admin              # deploy functions, set function IAM
  roles/run.admin                         # Functions v2 run on Cloud Run; invoker bindings
  roles/iam.serviceAccountUser            # act as the functions runtime service account
  roles/cloudbuild.builds.editor
  roles/artifactregistry.admin            # function images + cleanup policy
  roles/cloudscheduler.admin              # onSchedule functions
  roles/cloudtasks.admin                  # onTaskDispatched queues + queue IAM
  roles/pubsub.admin                      # onMessagePublished topics + topic IAM
  roles/eventarc.admin                    # Firestore / Pub/Sub triggers
  roles/secretmanager.admin               # CLI grants the runtime SA access to defineSecret secrets
  roles/datastore.indexAdmin              # firestore:indexes
  roles/datastore.user                    # migrations + Migration ledger
  roles/serviceusage.serviceUsageConsumer
)
for ROLE in "${DEPLOY_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${DEPLOY_SA}" \
    --role="$ROLE" --condition=None --quiet --format=none
done

PREVIEW_ROLES=(
  roles/cloudfunctions.viewer   # list deployed functions
  roles/datastore.viewer        # read the Migration ledger
  roles/secretmanager.viewer    # list secret names (not values)
)
for ROLE in "${PREVIEW_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${PREVIEW_SA}" \
    --role="$ROLE" --condition=None --quiet --format=none
done

# Who may impersonate which SA.
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --project "$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.ref/refs/heads/main" --format=none
gcloud iam service-accounts add-iam-policy-binding "$PREVIEW_SA" --project "$PROJECT_ID" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}" --format=none

cat <<EOF

Done. Set these repository variables (not secrets):

  gh variable set GCP_WIF_PROVIDER --repo ${REPO} --body "${POOL_ID}/providers/${PROVIDER}"
  gh variable set GCP_RELEASE_SA --repo ${REPO} --body "${DEPLOY_SA}"
  gh variable set GCP_RELEASE_PREVIEW_SA --repo ${REPO} --body "${PREVIEW_SA}"

And the LLM key as a secret:

  gh secret set TOGETHER_API_KEY --repo ${REPO}

Then, once:
  - firebase functions:artifacts:setpolicy --project ${PROJECT_ID} --location asia-east1 --days 7
    (non-interactive deploys fail if no Artifact Registry cleanup policy exists)
  - tsx scripts/release/seed-migration-ledger.ts --write
  - Run the Release workflow manually with deploy_all=true for the first release.
EOF
