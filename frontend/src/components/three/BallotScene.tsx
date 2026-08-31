/**
 * Fond animé de la page d'accueil — Three.js.
 *
 * Ce qu'il représente : un maillage de points reliés qui dérive lentement.
 * L'image est celle d'un registre distribué — des bulletins scellés, reliés
 * entre eux, que personne ne peut détacher. Elle sert le propos de la page,
 * elle ne l'illustre pas au hasard.
 *
 * Ce qui a guidé l'implémentation, sur une plateforme de vote :
 *
 * - **Chargé à la demande.** Ce composant est importé en `lazy` par la page
 *   d'accueil : ni la salle de vote, ni l'espace d'administration ne paient les
 *   ~150 kB de Three.js.
 * - **Purement décoratif.** `aria-hidden`, jamais de contenu, jamais de zone
 *   cliquable. Un lecteur d'écran ne le voit pas ; la page fonctionne sans lui.
 * - **Silencieux en cas d'échec.** Sans WebGL — machine ancienne, pilote
 *   bloqué, salle informatique verrouillée — on ne rend rien plutôt que de
 *   casser l'accueil.
 * - **Il s'arrête quand on ne le regarde pas.** L'animation est suspendue si
 *   l'onglet passe en arrière-plan ou si le canevas sort du champ de vision :
 *   inutile de chauffer la batterie d'un téléphone pour un décor invisible.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { prefersReducedMotion } from "@/lib/motion";

const NAVY = new THREE.Color("#1e4172");
const ORANGE = new THREE.Color("#ff7a00");

/** Assez pour évoquer un réseau, assez peu pour tenir sur un téléphone. */
const POINT_COUNT = 90;
const LINK_DISTANCE = 2.4;
const FIELD = 9;

export default function BallotScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return; // Pas de WebGL : la page se passe très bien de décor.
    }

    const reduced = prefersReducedMotion();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 12;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    // ── Les points : chacun un bulletin scellé ──────────────────────────────
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);
    for (let i = 0; i < POINT_COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * FIELD * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * FIELD;
      positions[i * 3 + 2] = (Math.random() - 0.5) * FIELD;
      velocities[i * 3] = (Math.random() - 0.5) * 0.006;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.006;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({ color: ORANGE, size: 0.13, transparent: true, opacity: 0.85 }),
    );
    scene.add(points);

    // ── Les liens : recalculés à chaque image, d'où le tampon pré-alloué ─────
    const maxLinks = POINT_COUNT * 6;
    const linkPositions = new Float32Array(maxLinks * 6);
    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute("position", new THREE.BufferAttribute(linkPositions, 3));
    const links = new THREE.LineSegments(
      linkGeometry,
      new THREE.LineBasicMaterial({ color: NAVY, transparent: true, opacity: 0.28 }),
    );
    scene.add(links);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const drawLinks = () => {
      let cursor = 0;
      for (let i = 0; i < POINT_COUNT; i += 1) {
        for (let j = i + 1; j < POINT_COUNT; j += 1) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          if (dx * dx + dy * dy + dz * dz > LINK_DISTANCE * LINK_DISTANCE) continue;
          if (cursor >= maxLinks * 6 - 6) break;
          linkPositions[cursor++] = positions[i * 3];
          linkPositions[cursor++] = positions[i * 3 + 1];
          linkPositions[cursor++] = positions[i * 3 + 2];
          linkPositions[cursor++] = positions[j * 3];
          linkPositions[cursor++] = positions[j * 3 + 1];
          linkPositions[cursor++] = positions[j * 3 + 2];
        }
      }
      linkGeometry.setDrawRange(0, cursor / 3);
      linkGeometry.attributes.position.needsUpdate = true;
    };

    drawLinks();
    renderer.render(scene, camera);

    // Animation réduite : on laisse l'image fixe, déjà rendue ci-dessus.
    if (reduced) {
      return () => {
        observer.disconnect();
        pointGeometry.dispose();
        linkGeometry.dispose();
        renderer.dispose();
        host.removeChild(renderer.domElement);
      };
    }

    let frame = 0;
    let visible = true;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!visible) return;

      for (let i = 0; i < POINT_COUNT; i += 1) {
        for (let axis = 0; axis < 3; axis += 1) {
          const k = i * 3 + axis;
          positions[k] += velocities[k];
          const limit = axis === 0 ? FIELD : FIELD / 2;
          if (positions[k] > limit || positions[k] < -limit) velocities[k] *= -1;
        }
      }
      pointGeometry.attributes.position.needsUpdate = true;
      drawLinks();

      points.rotation.y += 0.0006;
      links.rotation.y = points.rotation.y;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    // Rien ne tourne pour un décor que personne ne regarde.
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const inView = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0.01 },
    );
    inView.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      inView.disconnect();
      observer.disconnect();
      pointGeometry.dispose();
      linkGeometry.dispose();
      (points.material as THREE.Material).dispose();
      (links.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
