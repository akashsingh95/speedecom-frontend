#!/bin/bash
set -e

cd "$(dirname "$0")/.."

GITHUB_USERNAME=${GITHUB_USERNAME:-akashsingh95}
GHCR_REGISTRY="ghcr.io"
REPO_NAME="speedecom"

if [ -z "$GH_PAT" ]; then
  echo "WARNING: GH_PAT environment variable is not set. You may need to run 'docker login ghcr.io' manually."
else
  echo $GH_PAT | docker login $GHCR_REGISTRY -u $GITHUB_USERNAME --password-stdin
fi

CLIENT_IMAGE="speedecom-client:latest"
REMOTE_CLIENT_IMAGE="${GHCR_REGISTRY}/${GITHUB_USERNAME}/${REPO_NAME}-client:latest"

echo "Building Client image..."
docker build --build-arg VITE_ENABLE_MEESHO_AUTOSYNC="${VITE_ENABLE_MEESHO_AUTOSYNC}" -t $CLIENT_IMAGE .

docker tag $CLIENT_IMAGE $REMOTE_CLIENT_IMAGE

echo "Pushing Client image..."
docker push $REMOTE_CLIENT_IMAGE

echo "Client: $REMOTE_CLIENT_IMAGE"
