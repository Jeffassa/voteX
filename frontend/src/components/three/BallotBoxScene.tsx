/**
 * Scène 3D de la page d'accueil : une urne transparente dans laquelle des
 * bulletins tombent un à un. L'image dit ce que fait le site, sans slogan.
 *
 * Contraintes tenues, sur une plateforme de vote :
 * - chargée à la demande (import `lazy`), avec des imports nommés pour que le
 *   bundler n'embarque que les modules de Three.js réellement utilisés ;
 * - décorative : `aria-hidden`, aucune zone cliquable, la page vit sans elle ;
 * - silencieuse sans WebGL : rien n'est rendu plutôt qu'une page cassée ;
 * - économe : l'animation s'arrête hors écran ou onglet masqué, et se fige sur
 *   une image fixe si l'utilisateur a demandé moins de mouvement ;
 * - sans attente visible : la page affiche d'abord une image fixe de cette
 *   même scène (hero-urne-*.webp), puis la 3D prend le relais quand elle est
 *   prête (`onReady`). Pour que le passage ne se voie pas, la première image
 *   rendue est toujours la même : tirages pseudo-aléatoires à graine fixe,
 *   urne posée dans sa position de repos, horloge partant de POSTER_TIME.
 *   Les shaders sont compilés sans bloquer la page (compileAsync).
 */

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { prefersReducedMotion } from "@/lib/motion";

const NAVY = "#0a2540";
const ORANGE = "#ff7a00";
const BALLOT_COUNT = 5;
const CYCLE = 5.2; // secondes entre deux passages d'un même bulletin
// Instant de l'animation figé dans l'image fixe (src/assets/hero-urne-*.webp).
// L'image est la première image rendue (`onReady`) dans un cadre de 460 × 460,
// densité 2 : changer cet instant, la caméra ou la scène impose de la refaire.
export const POSTER_TIME = 1.6;

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : même scène à chaque chargement. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orientation de repos de l'urne à l'instant t (sans parallaxe du pointeur). */
function restRotation(t: number) {
  return -0.35 + Math.sin(t * 0.25) * 0.05;
}

/** Bulletin : papier blanc, bandeau orange, cases à cocher dont une marquée. */
function ballotTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 340;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = ORANGE;
  g.fillRect(0, 0, c.width, 34);
  g.fillStyle = "#e4e4e7";
  for (let i = 0; i < 4; i++) {
    const y = 78 + i * 62;
    g.strokeStyle = "#a1a1aa";
    g.lineWidth = 4;
    g.strokeRect(28, y, 34, 34);
    g.fillRect(80, y + 8, 130 - (i % 2) * 30, 8);
    g.fillRect(80, y + 22, 90, 6);
  }
  // Une seule case cochée : le choix, anonyme.
  g.strokeStyle = NAVY;
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(34, 78 + 62 + 17);
  g.lineTo(44, 78 + 62 + 27);
  g.lineTo(60, 78 + 62 + 6);
  g.stroke();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Ombre douce posée au sol, sans le coût des shadow maps. */
function shadowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(10,37,64,0.35)");
  grad.addColorStop(1, "rgba(10,37,64,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export default function BallotBoxScene({
  className,
  onReady,
}: {
  className?: string;
  /** Appelé juste après la première image rendue. */
  onReady?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return;
    }
    const reduced = prefersReducedMotion();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;

    const camera = new PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(3.7, 3.0, 6.5);
    camera.lookAt(0, 0.35, 0);

    scene.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    scene.add(key);

    const rig = new Group();
    scene.add(rig);

    // Urne : parois de verre, couvercle marine percé d'une fente.
    const W = 2.4, H = 1.9, D = 1.7;
    const glass = new Mesh(
      new RoundedBoxGeometry(W, H, D, 4, 0.12),
      new MeshPhysicalMaterial({
        color: new Color("#f4f8ff"),
        roughness: 0.04,
        metalness: 0,
        transmission: 1,
        thickness: 0.2,
        ior: 1.4,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.55,
        envMapIntensity: 1.4,
        depthWrite: false,
      })
    );
    glass.position.y = H / 2;
    rig.add(glass);

    // Arêtes discrètes : sans elles, le verre clair se perd dans le fond blanc.
    const edges = new LineSegments(
      new EdgesGeometry(new BoxGeometry(W - 0.02, H - 0.02, D - 0.02)),
      new LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.28 })
    );
    edges.position.y = H / 2;
    rig.add(edges);

    const lid = new Mesh(
      new RoundedBoxGeometry(W + 0.12, 0.16, D + 0.12, 3, 0.05),
      new MeshStandardMaterial({ color: NAVY, roughness: 0.45, metalness: 0.15 })
    );
    lid.position.y = H + 0.06;
    rig.add(lid);

    const slot = new Mesh(
      new RoundedBoxGeometry(1.1, 0.05, 0.12, 2, 0.02),
      new MeshBasicMaterial({ color: "#020617" })
    );
    slot.position.y = H + 0.15;
    rig.add(slot);

    // Plaque frontale orange.
    const plate = new Mesh(
      new RoundedBoxGeometry(0.9, 0.34, 0.03, 2, 0.04),
      new MeshStandardMaterial({ color: ORANGE, roughness: 0.5 })
    );
    plate.position.set(0, H * 0.62, D / 2 + 0.02);
    rig.add(plate);

    const floorShadow = new Mesh(
      new PlaneGeometry(5, 5),
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
    );
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = 0.001;
    rig.add(floorShadow);

    // Bulletins déjà déposés, visibles à travers le verre.
    const rand = seeded(2026);
    const spread = (range: number) => (rand() - 0.5) * range;
    const paperTex = ballotTexture();
    const paperMat = new MeshStandardMaterial({ map: paperTex, roughness: 0.85, side: DoubleSide });
    const paperGeo = new PlaneGeometry(0.62, 0.82);
    for (let i = 0; i < 7; i++) {
      const b = new Mesh(paperGeo, paperMat);
      b.rotation.set(-Math.PI / 2 + spread(0.3), 0, spread(Math.PI));
      b.position.set(spread(1.5), 0.06 + i * 0.012, spread(0.9));
      rig.add(b);
    }

    // Bulletins en chute, décalés dans le temps.
    const falling = Array.from({ length: BALLOT_COUNT }, (_, i) => {
      const m = new Mesh(paperGeo, paperMat.clone());
      (m.material as MeshStandardMaterial).transparent = true;
      rig.add(m);
      return { mesh: m, offset: (i / BALLOT_COUNT) * CYCLE, spin: spread(1.2), x: spread(0.5) };
    });

    function placeBallots(t: number) {
      for (const b of falling) {
        const p = ((t + b.offset) % CYCLE) / CYCLE; // 0 → 1
        const m = b.mesh;
        const mat = m.material as MeshStandardMaterial;
        // Descente : de haut en travers, puis alignement sur la fente.
        const y = MathUtils.lerp(H + 2.6, H + 0.1, MathUtils.smootherstep(p, 0, 0.78));
        const align = MathUtils.smoothstep(p, 0.45, 0.8);
        m.position.set(MathUtils.lerp(b.x, 0, align), y - Math.max(0, p - 0.78) * 4.2, 0);
        m.rotation.set(0, MathUtils.lerp(b.spin + t * 0.4, 0, align), MathUtils.lerp(0.35 * Math.sin(t + b.offset), 0, align));
        mat.opacity = p < 0.06 ? p / 0.06 : p > 0.86 ? Math.max(0, 1 - (p - 0.86) / 0.08) : 1;
        m.visible = mat.opacity > 0.01;
      }
    }

    let width = 0, height = 0;
    function resize() {
      const r = host!.getBoundingClientRect();
      width = Math.max(1, r.width);
      height = Math.max(1, r.height);
      renderer.setSize(width, height, false);
      // Champ vertical fixe : l'urne garde la même taille que sur l'image fixe,
      // qui s'affiche à la hauteur du cadre. Elle tient entière dès que le
      // cadre est au moins carré, ce qui est le cas à toutes les largeurs.
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Parallaxe douce au pointeur.
    let targetX = 0, targetY = 0;
    function onPointer(e: PointerEvent) {
      const r = host!.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width - 0.5) * 2;
      targetY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }
    window.addEventListener("pointermove", onPointer, { passive: true });

    // L'horloge reprend là où l'image fixe s'est arrêtée.
    const timer = new Timer();
    let clock = POSTER_TIME;
    let raf = 0;
    let visible = true;
    let ready = false;
    let disposed = false;
    function frame(ts?: number) {
      timer.update(ts);
      clock += timer.getDelta();
      const t = clock;
      rig.rotation.y = MathUtils.lerp(rig.rotation.y, restRotation(t) + targetX * 0.18, 0.05);
      rig.rotation.x = MathUtils.lerp(rig.rotation.x, targetY * 0.04, 0.05);
      placeBallots(t);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }

    // Première image : exactement celle de l'image fixe.
    rig.rotation.y = restRotation(POSTER_TIME);
    placeBallots(POSTER_TIME);

    function setRunning(on: boolean) {
      if (reduced || !ready) return;
      if (on && !raf) {
        timer.reset();
        raf = requestAnimationFrame(frame);
      } else if (!on && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    // Compilation des shaders sans bloquer le fil principal (extension
    // KHR_parallel_shader_compile quand le pilote l'offre) : la page reste
    // fluide pendant que l'image fixe tient la place.
    renderer
      .compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        renderer.render(scene, camera);
        ready = true;
        onReadyRef.current?.();
        setRunning(visible && !document.hidden);
      });
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      setRunning(visible && !document.hidden);
    });
    io.observe(host);
    const onVisibility = () => setRunning(visible && !document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const mesh = o as Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as MeshStandardMaterial | undefined;
        mat?.map?.dispose();
        mat?.dispose?.();
      });
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
