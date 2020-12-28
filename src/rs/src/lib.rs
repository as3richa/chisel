extern crate wasm_bindgen;

mod bindings;

unsafe fn build_vec_in_place<X: Sized, F: Fn(*mut X)>(len: usize, f: F) -> Vec<X> {
    let mut vec: Vec<X> = Vec::with_capacity(len);
    f(vec.as_mut_ptr());
    vec.set_len(len);
    vec
}

fn vec_to_grayscale_rgba<T, F: Fn(&T) -> u8>(vec: &Vec<T>, f: F) -> Vec<u8> {
    unsafe {
        build_vec_in_place::<u8, _>(4 * vec.len(), |ptr| {
            for (i, value) in vec.iter().enumerate() {
                let byte = f(value);
                let j = 4 * i;
                ptr.add(j).write(byte);
                ptr.add(j + 1).write(byte);
                ptr.add(j + 2).write(byte);
                ptr.add(j + 3).write(255);
            }
        })
    }
}

fn sobel(a: i16, b: i16, c: i16, d: i16, e: i16, f: i16, g: i16, h: i16) -> i16 {
    let v_x = (-a + c - 2 * d + 2 * e - h + f) as f32;
    let v_y = (a + 2 * b + c - f - 2 * g - h) as f32;
    (v_x * v_x + v_y * v_y).sqrt().round() as i16
}

fn compute_intens(rgba_data: &[u8], width: usize, height: usize) -> Vec<u8> {
    debug_assert!(rgba_data.len() == 4 * width * height);

    unsafe {
        build_vec_in_place::<u8, _>(width * height, |ptr| {
            for i in 0..width * height {
                let j = 4 * i;
                let r = *rgba_data.get_unchecked(j);
                let g = *rgba_data.get_unchecked(j + 1);
                let b = *rgba_data.get_unchecked(j + 2);
                let fp_intens = 0.3 * (r as f32) + 0.59 * (g as f32) + 0.11 * (b as f32);
                ptr.add(i).write(fp_intens.round() as u8);
            }
        })
    }
}

fn detect_edges(intens: &[u8], width: usize, height: usize) -> Vec<i16> {
    debug_assert!(intens.len() == width * height);

    unsafe {
        build_vec_in_place::<i16, _>(intens.len(), |ptr| {
            if intens.len() == 0 {
                return;
            }

            if width == 1 && height == 1 {
                ptr.write(0);
                return;
            }

            debug_assert!(height >= 2);

            if width == 1 {
                let mut a = *intens.get_unchecked(0) as i16;
                let mut b = a;
                let mut c = *intens.get_unchecked(1) as i16;

                ptr.write(sobel(a, a, a, b, b, c, c, c));

                for y in 1..height - 1 {
                    a = b;
                    b = c;
                    c = *intens.get_unchecked(y + 1) as i16;
                    ptr.add(y).write(sobel(a, a, a, b, b, c, c, c))
                }

                a = b;
                b = c;
                ptr.add(height - 1).write(sobel(a, a, a, b, b, c, c, c));

                return;
            }

            debug_assert!(width >= 2);

            for y in 0..height {
                let curr_off = width * y;

                let prev_off = if y == 0 { curr_off } else { curr_off - width };

                let next_off = if y == height - 1 {
                    curr_off
                } else {
                    curr_off + width
                };

                let curr = |x: usize| *intens.get_unchecked(curr_off + x) as i16;
                let prev = |x: usize| *intens.get_unchecked(prev_off + x) as i16;
                let next = |x: usize| *intens.get_unchecked(next_off + x) as i16;

                let write = |x: usize, value: i16| ptr.add(curr_off + x).write(value);

                write(
                    0,
                    sobel(
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

                for x in 1..width - 1 {
                    write(
                        x,
                        sobel(
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
                    width - 1,
                    sobel(
                        prev(width - 2),
                        prev(width - 1),
                        prev(width - 1),
                        curr(width - 2),
                        curr(width - 1),
                        next(width - 2),
                        next(width - 1),
                        next(width - 1),
                    ),
                );
            }
        })
    }
}

struct CarvingContext {
    rgba: Vec<u8>,
    intens: Vec<u8>,
    edges: Vec<i16>,
    width: u32,
    height: u32,
}

impl CarvingContext {
    fn new(rgba: Vec<u8>, width: u32, height: u32) -> CarvingContext {
        assert!(rgba.len() == 4 * (width as usize) * (height as usize));

        let intens = compute_intens(&rgba, width as usize, height as usize);
        let edges = detect_edges(&intens, width as usize, height as usize);

        CarvingContext {
            rgba,
            intens,
            edges,
            width,
            height,
        }
    }

    fn carve(&self, width: u32, height: u32) -> Vec<u8> {
        self.rgba.clone()
    }
}
