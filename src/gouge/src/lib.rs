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

fn convolve_1x3<T: Into<i16> + Copy>(img: &Image<T>, x: i16, y: i16, z: i16) -> Image<i16> {
    let conv_data = unsafe {
        build_vec_in_place::<i16, _>(img.size(), |ptr| {
            if img.height == 0 {
                return;
            }

            if img.height == 1 {
                let w = z + y + x;
                for (i, &a) in img.data.iter().enumerate() {
                    ptr.add(i).write(w * a.into())
                }
                return;
            }

            for i in 0..img.width() {
                let a = (*img.data.get_unchecked(i)).into();
                let b = (*img.data.get_unchecked(i + img.width())).into();
                ptr.add(i).write((z + y) * a + x * b);
            }

            for i in img.width()..img.size() - img.width() {
                let a = (*img.data.get_unchecked(i - img.width())).into();
                let b = (*img.data.get_unchecked(i)).into();
                let c = (*img.data.get_unchecked(i + img.width())).into();
                ptr.add(i).write(z * a + y * b + x * c);
            }

            for i in img.size() - img.width()..img.size() {
                let a = (*img.data.get_unchecked(i - img.width())).into();
                let b = (*img.data.get_unchecked(i)).into();
                ptr.add(i).write(z * a + (y + x) * b);
            }
        })
    };

    Image {
        data: conv_data,
        width: img.width,
        height: img.height,
    }
}

fn convolve_3x1<T: Into<i16> + Copy>(img: &Image<T>, x: i16, y: i16, z: i16) -> Image<i16> {
    let conv_data = unsafe {
        build_vec_in_place::<i16, _>(img.size(), |data_ptr| {
            if img.width == 0 {
                return;
            }

            if img.width == 1 {
                let w = z + y + x;
                for (i, &a) in img.data.iter().enumerate() {
                    data_ptr.add(i).write(w * a.into())
                }
                return;
            }

            for i in 0..img.height() {
                let offset = img.width() * i;
                let img_row = img.data.get_unchecked(offset..offset + img.width());
                let ptr_row = data_ptr.add(offset);

                let mut a = (*img_row.get_unchecked(0)).into();
                let mut b = a;
                let mut c = (*img_row.get_unchecked(1)).into();

                ptr_row.write(z * a + y * b + x * c);

                for j in 1..img.width() - 1 {
                    a = b;
                    b = c;
                    c = (*img_row.get_unchecked(j + 1)).into();
                    ptr_row.add(j).write(z * a + y * b + x * c);
                }

                ptr_row.add(img.width() - 1).write(z * a + y * b + x * c);
            }
        })
    };

    Image {
        data: conv_data,
        width: img.width,
        height: img.height,
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
        let grad_x = convolve_1x3(&convolve_3x1(img, 1, 0, -1), 1, 2, 1);
        let mut grad_y = convolve_3x1(&convolve_1x3(img, 1, 2, 1), 1, 0, -1);

        for (i, gy) in grad_y.data.iter_mut().enumerate() {
            let gx = unsafe { *grad_x.data.get_unchecked(i) };

            let fp_value = ((gx as f32) * (gx as f32) + (*gy as f32) * (*gy as f32)).sqrt();
            *gy = fp_value.round() as i16;
        }

        EdgeImage(Image {
            data: grad_y.data,
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
