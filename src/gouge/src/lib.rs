extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
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

    unsafe fn get_row_unchecked(&self, y: usize) -> &[f32] {
        debug_assert!(y < self.height() && y * self.width() < self.len());
        self.energy
            .get_unchecked(self.width() * y..self.width() * (y + 1))
    }

    unsafe fn get_unchecked(&self, x: usize, y: usize) -> &f32 {
        let i = self.width() * y + x;
        debug_assert!(x < self.width() && y < self.height() && i < self.len());
        self.energy.get_unchecked(i)
    }

    unsafe fn get_unchecked_mut(&mut self, x: usize, y: usize) -> &mut f32 {
        let i = self.width() * y + x;
        debug_assert!(x < self.width() && y < self.height() && i < self.len());
        self.energy.get_unchecked_mut(i)
    }
}

#[wasm_bindgen]
extern "C" {
    fn alert(message: &str);
}

#[wasm_bindgen]
pub fn rgba_to_energy(rgba: &[u8], width: u32, height: u32) -> EnergyMap {
    let size = (width as usize) * (height as usize);
    assert!(rgba.len() == 4 * size);

    let s = rgba.len().to_string();
    alert(&s);

    let mut energy = vec![0f32; size];

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

#[wasm_bindgen]
pub fn energy_to_rgba(energy: &EnergyMap) -> Vec<u8> {
    if energy.len() == 0 {
        return vec![];
    }

    let (min, max) = {
        let init = unsafe {
            let value = energy.get_unchecked(0, 0);
            (*value, *value)
        };


        energy.energy.iter().fold(init, { |(min, max), &value|
            (f32::min(min, value), f32::max(max, value))
        })
    };

    let range = if max - min <= 1e-4 {
        1.0
    } else {
        max - min
    };

    let mut rgba = vec![0u8; 4 * energy.len()];

    for (i, &e) in energy.energy.iter().enumerate() {
        let j = 4 * i;
        let byte = (255.0 * (e - min) / range).round() as u8;

        unsafe {
            *rgba.get_unchecked_mut(j) = byte;
            *rgba.get_unchecked_mut(j + 1) = byte;
            *rgba.get_unchecked_mut(j + 2) = byte;
            *rgba.get_unchecked_mut(j + 3) = 255;
        }
    }

    rgba
}

fn sobel(a: f32, b: f32, c: f32, d: f32, e: f32, f: f32, g: f32, h: f32) -> f32 {
    let x = -a + c - 2.0 * d + 2.0 * e - f + h;
    let y = -a - 2.0 * b - c + f + 2.0 * g + h;
    (x * x + y * y).sqrt()
}

#[wasm_bindgen]
pub fn detect_edges(energy: &EnergyMap) -> EnergyMap {
    if energy.len() == 0 {
        return EnergyMap::new(0, 0);
    }

    if energy.len() == 1 {
        return EnergyMap::new(1, 1);
    }

    if energy.width() == 1 || energy.height() == 1 {
        let len = std::cmp::max(energy.width(), energy.height());
        debug_assert!(len >= 2);

        let mut edges = vec![0.0; energy.height()];

        unsafe {
            // * * *
            // * a *
            // * b *
            *edges.get_unchecked_mut(0) = {
                let a = *energy.energy.get_unchecked(0);
                let b = *energy.energy.get_unchecked(1);
                sobel(a, a, a, a, a, b, b, b)
            };

            // * b *
            // * a *
            // * * *
            *edges.get_unchecked_mut(len - 1) = {
                let a = *energy.get_unchecked(0, len - 1);
                let b = *energy.get_unchecked(0, len - 2);
                sobel(b, b, b, a, a, a, a, a)
            };

            // * a *
            // * b *
            // * c *
            for y in 1..len - 1 {
                *edges.get_unchecked_mut(y) = {
                    let a = *energy.get_unchecked(0, y - 1);
                    let b = *energy.get_unchecked(0, y);
                    let c = *energy.get_unchecked(0, y + 1);
                    sobel(a, a, a, b, b, c, c, c)
                }
            }
        }
    }

    debug_assert!(energy.width >= 2 && energy.height() >= 2);

    let mut edges = EnergyMap::new(energy.width, energy.height);

    unsafe {
        for y in 0..energy.height() {
            let row = energy.get_row_unchecked(y);

            let prev_row = if y == 0 {
                row
            } else {
                energy.get_row_unchecked(y - 1)
            };

            let next_row = if y == energy.height() - 1 {
                row
            } else {
                energy.get_row_unchecked(y + 1)
            };

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

            for x in 1..energy.width() - 1 {
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

    edges
}
