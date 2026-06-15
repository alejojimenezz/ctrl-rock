// === MÓDULO GLOBAL CTRL+ROCK: RENDERIZADO 3D Y AUDIO INTERACTIVO ===

document.addEventListener("DOMContentLoaded", () => {
    // 1. INICIALIZACIÓN DE MODELOS 3D
    const viewports = document.querySelectorAll(".model-3d-card-viewport");
    
    if (viewports.length === 0) {
        console.error("Ctrl+Rock Error: No se encontraron elementos con la clase '.model-3d-card-viewport' en el HTML.");
    }
    
    viewports.forEach(viewport => {
        const modelType = viewport.getAttribute("data-model");
        initCard3D(viewport, modelType);
    });

    // 2. GESTOR INTERACTIVO DE AUDIO PARA PREVISUALIZACIÓN DE TONOS
    const playButtons = document.querySelectorAll(".btn-audio-play");
    let currentAudio = null;
    let currentButton = null;

    playButtons.forEach(button => {
        button.addEventListener("click", () => {
            let soundPath = button.getAttribute("data-sound");
            const icon = button.querySelector(".icon-play");

            // CORRECCIÓN: Si el archivo se abre localmente (protocolo file://) 
            // y la ruta es absoluta (empieza con '/'), la volvemos relativa 
            // para evitar el error "Failed to load" buscando en la raíz del disco duro.
            if (window.location.protocol === 'file:' && soundPath.startsWith('/')) {
                soundPath = '.' + soundPath;
            }

            // Si se hace clic en el botón que ya está sonando, pausarlo/reanudarlo
            if (currentButton === button) {
                if (!currentAudio.paused) {
                    currentAudio.pause();
                    icon.textContent = "▶";
                    button.classList.remove("playing");
                } else {
                    currentAudio.play()
                        .then(() => {
                            icon.textContent = "⏸";
                            button.classList.add("playing");
                        })
                        .catch(err => console.error("Error al reanudar:", err));
                }
                return;
            }

            // Detener audio anterior si se hace clic en un botón diferente
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = "";

                if (currentButton) {
                    currentButton.querySelector(".icon-play").textContent = "▶";
                    currentButton.classList.remove("playing");
                }
            }

            // Crear y reproducir nuevo audio
            try {
                currentAudio = new Audio(soundPath);
                currentAudio.preload = "auto";
                currentAudio.volume = 1.0;
                currentButton = button;

                currentAudio.play()
                    .then(() => {
                        icon.textContent = "⏸";
                        button.classList.add("playing");
                    })
                    .catch(error => {
                        console.error("Error reproduciendo audio:", error);
                    });

                currentAudio.addEventListener("ended", () => {
                    icon.textContent = "▶";
                    button.classList.remove("playing");

                    currentAudio = null;
                    currentButton = null;
                });

            } catch (error) {
                console.error("Error creando Audio:", error);
            }
        });
    });
});

