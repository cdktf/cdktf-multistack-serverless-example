#!/bin/bash

set -ex

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE:-$0}")/.." && pwd)
CDKTF_VERSION=$1

if [ -z "$CDKTF_VERSION" ]; then
  echo "Usage: $0 <cdktf-version>"
  exit 1
fi

echo "Updating to cdktf version $CDKTF_VERSION"
git checkout -b "cdktf-$CDKTF_VERSION"
cd $PROJECT_ROOT

yarn add -D -W cdktf-cli@$CDKTF_VERSION
yarn add -W cdktf@$CDKTF_VERSION @cdktf/provider-aws@latest @cdktf/provider-local@latest

git add .
git commit -m "feat: update to cdktf $CDKTF_VERSION"
git push origin "cdktf-$CDKTF_VERSION"

gh label create -f "cdktf-update-$CDKTF_VERSION"
gh pr create --fill --base main --head "cdktf-$CDKTF_VERSION" --title "feat: update to cdktf $CDKTF_VERSION" --label "cdktf-update-$CDKTF_VERSION"


