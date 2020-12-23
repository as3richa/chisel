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
        fn f(a: i16, b: i16, c: i16, d: i16, e: i16, f: i16, g: i16, h: i16) -> i16 {
            let v_x = (-a + c - 2 * d + 2 * e - h + f) as f32;
            let v_y = (a + 2 * b + c - f - 2 * g - h) as f32;
            (v_x * v_x + v_y * v_y).sqrt().round() as i16
        }

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
                for y in 0..img.height() {
                    let curr_off = img.width() * y;

                    let prev_off = if y == 0 {
                        curr_off
                    } else {
                        curr_off - img.width()
                    };

                    let next_off = if y == img.height() - 1 {
                        curr_off
                    } else {
                        curr_off + img.width()
                    };

                    let curr = |x: usize| *img.data.get_unchecked(curr_off + x) as i16;
                    let prev = |x: usize| *img.data.get_unchecked(prev_off + x) as i16;
                    let next = |x: usize| *img.data.get_unchecked(next_off + x) as i16;

                    let write = |x: usize, value: i16| ptr.add(curr_off + x).write(value);

                    write(
                        0,
                        f(
                            prev(0),
                            prev(0),
                            prev(1),
                            curr(0),
                            curr(1),
                            next(0),
                            next(0),
                            next(1),
                        ),
                    );

                    for x in 1..img.width() - 1 {
                        write(
                            x,
                            f(
                                prev(x - 1),
                                prev(x),
                                prev(x + 1),
                                curr(x - 1),
                                curr(x + 1),
                                next(x - 1),
                                next(x),
                                next(x + 1),
                            ),
                        );
                    }

                    write(
                        img.width() - 1,
                        f(
                            prev(img.width() - 2),
                            prev(img.width() - 1),
                            prev(img.width() - 1),
                            curr(img.width() - 2),
                            curr(img.width() - 1),
                            next(img.width() - 2),
                            next(img.width() - 1),
                            next(img.width() - 1),
                        ),
                    );
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

        let data = unsafe {
            build_vec_in_place::<u8, _>(4 * img.size(), |ptr| {
                for (i, &value) in img.data.iter().enumerate() {
                    let byte = std::cmp::min(value, 255) as u8;
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
