type RustLibrary = typeof import("./rs/pkg");

export type Request =
    { op: "intens", data: ArrayBuffer, width: number, height: number } |
    { op: "edges", intens: Intensity}


export class Intensity {
    intens: RsIntensity;
    width: number;
    height: number;

    constructor(library: RustLibrary, img: ImageData) {
        const unclamped = new Uint8Array(img.data.buffer);
        this.intens = new library.Intensity(unclamped, img.width, img.height);
        this.width = img.width;
        this.height = img.height;
    }

    toImageData(): ImageData {
        const buffer = this.intens.toRgba();
        const clamped = new Uint8ClampedArray(buffer);
        return new ImageData(clamped, this.width, this.height);
    }
}

export class Edges {
    edges: RsEdges;
    width: number;
    height: number;

    constructor(intens: Intensity) {
        this.edges = intens.intens.detectEdges();
        this.width = intens.width;
        this.height = intens.height;
    }

    toImageData(): ImageData {
        const clamped = new Uint8ClampedArray(this.edges.toRgba().buffer);
        return new ImageData(clamped, this.width, this.height);
    }
}

const ctx: Worker = self as any;