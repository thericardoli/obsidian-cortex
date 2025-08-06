declare module '*.wasm' {
  const data: ArrayBuffer | Uint8Array;
  export default data;
}

declare module '*.data' {
  const data: ArrayBuffer | Uint8Array;
  export default data;
}
