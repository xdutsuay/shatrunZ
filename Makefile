# ShatrunZ Rust port — build/test entry points.
# See docs/plans/PLAN_03_rust_port.md and docs/RUST_PORT.md for the plan
# and the parity checklist this exists to serve.

.PHONY: setup build test wasm engine-c engine-oracle engine-rust p5-test py-test js-test rust-test all clean

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

# C engine oracle binary (parity dumps / pre-M7). Does not replace the default path.
ENGINE_ORACLE := engine/shatrunz_engine_c
engine-c engine-oracle:
	$(MAKE) -C engine
	cp -f engine/shatrunz_engine $(ENGINE_ORACLE)
	@if [ -f $(RUST_ENGINE) ]; then cp -f $(RUST_ENGINE) $(ENGINE_DEFAULT); echo "restored default from Rust build"; fi
	@echo "oracle: $(ENGINE_ORACLE)"

# Default UCI binary path used by Flask / pytest / mate scripts.
RUST_ENGINE := target/release/shatrunz_engine
ENGINE_DEFAULT := engine/shatrunz_engine

engine-rust:
	cargo build --release -p shatrunz-engine
	cp -f $(RUST_ENGINE) $(ENGINE_DEFAULT)
	@echo "installed: $(ENGINE_DEFAULT) <- $(RUST_ENGINE)"

# Prefer repo venv when present (fresh containers often lack bare `pytest`).
PYTEST := $(shell if [ -x .venv/bin/pytest ]; then echo .venv/bin/pytest; else echo pytest; fi)

# P5 gate: pytest against the installed default engine (Rust after engine-rust).
p5-test: engine-rust
	$(PYTEST) -q \
		tests/test_engine_uci.py \
		tests/test_engine.py \
		tests/test_castling.py \
		tests/test_engine_parity.py \
		tests/test_engine_mate_quiescence.py

py-test:
	$(PYTEST) -q

js-test:
	npm test

# Full local verification: everything that must stay green until deletion.
all: build rust-test engine-rust py-test js-test

clean:
	cargo clean
	$(MAKE) -C engine clean
	rm -f $(ENGINE_ORACLE)
