extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default)]
pub struct EnergyMap {
    energy: Vec<f32>,
    width: u32,
    height: u32,
}

impl EnergyMap {
    fn new(width: u32, height: u32) -> EnergyMap {
        EnergyMap {
            energy: vec![0.0; (width as usize) * (height as usize)],
            width,
            height,
        }
    }

    fn from_vec(energy: Vec<f32>, width: u32, height: u32) -> EnergyMap {
        debug_assert!(energy.len() == (width as usize) * (height as usize));
        EnergyMap {
            energy,
            width,
            height,
        }
    }

    fn len(&self) -> usize {
        self.energy.len()
    }

    fn width(&self) -> usize {
        self.width as usize
    }

    fn height(&self) -> usize {
        self.height as usize
    }

    fn row(&self, y: usize) -> &[f32] {
        &self.energy[(self.width as usize) * y..self.width() * (y + 1)]
    }

    unsafe fn get_unchecked_mut(&mut self, x: usize, y: usize) -> &mut f32 {
        let i = (self.width as usize) * y + x;
        debug_assert!(i < self.len());
        self.energy.get_unchecked_mut(i)
    }
}

#[wasm_bindgen]
pub fn rgba_to_energy(rgba: &[u8], width: u32, height: u32) -> EnergyMap {
    let size = (width as usize) * (height as usize);
    assert!(rgba.len() == 4 * size);

    let mut energy = vec![0f32; rgba.len()];

    for (i, e) in energy.iter_mut().enumerate() {
        let (r, g, b) = unsafe {
            let j = 4 * i;
            (
                *rgba.get_unchecked(j),
                *rgba.get_unchecked(j + 1),
                *rgba.get_unchecked(j + 2),
            )
        };

        *e = 0.3 * (r as f32) + 0.59 * (g as f32) + 0.11 * (b as f32);
    }

    EnergyMap::from_vec(energy, width, height)
}

fn sobel(a: f32, b: f32, c: f32, d: f32, e: f32, f: f32, g: f32, h: f32) -> f32 {
    let x = -a + c - 2.0 * d + 2.0 * e - f + h;
    let y = -a - 2.0 * b - c + f + 2.0 * g + h;
    (x * x + y * y).sqrt()
}

#[wasm_bindgen]
pub fn detect_edges(energy: EnergyMap) -> EnergyMap {
    if energy.len() == 0 {
        return EnergyMap::default();
    }

    if energy.width <= 1 {
        // FIXME
    }

    if energy.height <= 1 {
        // FIXME
    }

    // energy.width, energy.height >= 2

    let mut edges = EnergyMap::new(energy.width, energy.height);

    for y in 0..energy.height() {
        let row = energy.row(y);

        let prev_row = if y == 0 { row } else { energy.row(y - 1) };

        let next_row = if y == energy.height() - 1 {
            row
        } else {
            energy.row(y + 1)
        };

        unsafe {
            *edges.get_unchecked_mut(0, y) = sobel(
                *prev_row.get_unchecked(0),
                *prev_row.get_unchecked(0),
                *prev_row.get_unchecked(1),
                *row.get_unchecked(0),
                *row.get_unchecked(1),
                *next_row.get_unchecked(0),
                *next_row.get_unchecked(0),
                *next_row.get_unchecked(1),
            );

            *edges.get_unchecked_mut(energy.width() - 1, y) = sobel(
                *prev_row.get_unchecked(energy.width() - 2),
                *prev_row.get_unchecked(energy.width() - 1),
                *prev_row.get_unchecked(energy.width() - 1),
                *row.get_unchecked(energy.width() - 2),
                *row.get_unchecked(energy.width() - 1),
                *next_row.get_unchecked(energy.width() - 2),
                *next_row.get_unchecked(energy.width() - 1),
                *next_row.get_unchecked(energy.width() - 1),
            );
        }

        for x in 1..energy.width() - 1 {
            unsafe {
                *edges.get_unchecked_mut(x, y) = sobel(
                    *prev_row.get_unchecked(x - 1),
                    *prev_row.get_unchecked(x),
                    *prev_row.get_unchecked(x + 1),
                    *row.get_unchecked(x - 1),
                    *row.get_unchecked(x + 1),
                    *next_row.get_unchecked(x - 1),
                    *next_row.get_unchecked(x),
                    *next_row.get_unchecked(x + 1),
                )
            }
        }
    }

    energy
}
