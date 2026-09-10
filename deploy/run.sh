#!/bin/sh
set -eu
image=${1:?Usage: sh deploy/run.sh daily-fuel:release-tag}
docker run -d \
  --name daily-fuel \
  --restart unless-stopped \
  --publish 8088:8080 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m,mode=1777 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --memory 192m \
  --cpus 1 \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "$image"
