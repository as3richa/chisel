use crate::CarvingContext;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmCarvingContext(CarvingContext);

#[wasm_bindgen]
impl WasmCarvingContext {
    #[wasm_bindgen(constructor)]
    pub fn new(rgba: Vec<u8>, width: u32, height: u32) -> WasmCarvingContext {
        WasmCarvingContext(CarvingContext::new(rgba, width, height))
    }

    pub fn intens(&self) -> *const u8 {
        self.0.intens.as_ptr()
    }

    pub fn edges(&self) -> *const i16 {
        self.0.edges.as_ptr()
    }

    pub fn carve(&self, width: u32, height: u32) -> Vec<u8> {
        self.0.carve(width, height)
    }
}
