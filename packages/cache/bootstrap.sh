#!/bin/bash
trap "rm server; kill 0" EXIT
tsc

node ./dist/main.js -port 8001 &
node ./dist/main.js -port 8002 &
node ./dist/main.js -port 8003 -api &

sleep 2
echo ">>> start test"
curl "http://localhost:9000/api?key=Alice" &
curl "http://localhost:9000/api?key=Bob" &
curl "http://localhost:9000/api?key=Lark" &

wait
