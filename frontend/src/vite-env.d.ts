/// <reference types="vite/client" />

declare module "three/examples/jsm/postprocessing/UnrealBloomPass.js" {
  export class UnrealBloomPass {
    constructor(resolution?: unknown, strength?: number, radius?: number, threshold?: number);
    strength: number;
    radius: number;
    threshold: number;
  }
}
