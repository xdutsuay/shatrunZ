# ShatrunZ Rust port — build/test entry points.
# See docs/plans/PLAN_03_rust_port.md and docs/RUST_PORT.md for the plan
# and the parity checklist this exists to serve.

.PHONY: setup build test wasm engine-c py-test js-test rust-test all clean

# One-time toolchain setup for a fresh container (idempotent).
setup:
	rustup target add wasm32-unknown-unknown
	cargo install wasm-pack --locked

build:
	cargo build --workspace

rust-test:
	cargo test --workspace

wasm:
	wasm-pack build crates/shatrunz-wasm --target web --release -d ../../frontend/pkg
	wasm-pack build crates/shatrunz-wasm --target nodejs --release -d ../../frontend/pkg-node

# Legacy C engine — still the parity oracle until P5 is green (see M7).
engine-c:
	$(MAKE) -C engine

py-test:
	pytest -q

js-test:
	npm test

# Full local verification: everything that must stay green until deletion.
all: build rust-test engine-c py-test js-test

clean:
	cargo clean
	$(MAKE) -C engine clean
