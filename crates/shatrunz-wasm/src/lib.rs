//! wasm-bindgen boundary over shatrunz-core. `WasmGame` and the free
//! functions described in docs/plans/PLAN_03_rust_port.md land here in M5;
//! this stub only proves the wasm-pack toolchain builds end to end.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn core_crate_name() -> String {
    shatrunz_core::CRATE_NAME.to_string()
}
