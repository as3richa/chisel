extern crate wasm_bindgen;

use wasm_bindgen::prelude::*;

struct Map<T> {
    energy: Vec<T>,
    width: u32,
    height: u32,
}

impl<T: Default + Copy> Map<T> {
    fn new(width: u32, height: u32) -> Self {
        let len = (width as usize) * (height as usize);
        Self {
            energy: vec![T::default(); len],
            width,
            height,
        }
    }

    fn from_vec(energy: Vec<T>, width: u32, height: u32) -> Self {
        debug_assert!(energy.len() == (width as usize) * (height as usize));
        Self {
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

    fn map<U: Default + Copy, F: Fn(T) -> U>(&self, f: F) -> Map<U> {
        Map::from_vec(
            self.energy.iter().map(|x| f(*x)).collect(),
            self.width,
            self.height,
        )
    }

    unsafe fn get_row_unchecked(&self, y: usize) -> &[T] {
        let w = self.width();
        self.energy.get_unchecked(w * y..w * (y + 1))
    }

    unsafe fn get_unchecked(&self, x: usize, y: usize) -> &T {
        let i = self.width() * y + x;
        self.energy.get_unchecked(i)
    }

    unsafe fn get_unchecked_mut(&mut self, x: usize, y: usize) -> &mut T {
        let i = self.width() * y + x;
        self.energy.get_unchecked_mut(i)
    }
}

#[wasm_bindgen]
pub struct EnergyMap(Map<u8>);

#[wasm_bindgen]
pub fn rgba_to_energy(rgba: Vec<u8>, width: u32, height: u32) -> EnergyMap {
    let size = (width as usize) * (height as usize);
    assert!(rgba.len() == 4 * size);

    let mut energy = vec![0u8; size];

    for (i, e) in energy.iter_mut().enumerate() {
        let (r, g, b) = unsafe {
            let j = 4 * i;
            (
                *rgba.get_unchecked(j),
                *rgba.get_unchecked(j + 1),
                *rgba.get_unchecked(j + 2),
            )
        };
        let fp_value = 0.3 * (r as f32) + 0.59 * (g as f32) + 0.11 * (b as f32);
        *e = f32::min(fp_value.round(), 255.0) as u8;
    }

    EnergyMap(Map::from_vec(energy, width, height))
}

#[wasm_bindgen]
pub fn energy_to_rgba(energy_map: &EnergyMap) -> Vec<u8> {
    let EnergyMap(energy) = energy_map;

    if energy.len() == 0 {
        return vec![];
    }

    let (min, max) = {
        let init = unsafe {
            let value = *energy.get_unchecked(0, 0);
            (value, value)
        };

        energy.energy.iter().fold(init, {
            |(min, max), &value| (std::cmp::min(min, value), std::cmp::max(max, value))
        })
    };

    let range = if max == min { 1 } else { max - min };

    let mut rgba = vec![0u8; 4 * energy.len()];

    for (i, &e) in energy.energy.iter().enumerate() {
        let j = 4 * i;

        let unit_energy = ((e - min) as f32) / (range as f32);
        let byte = (255.0 * unit_energy).round() as u8;

        unsafe {
            *rgba.get_unchecked_mut(j) = byte;
            *rgba.get_unchecked_mut(j + 1) = byte;
            *rgba.get_unchecked_mut(j + 2) = byte;
            *rgba.get_unchecked_mut(j + 3) = 255;
        }
    }

    rgba
}

fn sobel_f32(a: f32, b: f32, c: f32, d: f32, e: f32, f: f32, g: f32, h: f32) -> f32 {
    let x = -a + c - 2.0 * d + 2.0 * e - f + h;
    let y = -a - 2.0 * b - c + f + 2.0 * g + h;
    (x * x + y * y).sqrt()
}

fn sobel_u8(a: u8, b: u8, c: u8, d: u8, e: u8, f: u8, g: u8, h: u8) -> f32 {
    sobel_f32(
        a as f32, b as f32, c as f32, d as f32, e as f32, f as f32, g as f32, h as f32,
    )
}

#[wasm_bindgen]
pub fn detect_edges(energy_map: &EnergyMap) -> EnergyMap {
    let EnergyMap(energy) = energy_map;

    if energy.len() == 0 {
        return EnergyMap(Map::new(0, 0));
    }

    if energy.len() == 1 {
        return EnergyMap(Map::new(1, 1));
    }

    let edges_f32 = if energy.width() == 1 || energy.height() == 1 {
        detect_edges_1xn(energy)
    } else {
        detect_edges_2x2(energy)
    };

    let (min, max) = edges_f32
        .energy
        .iter()
        .fold((f32::INFINITY, -f32::INFINITY), |(min, max), &value| {
            (f32::min(min, value), f32::max(max, value))
        });

    let range = if max - min <= 1e-4 { 1.0 } else { max - min };

    let f = { |x| f32::min(255.0 * ((x - min) as f32) / (range as f32), 255.0) as u8 };

    EnergyMap(edges_f32.map(f))
}

fn detect_edges_1xn(energy: &Map<u8>) -> Map<f32> {
    debug_assert!((energy.width() == 1) ^ (energy.height() == 1));

    let len = std::cmp::max(energy.width(), energy.height());
    debug_assert!(len >= 2);

    let mut edges_f32 = Map::new(energy.width, energy.height);
    let vec = &mut edges_f32.energy;

    unsafe {
        // * * *
        // * a *
        // * b *
        *vec.get_unchecked_mut(0) = {
            let a = *energy.energy.get_unchecked(0);
            let b = *energy.energy.get_unchecked(1);
            sobel_u8(a, a, a, a, a, b, b, b)
        };

        // * b *
        // * a *
        // * * *
        *vec.get_unchecked_mut(len - 1) = {
            let a = *energy.get_unchecked(0, len - 1);
            let b = *energy.get_unchecked(0, len - 2);
            sobel_u8(b, b, b, a, a, a, a, a)
        };

        // * a *
        // * b *
        // * c *
        for y in 1..len - 1 {
            *vec.get_unchecked_mut(y) = {
                let a = *energy.get_unchecked(0, y - 1);
                let b = *energy.get_unchecked(0, y);
                let c = *energy.get_unchecked(0, y + 1);
                sobel_u8(a, a, a, b, b, c, c, c)
            }
        }
    }

    edges_f32
}

fn detect_edges_2x2(energy: &Map<u8>) -> Map<f32> {
    debug_assert!(energy.width >= 2 && energy.height() >= 2);

    let mut edges = Map::new(energy.width, energy.height);

    for y in 0..energy.height() {
        unsafe {
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

            *edges.get_unchecked_mut(0, y) = sobel_u8(
                *prev_row.get_unchecked(0),
                *prev_row.get_unchecked(0),
                *prev_row.get_unchecked(1),
                *row.get_unchecked(0),
                *row.get_unchecked(1),
                *next_row.get_unchecked(0),
                *next_row.get_unchecked(0),
                *next_row.get_unchecked(1),
            );

            *edges.get_unchecked_mut(energy.width() - 1, y) = sobel_u8(
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
                *edges.get_unchecked_mut(x, y) = sobel_u8(
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
