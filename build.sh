#!/bin/bash
set -e

RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release

mkdir -p ../out
cp target/wasm32-unknown-unknown/release/linkdrop_proxy.wasm ./out/main.wasm
