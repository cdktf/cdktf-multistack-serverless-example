#!/bin/bash

set -ex

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE:-$0}")/.." && pwd)
CDKTF_VERSION=$1

if [ -z "$CDKTF_VERSION" ]; then
  echo "Usage: $0 <cdktf-version>"
  exit 1
fi

echo "Updating to cdktf version $CDKTF_VERSION"
cd $PROJECT_ROOT

yarn add -D -W cdktf-cli@$CDKTF_VERSION
yarn add -W cdktf@$CDKTF_VERSION @cdktf/provider-aws@latest @cdktf/provider-local@latest
