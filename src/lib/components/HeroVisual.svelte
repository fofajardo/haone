<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import * as THREE from "three";

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let frameId: number;

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  const handleMouseMove = (event: MouseEvent) => {
    targetX = (event.clientX - window.innerWidth / 2) * 0.005;
    targetY = (event.clientY - window.innerHeight / 2) * 0.005;
  };

  onMount(() => {
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(35, 30, 60);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Modern Dorm Block Factory
    const createDormBlock = (height: number, color: number) => {
      const group = new THREE.Group();

      // Main block
      const bodyGeo = new THREE.BoxGeometry(4, height, 4);
      const bodyMat = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.85
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = height / 2;
      group.add(body);

      // Edge Highlights (Blueprint feel)
      const edges = new THREE.EdgesGeometry(bodyGeo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.15, transparent: true })
      );
      line.position.copy(body.position);
      group.add(line);

      // Window Grids (Modernist slits)
      const winGeo = new THREE.PlaneGeometry(0.2, 0.8);
      const winMat = new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.6
      });

      for (let floor = 0; floor < height - 1; floor++) {
        for (let side = 0; side < 4; side++) {
          const win = new THREE.Mesh(winGeo, winMat);
          const yPos = floor + 1;

          if (side === 0) win.position.set(-1, yPos, 2.01);
          if (side === 1) win.position.set(1, yPos, 2.01);
          if (side === 2) {
            win.position.set(2.01, yPos, -1);
            win.rotation.y = Math.PI / 2;
          }
          if (side === 3) {
            win.position.set(2.01, yPos, 1);
            win.rotation.y = Math.PI / 2;
          }

          group.add(win);
        }
      }

      // Roof details (HVAC/Mechanical)
      const mechGeo = new THREE.BoxGeometry(1.5, 0.5, 1.5);
      const mech = new THREE.Mesh(mechGeo, bodyMat);
      mech.position.y = height + 0.25;
      group.add(mech);

      return group;
    };

    // Minimalist Tree
    const createMinimalTree = () => {
      const group = new THREE.Group();
      const trunkGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
      const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshPhongMaterial({ color: 0x333333 }));
      trunk.position.y = 1;
      group.add(trunk);

      const topGeo = new THREE.SphereGeometry(0.8, 4, 4);
      const top = new THREE.Mesh(topGeo, new THREE.MeshPhongMaterial({ color: 0x2d5a27 }));
      top.position.y = 2.2;
      group.add(top);
      return group;
    };

    const dormCount = 9;
    const dorms: THREE.Group[] = [];
    const maroonColor = 0x7b1113;

    for (let i = 0; i < dormCount; i++) {
      const h = 6 + Math.random() * 6;
      const dorm = createDormBlock(h, maroonColor);
      const angle = (i / dormCount) * Math.PI * 2;
      const radius = 20;
      dorm.position.x = Math.cos(angle) * radius;
      dorm.position.z = Math.sin(angle) * radius;
      dorm.rotation.y = -angle;
      worldGroup.add(dorm);
      dorms.push(dorm);

      // Add accent blocks
      const accentTree = createMinimalTree();
      accentTree.position.x = Math.cos(angle + 0.15) * (radius - 5);
      accentTree.position.z = Math.sin(angle + 0.15) * (radius - 5);
      worldGroup.add(accentTree);
    }

    // Community Data Streams (Abstract paths)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xc1121f,
      transparent: true,
      opacity: 0.2
    });

    for (let i = 0; i < dormCount; i++) {
      const next = (i + 1) % dormCount;
      const points = [dorms[i].position, dorms[next].position];
      const curve = new THREE.QuadraticBezierCurve3(
        dorms[i].position,
        new THREE.Vector3(0, 5, 0),
        dorms[next].position
      );
      const pathGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
      const line = new THREE.Line(pathGeo, lineMat);
      worldGroup.add(line);
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(20, 40, 20);
    scene.add(mainLight);

    const glowLight = new THREE.PointLight(0xffd700, 100, 50);
    glowLight.position.set(0, 5, 0);
    scene.add(glowLight);

    // "Spirit" Particles
    const particlesGeo = new THREE.BufferGeometry();
    const pCount = 300;
    const pos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pos[i] = (Math.random() - 0.5) * 80;
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      transparent: true,
      opacity: 0.4
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Animation
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const time = Date.now() * 0.0005;

      worldGroup.rotation.y += 0.0008;

      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      camera.position.x = 35 + mouseX * 15;
      camera.position.y = 30 - mouseY * 15;
      camera.lookAt(0, 0, 0);

      dorms.forEach((d, i) => {
        const offset = i * 0.4;
        d.position.y = Math.sin(time + offset) * 0.3;
      });

      particles.rotation.y += 0.0002;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      particlesGeo.dispose();
      particlesMat.dispose();
      lineMat.dispose();
    };
  });
</script>

<div bind:this={container} class="absolute inset-0 z-10 opacity-90"></div>