// === FUNCIÓN CONSTRUCTORA DEL ENTORNO 3D (THREE.JS) ===
function initCard3D(container, type) {
    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;
    
    const normalizedType = type ? type.toLowerCase().trim() : '';

    const scene = new THREE.Scene();
    
    // Cámara de frente con perspectiva óptima
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);
    
    // CONFIGURACIÓN ULTRA DEL RENDERIZADOR
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);
    
    // ILUMINACIÓN DE ESTUDIO FOTOGRÁFICO
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); 
    scene.add(ambientLight);
    
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.8); 
    mainLight.position.set(4, 6, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005; 
    scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.7); 
    fillLight.position.set(-5, 2, 3);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2); 
    rimLight.position.set(0, 4, -6);
    scene.add(rimLight);

    // Generación de reflejos de entorno dinámicos (PBR)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const sceneEnv = pmremGenerator.fromScene(new THREE.Scene()).texture;
    scene.environment = sceneEnv;

    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);
    
    const bodyShape = new THREE.Shape();
    const length = 2.8;
    const widthFactor = 2.1;
    
    let modelMatched = true;

    // === TRAZADOS GEOMÉTRICOS DE LOS MODELOS REALES ===
    if (normalizedType === 'lespaul') {
        bodyShape.moveTo(0, -length/2);
        bodyShape.quadraticCurveTo(widthFactor*0.48, -length/2, widthFactor*0.5, -length*0.22);
        bodyShape.quadraticCurveTo(widthFactor*0.5, length*0.05, widthFactor*0.26, length*0.12);
        bodyShape.quadraticCurveTo(widthFactor*0.35, length*0.28, widthFactor*0.12, length*0.45);
        bodyShape.lineTo(widthFactor*0.08, length*0.32);
        bodyShape.quadraticCurveTo(widthFactor*0.02, length*0.22, -widthFactor*0.06, length*0.24);
        bodyShape.quadraticCurveTo(-widthFactor*0.36, length*0.32, -widthFactor*0.34, length*0.16);
        bodyShape.quadraticCurveTo(-widthFactor*0.22, length*0.06, -widthFactor*0.44, -length*0.08);
        bodyShape.quadraticCurveTo(-widthFactor*0.52, -length*0.28, -widthFactor*0.46, -length*0.22);
        bodyShape.quadraticCurveTo(-widthFactor*0.46, -length/2, 0, -length/2);

    } else if (normalizedType === 'telecaster') {
        bodyShape.moveTo(0, -length/2);
        bodyShape.quadraticCurveTo(widthFactor*0.44, -length/2, widthFactor*0.46, -length*0.18);
        bodyShape.quadraticCurveTo(widthFactor*0.46, length*0.08, widthFactor*0.32, length*0.14);
        bodyShape.quadraticCurveTo(widthFactor*0.38, length*0.26, widthFactor*0.16, length*0.44);
        bodyShape.lineTo(widthFactor*0.14, length*0.3);
        bodyShape.lineTo(-widthFactor*0.04, length*0.3);
        bodyShape.lineTo(-widthFactor*0.06, length*0.44);
        bodyShape.quadraticCurveTo(-widthFactor*0.42, length*0.44, -widthFactor*0.44, length*0.14);
        bodyShape.quadraticCurveTo(-widthFactor*0.44, -length*0.18, -widthFactor*0.42, -length*0.22);
        bodyShape.quadraticCurveTo(-widthFactor*0.42, -length/2, 0, -length/2);

    } else if (normalizedType === 'ibanezxp') {
        bodyShape.moveTo(0, -length*0.1); 
        bodyShape.lineTo(widthFactor*0.45, -length*0.48);
        bodyShape.lineTo(widthFactor*0.22, -length*0.22); 
        bodyShape.lineTo(widthFactor*0.52, length*0.18);
        bodyShape.lineTo(widthFactor*0.12, length*0.15);  
        bodyShape.lineTo(0, length*0.35);
        bodyShape.lineTo(-widthFactor*0.12, length*0.15); 
        bodyShape.lineTo(-widthFactor*0.52, length*0.18);
        bodyShape.lineTo(-widthFactor*0.22, -length*0.22);
        bodyShape.lineTo(-widthFactor*0.45, -length*0.48);
        bodyShape.lineTo(0, -length*0.1);

    } else if (normalizedType === 'mockingbird') {
        bodyShape.moveTo(-widthFactor*0.2, -length*0.48);
        bodyShape.lineTo(widthFactor*0.35, -length*0.35);
        bodyShape.quadraticCurveTo(widthFactor*0.46, -length*0.1, widthFactor*0.48, length*0.05);
        bodyShape.lineTo(widthFactor*0.15, length*0.12);
        bodyShape.lineTo(0, length*0.32);
        bodyShape.lineTo(-widthFactor*0.25, length*0.46);
        bodyShape.lineTo(-widthFactor*0.32, length*0.18);  
        bodyShape.lineTo(-widthFactor*0.52, length*0.12);
        bodyShape.lineTo(-widthFactor*0.26, -length*0.22);
        bodyShape.lineTo(-widthFactor*0.2, -length*0.48);

    } else if (normalizedType === 'espex') {
        bodyShape.moveTo(-widthFactor*0.45, -length*0.46);
        bodyShape.lineTo(widthFactor*0.25, -length*0.46);
        bodyShape.lineTo(widthFactor*0.48, -length*0.12);
        bodyShape.lineTo(widthFactor*0.18, length*0.12);
        bodyShape.lineTo(0, length*0.36);
        bodyShape.lineTo(-widthFactor*0.28, length*0.22);
        bodyShape.lineTo(-widthFactor*0.22, -0.05);
        bodyShape.lineTo(-widthFactor*0.45, -length*0.46);

    } else if (normalizedType === 'danelectro') {
        bodyShape.moveTo(0, -length/2);
        bodyShape.quadraticCurveTo(widthFactor*0.42, -length/2, widthFactor*0.44, -length*0.15);
        bodyShape.quadraticCurveTo(widthFactor*0.44, length*0.02, widthFactor*0.25, length*0.08);
        bodyShape.quadraticCurveTo(widthFactor*0.35, length*0.18, widthFactor*0.28, length*0.38);
        bodyShape.quadraticCurveTo(widthFactor*0.18, length*0.36, widthFactor*0.08, length*0.22);
        bodyShape.lineTo(0, length*0.24);
        bodyShape.lineTo(-widthFactor*0.08, length*0.22);
        bodyShape.quadraticCurveTo(-widthFactor*0.18, length*0.36, -widthFactor*0.28, length*0.38);
        bodyShape.quadraticCurveTo(-widthFactor*0.35, length*0.18, -widthFactor*0.25, length*0.08);
        bodyShape.quadraticCurveTo(-widthFactor*0.44, length*0.02, -widthFactor*0.44, -length*0.15);
        bodyShape.quadraticCurveTo(-widthFactor*0.42, -length/2, 0, -length/2);
    } else {
        modelMatched = false;
        bodyShape.moveTo(-widthFactor/3, -length/2);
        bodyShape.lineTo(widthFactor/3, -length/2);
        bodyShape.lineTo(widthFactor/3, length/2);
        bodyShape.lineTo(-widthFactor/3, length/2);
        bodyShape.lineTo(-widthFactor/3, -length/2);
    }

    const extrudeSettings = {
        depth: 0.22,
        bevelEnabled: true,
        bevelSegments: 5,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.025
    };

    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeometry.center();
    
    let bodyColor = 0xb73225; 
    let metalness = 0.05;
    let roughness = 0.15;
    
    if (normalizedType === 'lespaul') {
        bodyColor = 0xe5983b; 
        roughness = 0.1;
    } else if (normalizedType === 'telecaster') {
        bodyColor = 0xf3dfa2; 
        roughness = 0.12;
    } else if (normalizedType === 'ibanezxp') {
        bodyColor = 0x0d0d0d; 
        roughness = 0.15;
        metalness = 0.6;
    } else if (normalizedType === 'mockingbird') {
        bodyColor = 0x7a1c2e; 
        roughness = 0.08;
    } else if (normalizedType === 'espex') {
        bodyColor = 0x1a1a1a; 
        roughness = 0.4;
    } else if (normalizedType === 'danelectro') {
        bodyColor = 0x5a8286; 
        roughness = 0.2;
    } else if (!modelMatched) {
        bodyColor = 0x333333;
    }
    
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
        color: bodyColor,
        roughness: roughness,   
        metalness: metalness,
        clearcoat: 1.0,               
        clearcoatRoughness: 0.04,     
        reflectivity: 0.85
    });
    
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    guitarGroup.add(bodyMesh);
    
    const neckMaterial = new THREE.MeshStandardMaterial({ color: 0xe2d4c1, roughness: 0.45 });
    const neckGeom = new THREE.BoxGeometry(0.14, 2.3, 0.07);
    const neckMesh = new THREE.Mesh(neckGeom, neckMaterial); 
    neckMesh.position.set(0, 1.6, 0.06);
    neckMesh.castShadow = true;
    guitarGroup.add(neckMesh);
    
    const fretboardMaterial = new THREE.MeshStandardMaterial({ color: 0x221308, roughness: 0.8 });
    const fretGeom = new THREE.BoxGeometry(0.13, 2.2, 0.02);
    const fretMesh = new THREE.Mesh(fretGeom, fretboardMaterial);
    fretMesh.position.set(0, 1.55, 0.1);
    fretMesh.castShadow = true;
    guitarGroup.add(fretMesh);
    
    const headGeom = new THREE.BoxGeometry(0.2, 0.5, 0.05);
    const headMaterial = new THREE.MeshPhysicalMaterial({ color: bodyColor, roughness: roughness, clearcoat: 0.8 });
    const headMesh = new THREE.Mesh(headGeom, headMaterial);
    headMesh.position.set(0, 2.8, 0.06);
    headMesh.castShadow = true;
    guitarGroup.add(headMesh);
    
    const metalMaterial = new THREE.MeshPhysicalMaterial({ 
        color: 0xf5f5f5, 
        metalness: 1.0, 
        roughness: 0.05,
        reflectivity: 1.0
    });
    
    const bridgeGeom = new THREE.BoxGeometry(0.22, 0.12, 0.05);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, metalMaterial);
    bridgeMesh.position.set(0, -0.6, 0.14);
    bridgeMesh.castShadow = true;
    guitarGroup.add(bridgeMesh);
    
    const pickupGeom = new THREE.BoxGeometry(0.12, 0.26, 0.04);
    const pickup1 = new THREE.Mesh(pickupGeom, metalMaterial);
    pickup1.rotation.z = Math.PI / 2;
    pickup1.position.set(0, -0.2, 0.14);
    pickup1.castShadow = true;
    guitarGroup.add(pickup1);

    const pickup2 = pickup1.clone();
    pickup2.position.set(0, 0.2, 0.14);
    pickup2.castShadow = true;
    guitarGroup.add(pickup2);
    
    guitarGroup.position.set(0, -0.4, 0);
    guitarGroup.rotation.set(0, 0, 0);
    
    let isHovered = false;

    container.addEventListener('pointerover', () => { isHovered = true; });
    container.addEventListener('pointerout', () => { isHovered = false; });

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    
    container.addEventListener('mousedown', () => { isDragging = true; });
    
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
        previousMousePosition = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
    
    window.addEventListener('mouseup', () => { isDragging = false; });
    
    function animate() {
        requestAnimationFrame(animate);

        const targetBodyZ = isHovered ? -1.2 : 0;      
        const targetNeckY = isHovered ? 2.6 : 1.6;      
        const targetNeckZ = isHovered ? 0.4 : 0.06;     
        const targetFretY = isHovered ? 2.55 : 1.55;    
        const targetFretZ = isHovered ? 0.9 : 0.1;      
        const targetHeadY = isHovered ? 3.9 : 2.8;      
        const targetHeadZ = isHovered ? 0.4 : 0.06;
        const targetBridgeZ = isHovered ? 1.1 : 0.14;   
        const targetPickup1Z = isHovered ? 1.4 : 0.14;  
        const targetPickup2Z = isHovered ? 1.4 : 0.14;

        bodyMesh.position.z += (targetBodyZ - bodyMesh.position.z) * 0.1;
        neckMesh.position.y += (targetNeckY - neckMesh.position.y) * 0.1;
        neckMesh.position.z += (targetNeckZ - neckMesh.position.z) * 0.1;
        fretMesh.position.y += (targetFretY - fretMesh.position.y) * 0.1;
        fretMesh.position.z += (targetFretZ - fretMesh.position.z) * 0.1;
        headMesh.position.y += (targetHeadY - headMesh.position.y) * 0.1;
        headMesh.position.z += (targetHeadZ - headMesh.position.z) * 0.1;
        bridgeMesh.position.z += (targetBridgeZ - bridgeMesh.position.z) * 0.1;
        pickup1.position.z += (targetPickup1Z - pickup1.position.z) * 0.1;
        pickup2.position.z += (targetPickup2Z - pickup2.position.z) * 0.1;
        
        if (!isDragging && !isHovered) {
            guitarGroup.rotation.y += (0 - guitarGroup.rotation.y) * 0.08;
            guitarGroup.rotation.x += (0 - guitarGroup.rotation.x) * 0.08;
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
}