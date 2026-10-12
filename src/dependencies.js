let parser;
let types;
let generator;
let traverse;

if (typeof window === "undefined") {
    parser = await import("@babel/parser");
    types = await import("@babel/types");
    generator = (await import("@babel/generator")).default;
    traverse = (await import("@babel/traverse")).default;
} else {
    parser = window.Babel.packages.parser;
    types = window.Babel.packages.types;
    generator = window.Babel.packages.generator.default;
    traverse = window.Babel.packages.traverse.default;
}

export { parser, types, generator, traverse };