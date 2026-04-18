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
    targetX = (event.clientX - window.innerWidth / 2) * 0.01;
    targetY = (event.clientY - window.innerHeight / 2) * 0.01;
  };

  onMount(() => {
    if (!container) return;

    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(20, 20, 40);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Theme: "The 9 Hall Council"
    const group = new THREE.Group();
    scene.add(group);

    const dormCount = 9;
    const dorms: THREE.Mesh[] = [];
    const maroonColor = new THREE.Color(0x7b1113);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    // Create 9 Primary Dorm Nodes
    for (let i = 0; i < dormCount; i++) {
      const height = 4 + Math.random() * 8;
      const material = new THREE.MeshPhongMaterial({
        color: maroonColor,
        transparent: true,
        opacity: 0.6,
        shininess: 100
      });

      const mesh = new THREE.Mesh(boxGeo, material);
      mesh.scale.set(3, height, 3);

      // Arrange in a circle representing the unity of the 9 dorms
      const angle = (i / dormCount) * Math.PI * 2;
      const radius = 18;
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.z = Math.sin(angle) * radius;
      mesh.position.y = height / 2 - 4;

      group.add(mesh);
      dorms.push(mesh);

      // Blueprint Edges
      const edges = new THREE.EdgesGeometry(boxGeo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: 0xc1121f,
          opacity: 0.8,
          transparent: true
        })
      );
      line.scale.copy(mesh.scale);
      line.position.copy(mesh.position);
      group.add(line);
    }

    // Association Network: Interconnect the 9 dorms
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xc1121f,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < dorms.length; i++) {
      for (let j = i + 1; j < dorms.length; j++) {
        const points = [dorms[i].position, dorms[j].position];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const associationLine = new THREE.Line(lineGeo, lineMaterial);
        group.add(associationLine);
      }
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1000);
    pointLight.position.set(0, 30, 0);
    scene.add(pointLight);

    // Student Particles
    const particlesGeometry = new THREE.BufferGeometry();
    const pCount = 400;
    const positions = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 80;
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.5
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Animation
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      const time = Date.now() * 0.0003;

      group.rotation.y += 0.001;

      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      camera.position.x = 20 + mouseX;
      camera.position.y = 20 - mouseY;
      camera.lookAt(0, 0, 0);

      // Pulse the 9 councils
      dorms.forEach((d, i) => {
        const offset = i * 0.5;
        d.scale.y = (4 + Math.sin(time + offset) * 2) * (1 + Math.sin(time * 2 + offset) * 0.1);
      });

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
      boxGeo.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      lineMaterial.dispose();
    };
  });
</script>

<div bind:this={container} class="absolute inset-0 z-10 opacity-90"></div>
