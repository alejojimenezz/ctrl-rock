// === RENDERIZADO 3D INTERACTIVO PARA TARJETAS DE MODELOS ===

document.addEventListener("DOMContentLoaded", () => {
    const viewports = document.querySelectorAll(".model-3d-card-viewport");
    
    viewports.forEach(viewport => {
        const modelType = viewport.getAttribute("data-model");
        initCard3D(viewport, modelType);
    });
});

function initCard3D(container, type) {
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;
    
    // 1. Escena y Cámara
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);
    
    // 2. Renderizador
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    
    // 3. Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    const pointLight = new THREE.PointLight(0xffeedd, 0.5, 10);
    pointLight.position.set(-4, -2, 3);
    scene.add(pointLight);

    // 4. Crear Contenedor del Modelo
    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);
    
    // 5. Definición Geométrica del Cuerpo (Procedural)
    const bodyShape = new THREE.Shape();
    const length = 2.8;
    const widthFactor = 2.1;
    
    if (type === 'Strat') {
        // Stratocaster shape outline
        bodyShape.moveTo(0, -length/2);
        bodyShape.quadraticCurveTo(widthFactor/2, -length/2, widthFactor*0.5, -length*0.2);
        bodyShape.quadraticCurveTo(widthFactor*0.55, length*0.1, widthFactor*0.35, length*0.25);
        bodyShape.quadraticCurveTo(widthFactor*0.4, length*0.35, widthFactor*0.23, length*0.48); // Upper horn
        bodyShape.quadraticCurveTo(widthFactor*0.1, length*0.4, widthFactor*0.05, length*0.25);
        bodyShape.quadraticCurveTo(0, length*0.3, -widthFactor*0.05, length*0.25);
        bodyShape.quadraticCurveTo(-widthFactor*0.1, length*0.4, -widthFactor*0.23, length*0.48); // Lower horn
        bodyShape.quadraticCurveTo(-widthFactor*0.4, length*0.35, -widthFactor*0.35, length*0.25);
        bodyShape.quadraticCurveTo(-widthFactor*0.55, length*0.1, -widthFactor*0.5, -length*0.2);
        bodyShape.quadraticCurveTo(-widthFactor/2, -length/2, 0, -length/2);
    } else if (type === 'LesPaul') {
        // Les Paul shape outline
        bodyShape.moveTo(0, -length/2);
        bodyShape.quadraticCurveTo(widthFactor*0.46, -length/2, widthFactor*0.48, -length*0.25);
        bodyShape.quadraticCurveTo(widthFactor*0.48, length*0.05, widthFactor*0.25, length*0.13); // Waist
        bodyShape.quadraticCurveTo(widthFactor*0.33, length*0.3, widthFactor*0.15, length*0.45); // Shoulder
        bodyShape.quadraticCurveTo(0, length*0.44, -widthFactor*0.15, length*0.45); 
        bodyShape.quadraticCurveTo(-widthFactor*0.32, length*0.32, -widthFactor*0.32, length*0.18); // Lower horn cut
        bodyShape.quadraticCurveTo(-widthFactor*0.2, length*0.08, -widthFactor*0.32, -0.05); 
        bodyShape.quadraticCurveTo(-widthFactor*0.48, -length*0.25, -widthFactor*0.46, -length*0.25);
        bodyShape.quadraticCurveTo(-widthFactor*0.46, -length/2, 0, -length/2);
    } else if (type === 'V-Agresiva') {
        // Flying V shape outline
        bodyShape.moveTo(0, length*0.42); // Headward tip
        bodyShape.lineTo(widthFactor*0.46, -length*0.45); // Right horn tip
        bodyShape.lineTo(widthFactor*0.25, -length*0.48); // Inner cutout right
        bodyShape.lineTo(0, -length*0.12); // Inner crotch
        bodyShape.lineTo(-widthFactor*0.25, -length*0.48); // Inner cutout left
        bodyShape.lineTo(-widthFactor*0.46, -length*0.45); // Left horn tip
        bodyShape.lineTo(0, length*0.42); // Headward tip
    }

    const extrudeSettings = {
        depth: 0.28,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.03,
        bevelThickness: 0.03
    };

    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeometry.center();
    
    // Asignar colores de acuerdo al modelo conservando paleta
    let bodyColor = 0xb73225; // Strat - Rojo Cereza
    let metalness = 0.1;
    let roughness = 0.2;
    
    if (type === 'LesPaul') {
        bodyColor = 0x5c3a21; // Les Paul - Caoba Medio
        roughness = 0.1;
    } else if (type === 'V-Agresiva') {
        bodyColor = 0x351c15; // Flying V - Caoba Oscuro (Negruzco)
        roughness = 0.3;
    }
    
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: roughness,
        metalness: metalness
    });
    
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    guitarGroup.add(bodyMesh);
    
    // 6. Mástil y Diapasón
    const neckMaterial = new THREE.MeshStandardMaterial({ color: 0xe4d5c7, roughness: 0.6 }); // Madera clara crema
    const neckGeom = new THREE.BoxGeometry(0.16, 2.2, 0.08);
    const neckMesh = new THREE.Mesh(neckMaterial, neckGeom);
    neckMesh.position.set(0, 1.6, 0.08);
    guitarGroup.add(neckMesh);
    
    const fretboardMaterial = new THREE.MeshStandardMaterial({ color: 0x351c15, roughness: 0.8 }); // Palo de Rosa oscuro
    const fretGeom = new THREE.BoxGeometry(0.15, 2.1, 0.02);
    const fretMesh = new THREE.Mesh(fretboardMaterial, fretGeom);
    fretMesh.position.set(0, 1.55, 0.13);
    guitarGroup.add(fretMesh);
    
    // 7. Cabeza (Headstock)
    let headColor = bodyColor;
    const headGeom = new THREE.BoxGeometry(0.22, 0.5, 0.06);
    const headMaterial = new THREE.MeshStandardMaterial({ color: headColor, roughness: roughness });
    const headMesh = new THREE.Mesh(headMaterial, headGeom);
    headMesh.position.set(0, 2.8, 0.08);
    guitarGroup.add(headMesh);
    
    // 8. Herrajes Metálicos (Pastillas y Puente)
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
    
    // Puente (Bridge)
    const bridgeGeom = new THREE.BoxGeometry(0.24, 0.12, 0.06);
    const bridgeMesh = new THREE.Mesh(metalMaterial, bridgeGeom);
    bridgeMesh.position.set(0, -0.6, 0.18);
    guitarGroup.add(bridgeMesh);
    
    // Pastillas (Pickups)
    const pickupGeom = new THREE.BoxGeometry(0.12, 0.28, 0.04);
    const pickup1 = new THREE.Mesh(metalMaterial, pickupGeom);
    pickup1.rotation.z = Math.PI / 2;
    pickup1.position.set(0, -0.2, 0.18);
    guitarGroup.add(pickup1);
    
    const pickup2 = pickup1.clone();
    pickup2.position.set(0, 0.2, 0.18);
    guitarGroup.add(pickup2);
    
    // Centrar todo el grupo
    guitarGroup.position.y = -0.5;
    guitarGroup.rotation.y = -0.4;
    guitarGroup.rotation.x = 0.15;
    
    // 9. Lógica de Interactividad por Mouse / Touch
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
    });
    
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const deltaMove = {
            x: e.clientX - rect.left - previousMousePosition.x,
            y: e.clientY - rect.top - previousMousePosition.y
        };
        
        if (isDragging) {
            guitarGroup.rotation.y += deltaMove.x * 0.01;
            guitarGroup.rotation.x += deltaMove.y * 0.01;
        }
        
        previousMousePosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Soporte Móvil
    container.addEventListener('touchstart', (e) => {
        isDragging = true;
        const rect = container.getBoundingClientRect();
        previousMousePosition = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    });
    
    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        const deltaMove = {
            x: e.touches[0].clientX - rect.left - previousMousePosition.x,
            y: e.touches[0].clientY - rect.top - previousMousePosition.y
        };
        
        guitarGroup.rotation.y += deltaMove.x * 0.01;
        guitarGroup.rotation.x += deltaMove.y * 0.01;
        
        previousMousePosition = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
        };
    });
    
    window.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // 10. Loop de Animación
    function animate() {
        requestAnimationFrame(animate);
        
        if (!isDragging) {
            // Rotar perezosamente si no se interactúa
            guitarGroup.rotation.y += 0.007;
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Manejo de Redimensionado individual
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
}
