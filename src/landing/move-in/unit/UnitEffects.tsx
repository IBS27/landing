import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { DoubleSide } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";

/** Contact shading makes fixtures read as volumes; keep resources local to this Canvas. */
export function UnitEffects() {
  const { gl, scene, camera, invalidate } = useThree();
  const pipeline = useRef<{
    composer: EffectComposer;
    ao: SSAOPass;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.renderTarget1.samples = composer.renderTarget2.samples = 4;
    const render = new RenderPass(scene, camera),
      ao = new SSAOPass(scene, camera, 1, 1, 16),
      output = new OutputPass();
    ao.normalMaterial.side = DoubleSide;
    ao.kernelRadius = 0.18;
    ao.minDistance = 0.0001;
    ao.maxDistance = 0.015;
    composer.addPass(render);
    composer.addPass(ao);
    composer.addPass(output);
    pipeline.current = { composer, ao, width: 0, height: 0 };
    invalidate();
    return () => {
      pipeline.current = null;
      ao.dispose();
      ao.ssaoMaterial.dispose();
      ao.noiseTexture.dispose();
      render.dispose();
      output.dispose();
      composer.dispose();
    };
  }, [gl, scene, camera, invalidate]);
  useFrame(({ size }, delta) => {
    const p = pipeline.current;
    if (!p) return;
    // One output pixel per CSS pixel bounds AO cost on high-DPI/mobile screens.
    if (p.width !== size.width || p.height !== size.height) {
      p.width = size.width;
      p.height = size.height;
      p.composer.setSize(Math.max(1, size.width), Math.max(1, size.height));
    }
    p.ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
    p.ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(
      camera.projectionMatrixInverse,
    );
    p.composer.render(delta);
  }, 1);
  return null;
}
