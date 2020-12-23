extern crate wasm_bindgen;
extern crate web_sys;

use wasm_bindgen::prelude::*;

unsafe fn build_vec_in_place<X: Sized, F: Fn(*mut X)>(len: usize, f: F) -> Vec<X> {
    let mut vec: Vec<X> = Vec::with_capacity(len);
    f(vec.as_mut_ptr());
    vec.set_len(len);
    vec
}

struct Image<T> {
    data: Vec<T>,
    width: u32,
    height: u32,
}

impl<T> Image<T> {
    fn size(&self) -> usize {
        self.data.len()
    }

    fn width(&self) -> usize {
        self.width as usize
    }

    fn height(&self) -> usize {
        self.height as usize
    }
}

fn intens_from_rgba(rgba_data: &[u8], width: u32, height: u32) -> Image<u8> {
    let size = (width as usize) * (height as usize);
    assert!(rgba_data.len() == 4 * size);

    let intens_data = unsafe {
        build_vec_in_place::<u8, _>(size, |ptr| {
            for i in 0..size {
                let j = 4 * i;
                let r = *rgba_data.get_unchecked(j);
                let g = *rgba_data.get_unchecked(j + 1);
                let b = *rgba_data.get_unchecked(j + 2);
                let fp_intens = 0.3 * (r as f32) + 0.59 * (g as f32) + 0.11 * (b as f32);
                ptr.add(i).write(fp_intens.round() as u8);
            }
        })
    };

    Image {
        data: intens_data,
        width: width,
        height: height,
    }
}

#[wasm_bindgen]
pub struct IntensityImage(Image<u8>);

#[wasm_bindgen]
impl IntensityImage {
    pub fn new(img_data: web_sys::ImageData) -> IntensityImage {
        IntensityImage(intens_from_rgba(
            &*img_data.data(),
            img_data.width(),
            img_data.height(),
        ))
    }

    pub fn detect_edges(&self) -> EdgeImage {
        let IntensityImage(img) = self;

        if img.size() == 0 {
            return EdgeImage(Image {
                data: vec![],
                width: img.width,
                height: img.height,
            });
        }

        let sobel = unsafe {
            build_vec_in_place::<i16, _>(img.size(), |ptr| {
                let mut convolved_row = vec![(0, 0); img.width() + 2];

                let convolve_row_v =
                    |convolved_row: &mut Vec<(i16, i16)>, prev: usize, curr: usize, next: usize| {
                        let prev_off = img.width() * prev;
                        let curr_off = img.width() * curr;
                        let next_off = img.width() * next;

                        for x in 0..img.width() {
                            *convolved_row.get_unchecked_mut(x + 1) = {
                                let a = *img.data.get_unchecked(prev_off + x);
                                let b = *img.data.get_unchecked(curr_off + x);
                                let c = *img.data.get_unchecked(next_off + x);
                                (
                                    -(a as i16) + (c as i16),
                                    (a as i16) + 2 * (b as i16) + (c as i16),
                                )
                            };
                        }

                        *convolved_row.get_unchecked_mut(0) = *convolved_row.get_unchecked(1);
                        *convolved_row.get_unchecked_mut(img.width() + 1) =
                            *convolved_row.get_unchecked(img.width());
                    };

                for y in 0..img.height() {
                    let prev = if y == 0 { 0 } else { y - 1 };
                    let next = if y == img.height() - 1 { y } else { y + 1 };
                    convolve_row_v(&mut convolved_row, prev, y, next);

                    let mut a = *convolved_row.get_unchecked(0);
                    let mut b = *convolved_row.get_unchecked(1);

                    for (x, &c) in convolved_row.get_unchecked(2..).iter().enumerate() {
                        let gx = a.0 + 2 * b.0 + c.0;
                        let gy = -a.1 + c.1;

                        let fp_value =
                            ((gx as f32) * (gx as f32) + (gy as f32) * (gy as f32)).sqrt();
                        ptr.add(img.width() * y + x).write(fp_value.round() as i16);

                        a = b;
                        b = c;
                    }
                }
            })
        };

        EdgeImage(Image {
            data: sobel,
            width: img.width,
            height: img.height,
        })
    }
}

#[wasm_bindgen]
pub struct EdgeImage(Image<i16>);

#[wasm_bindgen]
impl EdgeImage {
    pub fn to_rgba(&self) -> Vec<u8> {
        let EdgeImage(img) = self;

        let (min, max) = img
            .data
            .iter()
            .fold((f32::INFINITY, -f32::INFINITY), |(min, max), &value| {
                (f32::min(min, value as f32), f32::max(max, value as f32))
            });

        let range = if max - min < 1e-4 { 1.0 } else { max - min };

        let data = unsafe {
            build_vec_in_place::<u8, _>(4 * img.size(), |ptr| {
                for (i, &value) in img.data.iter().enumerate() {
                    let scaled = 255.0 * f32::min(((value as f32) - min) / range, 1.0);
                    let byte = scaled.round() as u8;

                    let j = 4 * i;
                    ptr.add(j).write(byte);
                    ptr.add(j + 1).write(byte);
                    ptr.add(j + 2).write(byte);
                    ptr.add(j + 3).write(255);
                }
            })
        };

        data
    }
}
