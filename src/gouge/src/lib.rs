extern crate wasm_bindgen;
extern crate web_sys;

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
}

#[wasm_bindgen]
pub struct EnergyMap(Map<f32>);

#[wasm_bindgen]
pub fn rgba_to_energy(rgba: Vec<u8>, width: u32, height: u32) -> EnergyMap {
    let size = (width as usize) * (height as usize);
    assert!(rgba.len() == 4 * size);

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

    EnergyMap(Map::from_vec(energy, width, height))
}

#[wasm_bindgen]
pub fn energy_to_rgba(energy_map: &EnergyMap) -> Vec<u8> {
    let EnergyMap(energy) = energy_map;

    if energy.len() == 0 {
        return vec![];
    }

    let (min, max) = energy
        .energy
        .iter()
        .fold((f32::INFINITY, -f32::INFINITY), |(min, max), &value| {
            (f32::min(min, value), f32::max(max, value))
        });

    let range = if max - min <= 1e-4 { 1.0 } else { max - min };

    let mut rgba = vec![0u8; 4 * energy.len()];

    for (i, &e) in energy.energy.iter().enumerate() {
        let byte = (255.0 * f32::min((e - min) / range, 1.0)).round() as u8;
        let j = 4 * i;
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

#[wasm_bindgen]
pub fn detect_edges(energy_map: &EnergyMap) -> EnergyMap {
    let EnergyMap(energy) = energy_map;

    if energy.len() == 0 {
        return EnergyMap(Map::new(0, 0));
    }

    if energy.len() == 1 {
        return EnergyMap(Map::new(1, 1));
    }

    if energy.width() == 1 || energy.height() == 1 {
        return EnergyMap(detect_edges_1xn(energy));
    }

    EnergyMap(detect_edges_2x2(energy))
}

fn detect_edges_1xn(energy: &Map<f32>) -> Map<f32> {
    debug_assert!((energy.width() == 1) ^ (energy.height() == 1));

    let len = std::cmp::max(energy.width(), energy.height());
    debug_assert!(len >= 2);

    let mut edges = Map::new(energy.width, energy.height);

    macro_rules! edges_at {
        ($i: expr) => {
            edges.energy.get_unchecked_mut($i)
        };
    }

    macro_rules! energy_at {
        ($i: expr) => {
            *energy.energy.get_unchecked($i);
        };
    }

    unsafe {
        // * * *
        // * a *
        // * b *
        *edges_at!(0) = {
            let a = energy_at!(0);
            let b = energy_at!(0);
            sobel_f32(a, a, a, a, a, b, b, b)
        };

        // * b *
        // * a *
        // * * *
        *edges_at!(len - 1) = {
            let a = energy_at!(len - 1);
            let b = energy_at!(len - 2);
            sobel_f32(b, b, b, a, a, a, a, a)
        };

        // * a *
        // * b *
        // * c *
        for y in 1..len - 1 {
            *edges_at!(y) = {
                let a = energy_at!(y - 1);
                let b = energy_at!(y);
                let c = energy_at!(y + 1);
                sobel_f32(a, a, a, b, b, c, c, c)
            }
        }
    }

    edges
}

fn detect_edges_2x2(energy: &Map<f32>) -> Map<f32> {
    debug_assert!(energy.width >= 2 && energy.height() >= 2);

    let mut edges = Map::new(energy.width, energy.height);

    macro_rules! edges_at {
        ($x: expr, $y: expr) => {
            edges.energy.get_unchecked_mut($y * energy.width() + $x)
        };
    }

    macro_rules! energy_at {
        ($x: expr, $y: expr) => {
            *energy.energy.get_unchecked($y * energy.width() + $x)
        };
    }

    macro_rules! sobel {
        ($x1: expr, $x2: expr, $x3: expr, $y1: expr, $y2: expr, $y3: expr) => {
            sobel_f32(
                energy_at!($x1, $y1),
                energy_at!($x2, $y1),
                energy_at!($x3, $y1),
                energy_at!($x1, $y2),
                energy_at!($x3, $y2),
                energy_at!($x1, $y3),
                energy_at!($x2, $y3),
                energy_at!($x3, $y3),
            )
        };
    }

    unsafe {
        let right = energy.width() - 1;
        let bottom = energy.height() - 1;

        *edges_at!(0, 0) = sobel!(0, 0, 1, 0, 0, 1);

        for x in 1..right {
            *edges_at!(x, 0) = sobel!(x - 1, x, x + 1, 0, 0, 1);
        }

        *edges_at!(right, 0) = sobel!(right - 1, right, right, 0, 0, 1);

        for y in 1..bottom {
            *edges_at!(0, y) = sobel!(0, 0, 1, y - 1, y, y + 1);

            let mut a = energy_at!(0, y - 1);
            let mut b = energy_at!(1, y - 1);
            let mut c = energy_at!(2, y - 1);
            let mut d = energy_at!(0, y);
            let mut k = energy_at!(1, y);
            let mut e = energy_at!(2, y);
            let mut f = energy_at!(0, y + 1);
            let mut g = energy_at!(1, y + 1);
            let mut h = energy_at!(2, y + 1);
                        

            for x in 1..energy.width() - 1 {
                *edges_at!(x, y) = sobel_f32(a, b, c, d, e, f, g, h);
                a = b;
                b = c;
                c = energy_at!(x )
            }

            *edges_at!(right, y) = sobel!(right - 1, right, right, y - 1, y, y + 1);
        }

        *edges_at!(0, bottom) = sobel!(0, 0, 1, bottom - 1, bottom, bottom);

        for x in 1..right {
            *edges_at!(x, bottom) = sobel!(x - 1, x, x + 1, bottom - 1, bottom, bottom);
        }

        *edges_at!(right, bottom) = sobel!(right - 1, right, right, bottom - 1, bottom, bottom);
    };

    edges
}
