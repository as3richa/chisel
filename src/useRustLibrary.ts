import { useEffect, useState } from "react";
import type {Edges as RsEdges, Intensity as RsIntensity} from "./rs/pkg";

type RustLibrary = typeof import("./rs/pkg");

export function useRustLibrary(): RustLibrary | null {
    const [library, setLibrary] = useState<RustLibrary | null>(null);

    useEffect(() => {
        import("./rs/pkg").then(setLibrary);
    }, []);

    return library;
}

