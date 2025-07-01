#!/bin/bash

# A simple script to set up an Act image for GitHub Actions testing.
# The image is used as an executable file to run the GitHub action.
#
# example:
# docker run -it --rm \
#  -v $(pwd):/workspace \
#  -v /var/run/docker.sock:/var/run/docker.sock \
#  act:dev \
#  -e workflow-test/issue-test-event.json \
#  -j send-issue-to-apply-allocator-be \
#  --verbose
#
# -f: Name of the GitHub action to launch.
# -e: JSON with the event body, if required.
# --verbose: for extended logging
#
# one liner: docker run -it --rm -v $(pwd):/workspace -v /var/run/docker.sock:/var/run/docker.sock act:dev -e workflow-test/issue-test-event.json  -j send-issue-to-apply-allocator-be --verbose


set -e

IMAGE_NAME="act"
IMAGE_TAG="dev"

echo "🔨 Building GitHub Actions test runner..."

docker build -f Dockerfile.act -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "✅ Successfully built ${IMAGE_NAME}:${IMAGE_TAG}"
echo ""
echo "Usage examples:"
echo "  # Test issues workflow:"
echo "  docker run --rm -it -v \$(pwd):/workspace -v /var/run/docker.sock:/var/run/docker.sock ${IMAGE_NAME}:${IMAGE_TAG} issues -e test-event.json --verbose"
echo ""
echo "  # List available workflows:"
echo "  docker run --rm -it -v \$(pwd):/workspace ${IMAGE_NAME}:${IMAGE_TAG} --list"
