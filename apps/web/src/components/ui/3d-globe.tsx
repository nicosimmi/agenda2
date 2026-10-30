import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { BackSide, AdditiveBlending, type Group } from "three";
import { cn } from "@/lib/utils";

export interface Globe3DConfig {
  textureUrl: string;
  bumpMapUrl?: string;
  atmosphereColor?: string;
  /** Vueltas lentas sobre sí mismo; 0 lo deja quieto. */
  autoRotateSpeed?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  /** Giro inicial en radianes. */
  initialRotation?: { x: number; y: number };
}

const RADIUS = 2;

function Earth({ config }: { config: Globe3DConfig }) {
  const group = useRef<Group>(null);
  const maps = useTexture(
    config.bumpMapUrl
      ? { map: config.textureUrl, bumpMap: config.bumpMapUrl }
      : { map: config.textureUrl },
  );

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.1 * (config.autoRotateSpeed ?? 0.3);
  });

  return (
    <group
      ref={group}
      rotation={[config.initialRotation?.x ?? 0, config.initialRotation?.y ?? 0, 0]}
    >
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <meshStandardMaterial {...maps} bumpScale={1} />
      </mesh>
      {/* Halo: una esfera algo mayor, vista por dentro y con mezcla aditiva. */}
      <mesh scale={1.12}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshBasicMaterial
          color={config.atmosphereColor ?? "#4da6ff"}
          side={BackSide}
          transparent
          opacity={0.18}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Globo terráqueo que gira solo y se puede arrastrar. three.js pesa: cárgalo con `lazy`. */
export function Globe3D({ config, className }: { config: Globe3DConfig; className?: string }) {
  return (
    <div className={cn("relative h-[500px] w-full", className)}>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 0, RADIUS * 3.5] }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Earth config={config} />
        <OrbitControls
          enableZoom={config.enableZoom ?? false}
          enablePan={config.enablePan ?? false}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}

export default Globe3D;
