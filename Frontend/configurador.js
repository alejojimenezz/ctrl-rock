// === CONFIGURADOR 3D INTERACTIVO Y PARAMÉTRICO DE GUITARRAS ===

document.addEventListener("DOMContentLoaded", () => {
    // 1. Obtener Parámetros URL y Elementos DOM
    const urlParams = new URLSearchParams(window.location.search);
    const modeloId = urlParams.get('modelo') || 'Strat';

    const container = document.getElementById('guitar-preview-container');
    const canvas = document.getElementById('guitar-preview-canvas');
    
    // Sliders CAD
    const sliderLength = document.getElementById('bodyLength');
    const sliderWidth = document.getElementById('bodyWidth');
    const sliderThickness = document.getElementById('bodyThickness');
    const sliderScale = document.getElementById('scaleLength');
    
    // Spans de valor
    const valLength = document.getElementById('val-bodyLength');
    const valWidth = document.getElementById('val-bodyWidth');
    const valThickness = document.getElementById('val-bodyThickness');
    const valScale = document.getElementById('val-scaleLength');
    
    // Spans de resumen
    const sumMadera = document.getElementById('sum-madera');
    const sumColor = document.getElementById('sum-color');
    const sumHardware = document.getElementById('sum-hardware');
    const sumPickups = document.getElementById('sum-pickups');
    const sumCad = document.getElementById('sum-cad');
    
    // Botones Toolbar
    const btnReset = document.getElementById('btn-reset-cam');
    const btnWireframe = document.getElementById('btn-toggle-wireframe');
    const btnGrid = document.getElementById('btn-toggle-grid');
    const btnAxes = document.getElementById('btn-toggle-axes');
    const btnExport = document.getElementById('btn-export-cad');

    // 2. Configurar Escena Three.js
    const scene = new THREE.Scene();
    scene.background = null; // Transparente para degradado CSS
    
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    resetCamera();

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // OrbitControls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.target.set(0, 0.8, 0);

    // Helpers
    const gridHelper = new THREE.GridHelper(10, 20, 0x5c3a21, 0xd1c4b9);
    gridHelper.position.y = -1.8;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-2, -1.5, 0);
    axesHelper.visible = false;
    scene.add(axesHelper);

    // 3. Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    dirLight1.shadow.bias = -0.001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffeedd, 0.4);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    const spotLight = new THREE.SpotLight(0xffffff, 0.6);
    spotLight.position.set(0, 4, 6);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    // Grupo de la Guitarra
    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);

    // 4. Configurar Estado Inicial de Materiales
    let currentWood = 'caoba';
    let currentColor = 'cherry';
    let currentHardware = 'chrome';
    let currentPickups = 'humbucker';
    let isWireframe = false;

    // Definición de Maderas (Cuerpo/Mástil/Diapasón)
    const woodMaterials = {
        caoba: { color: 0x5c3a21, roughness: 0.35, metalness: 0.1 },
        fresno: { color: 0xe6d4c3, roughness: 0.45, metalness: 0.05 },
        arce: { color: 0xfbf4eb, roughness: 0.3, metalness: 0.05 }
    };

    // Definición de Acabados
    const finishMaterials = {
        cherry: { color: 0xb73225, roughness: 0.1, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05 }, // Glossy
        natural: { color: null, roughness: 0.3, metalness: 0.05, clearcoat: 0.4 }, // Depende de la madera elegida
        sunburst: { color: 0xe07a1b, roughness: 0.08, metalness: 0.1, clearcoat: 1.0 }, // Naranja con bordes quemados
        negro: { color: 0x1f1a18, roughness: 0.8, metalness: 0.2, clearcoat: 0.0 }, // Mate
        goldtop: { color: 0xd4af37, roughness: 0.15, metalness: 0.85, clearcoat: 0.9 } // Metalizado
    };

    // Definición de Metales
    const metalMaterials = {
        chrome: { color: 0xcccccc, metalness: 0.95, roughness: 0.05 },
        gold: { color: 0xdaa520, metalness: 0.9, roughness: 0.08 },
        black: { color: 0x222222, metalness: 0.8, roughness: 0.2 }
    };

    // Materiales Dinámicos de Three.js
    const bodyMaterialObj = new THREE.MeshPhysicalMaterial({
        color: 0xb73225,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });

    const neckMaterialObj = new THREE.MeshStandardMaterial({
        color: 0xf5efe6,
        roughness: 0.5,
        metalness: 0.0
    });

    const fretboardMaterialObj = new THREE.MeshStandardMaterial({
        color: 0x351c15, // Palo de rosa oscuro por defecto
        roughness: 0.8
    });

    const hardwareMaterialObj = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.95,
        roughness: 0.05
    });

    const plasticMaterialObj = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.5
    });

    const stringMaterialObj = new THREE.LineBasicMaterial({
        color: 0xdddddd,
        transparent: true,
        opacity: 0.6
    });

    // Meshes que se actualizarán
    let bodyMesh, neckMesh, fretboardMesh, headstockMesh, bridgeMesh;
    let pickupMeshes = [];
    let tunerMeshes = [];
    let stringLines = [];

    // Iniciar
    updateMaterials();
    rebuildGuitar();

    // 5. Función para Reconstruir la Geometría Paramétricamente
    function rebuildGuitar() {
        // Limpiar geometrías previas
        if (bodyMesh) guitarGroup.remove(bodyMesh);
        if (neckMesh) guitarGroup.remove(neckMesh);
        if (fretboardMesh) guitarGroup.remove(fretboardMesh);
        if (headstockMesh) guitarGroup.remove(headstockMesh);
        if (bridgeMesh) guitarGroup.remove(bridgeMesh);
        
        pickupMeshes.forEach(m => guitarGroup.remove(m));
        pickupMeshes = [];
        tunerMeshes.forEach(m => guitarGroup.remove(m));
        tunerMeshes = [];
        stringLines.forEach(l => guitarGroup.remove(l));
        stringLines = [];

        // Leer valores en mm y escalar para Three.js (100mm = 1 unit en Three.js)
        const L = parseFloat(sliderLength.value) / 100;
        const W = parseFloat(sliderWidth.value) / 100;
        const T = parseFloat(sliderThickness.value) / 100;
        const S = parseFloat(sliderScale.value) / 100;

        // A. CUERPO (EXTRUSIÓN)
        const bodyShape = new THREE.Shape();
        if (modeloId === 'Strat') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo(W/2, -L/2, W*0.5, -L*0.2);
            bodyShape.quadraticCurveTo(W*0.55, L*0.1, W*0.35, L*0.25);
            bodyShape.quadraticCurveTo(W*0.4, L*0.35, W*0.23, L*0.48); // Horn
            bodyShape.quadraticCurveTo(W*0.1, L*0.4, W*0.05, L*0.25);
            bodyShape.quadraticCurveTo(0, L*0.3, -W*0.05, L*0.25);
            bodyShape.quadraticCurveTo(-W*0.1, L*0.4, -W*0.23, L*0.48); // Horn
            bodyShape.quadraticCurveTo(-W*0.4, L*0.35, -W*0.35, L*0.25);
            bodyShape.quadraticCurveTo(-W*0.55, L*0.1, -W*0.5, -L*0.2);
            bodyShape.quadraticCurveTo(-W/2, -L/2, 0, -L/2);
        } else if (modeloId === 'LesPaul') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo(W*0.46, -L/2, W*0.48, -L*0.25);
            bodyShape.quadraticCurveTo(W*0.48, L*0.05, W*0.25, L*0.13); // Cintura
            bodyShape.quadraticCurveTo(W*0.33, L*0.3, W*0.15, L*0.45); // Hombro
            bodyShape.quadraticCurveTo(0, L*0.44, -W*0.15, L*0.45);
            bodyShape.quadraticCurveTo(-W*0.32, L*0.32, -W*0.32, L*0.18); // Horn
            bodyShape.quadraticCurveTo(-W*0.2, L*0.08, -W*0.32, -0.05);
            bodyShape.quadraticCurveTo(-W*0.48, -L*0.25, -W*0.46, -L*0.25);
            bodyShape.quadraticCurveTo(-W*0.46, -L/2, 0, -L/2);
        } else {
            // Flying V
            bodyShape.moveTo(0, L*0.42);
            bodyShape.lineTo(W*0.46, -L*0.45);
            bodyShape.lineTo(W*0.25, -L*0.48);
            bodyShape.lineTo(0, -L*0.12);
            bodyShape.lineTo(-W*0.25, -L*0.48);
            bodyShape.lineTo(-W*0.46, -L*0.45);
            bodyShape.lineTo(0, L*0.42);
        }

        const extrudeSettings = {
            depth: T,
            bevelEnabled: true,
            bevelSegments: 5,
            steps: 1,
            bevelSize: 0.04,
            bevelThickness: 0.04
        };

        const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
        bodyGeometry.center(); // Centra el origen del cuerpo
        
        bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterialObj);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        guitarGroup.add(bodyMesh);

        // B. MÁSTIL (NECK) - Proporcional al Tiro/Escala
        const neckLength = S * 0.45; 
        const neckW = 0.16; // Ancho del mástil
        const neckDepth = 0.08;
        
        const neckGeom = new THREE.BoxGeometry(neckW, neckLength, neckDepth);
        neckMesh = new THREE.Mesh(neckGeom, neckMaterialObj);
        // Colocar arriba del cuerpo
        const neckYPos = L/2 + neckLength/2 - 0.2; 
        neckMesh.position.set(0, neckYPos, T/2);
        guitarGroup.add(neckMesh);

        // C. DIAPASÓN (FRETBOARD)
        const fretboardGeom = new THREE.BoxGeometry(neckW - 0.01, neckLength - 0.05, 0.02);
        fretboardMesh = new THREE.Mesh(fretboardGeom, fretboardMaterialObj);
        fretboardMesh.position.set(0, neckYPos + 0.025, T/2 + neckDepth/2 + 0.01);
        guitarGroup.add(fretboardMesh);

        // D. CABEZA (HEADSTOCK)
        let headstockShape = new THREE.BoxGeometry(0.24, 0.52, 0.06);
        headstockMesh = new THREE.Mesh(headstockShape, bodyMaterialObj);
        const headYPos = neckYPos + neckLength/2 + 0.24;
        headstockMesh.position.set(0, headYPos, T/2);
        guitarGroup.add(headstockMesh);

        // E. CLAVIJAS (TUNERS)
        const pegGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8);
        const knobGeom = new THREE.BoxGeometry(0.04, 0.02, 0.03);
        
        // 6 Clavijas (3 de cada lado o 6 en línea según modelo)
        const tunerYOffsets = [-0.18, -0.06, 0.06, 0.18];
        const isSixInLine = (modeloId === 'Strat');

        if (isSixInLine) {
            // 6 en línea a la izquierda
            for(let i=0; i<6; i++) {
                const tunerGroup = new THREE.Group();
                const peg = new THREE.Mesh(pegGeom, hardwareMaterialObj);
                peg.rotation.x = Math.PI / 2;
                tunerGroup.add(peg);
                
                const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj);
                knob.position.set(-0.06, 0, 0);
                tunerGroup.add(knob);
                
                tunerGroup.position.set(-0.14, headYPos - 0.2 + (i*0.07), T/2);
                guitarGroup.add(tunerGroup);
                tunerMeshes.push(tunerGroup);
            }
        } else {
            // 3 + 3 (Les Paul y Flying V)
            for(let side of [-1, 1]) {
                for(let i=0; i<3; i++) {
                    const tunerGroup = new THREE.Group();
                    const peg = new THREE.Mesh(pegGeom, hardwareMaterialObj);
                    peg.rotation.x = Math.PI / 2;
                    tunerGroup.add(peg);
                    
                    const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj);
                    knob.position.set(0.06 * side, 0, 0);
                    tunerGroup.add(knob);
                    
                    tunerGroup.position.set(0.14 * side, headYPos - 0.12 + (i*0.1), T/2);
                    guitarGroup.add(tunerGroup);
                    tunerMeshes.push(tunerGroup);
                }
            }
        }

        // F. PUENTE (BRIDGE)
        const bridgeW = 0.24;
        const bridgeGeom = new THREE.BoxGeometry(bridgeW, 0.14, 0.06);
        bridgeMesh = new THREE.Mesh(bridgeGeom, hardwareMaterialObj);
        const bridgeYPos = -L/4 - 0.1;
        bridgeMesh.position.set(0, bridgeYPos, T/2 + 0.03);
        guitarGroup.add(bridgeMesh);

        // G. PASTILLAS (PICKUPS)
        const isTriple = (modeloId === 'Strat' && currentPickups === 'singlecoil');
        const numPickups = isTriple ? 3 : 2;
        const pickupH = isTriple ? 0.08 : 0.14; // Humbuckers son más gruesos
        const pickupGeom = new THREE.BoxGeometry(0.24, pickupH, 0.05);

        const pickupOffsets = isTriple 
            ? [bridgeYPos + 0.35, bridgeYPos + 0.7, bridgeYPos + 1.05]
            : [bridgeYPos + 0.45, bridgeYPos + 0.95];

        pickupOffsets.forEach(yOffset => {
            // Marco exterior (Plástico)
            const ringGeom = new THREE.BoxGeometry(0.26, pickupH + 0.03, 0.06);
            const ringMesh = new THREE.Mesh(plasticMaterialObj, ringGeom);
            ringMesh.position.set(0, yOffset, T/2 + 0.02);
            guitarGroup.add(ringMesh);
            pickupMeshes.push(ringMesh);

            // Núcleo pastilla
            const coreMesh = new THREE.Mesh(pickupGeom, currentPickups === 'humbucker' ? plasticMaterialObj : hardwareMaterialObj);
            coreMesh.position.set(0, yOffset, T/2 + 0.03);
            guitarGroup.add(coreMesh);
            pickupMeshes.push(coreMesh);
        });

        // H. CUERDAS (STRINGS)
        // Dibujar 6 cuerdas desde el puente hasta la cabeza
        const startZ = T/2 + 0.05;
        const stringStartXs = [-0.08, -0.05, -0.02, 0.01, 0.04, 0.07];
        
        stringStartXs.forEach((sx, idx) => {
            const points = [];
            points.push(new THREE.Vector3(sx, bridgeYPos, startZ));
            
            // Punto final en la cabeza (aproximado)
            let endX = sx * 0.7;
            let endY = headYPos - 0.1 + (idx * 0.05);
            if (!isSixInLine && idx >= 3) {
                // 3 + 3 headstock
                endX = 0.08;
                endY = headYPos - 0.1 + ((idx-3) * 0.08);
            }
            points.push(new THREE.Vector3(endX, endY, T/2 + 0.04));
            
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geom, stringMaterialObj);
            guitarGroup.add(line);
            stringLines.push(line);
        });

        // Actualizar resumen de dimensiones CAD
        sumCad.innerText = `${sliderLength.value} x ${sliderWidth.value} x ${sliderThickness.value} mm (Escala: ${sliderScale.value}mm)`;
    }

    // 6. Función para Actualizar Materiales Dinámicamente
    function updateMaterials() {
        // A. Madera base
        const woodConf = woodMaterials[currentWood];
        
        // Asignar el color base a la madera del mástil
        neckMaterialObj.color.setHex(woodConf.color);
        neckMaterialObj.roughness = woodConf.roughness;

        // B. Acabado (Color del Cuerpo y Cabeza)
        const finishConf = finishMaterials[currentColor];
        
        // Si el acabado es "Natural", toma el color e info de la madera elegida
        if (currentColor === 'natural') {
            bodyMaterialObj.color.setHex(woodConf.color);
            bodyMaterialObj.roughness = woodConf.roughness;
            bodyMaterialObj.metalness = woodConf.metalness;
            bodyMaterialObj.clearcoat = 0.5;
            bodyMaterialObj.clearcoatRoughness = 0.1;
        } else if (currentColor === 'sunburst') {
            // El color sunburst será naranja con un sombreado en Three.js
            bodyMaterialObj.color.setHex(0xe07a1b);
            bodyMaterialObj.roughness = finishConf.roughness;
            bodyMaterialObj.metalness = finishConf.metalness;
            bodyMaterialObj.clearcoat = finishConf.clearcoat;
            bodyMaterialObj.clearcoatRoughness = 0.05;
        } else {
            bodyMaterialObj.color.setHex(finishConf.color);
            bodyMaterialObj.roughness = finishConf.roughness;
            bodyMaterialObj.metalness = finishConf.metalness;
            bodyMaterialObj.clearcoat = finishConf.clearcoat;
            bodyMaterialObj.clearcoatRoughness = finishConf.clearcoatRoughness || 0.1;
        }

        // C. Metales
        const metalConf = metalMaterials[currentHardware];
        hardwareMaterialObj.color.setHex(metalConf.color);
        hardwareMaterialObj.metalness = metalConf.metalness;
        hardwareMaterialObj.roughness = metalConf.roughness;

        // D. Pastillas plásticos
        if (currentHardware === 'black') {
            plasticMaterialObj.color.setHex(0x0a0a0a);
        } else {
            plasticMaterialObj.color.setHex(0x1a1a1a);
        }

        // Aplicar modo alambre (wireframe)
        bodyMaterialObj.wireframe = isWireframe;
        neckMaterialObj.wireframe = isWireframe;
        fretboardMaterialObj.wireframe = isWireframe;
        hardwareMaterialObj.wireframe = isWireframe;
        plasticMaterialObj.wireframe = isWireframe;
    }

    // 7. Manejadores de Eventos del Configurador (DOM)
    
    // Cambios en Madera
    document.querySelectorAll('[data-wood]').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('[data-wood]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentWood = el.getAttribute('data-wood');
            
            sumMadera.innerText = el.innerText.trim();
            updateMaterials();
        });
    });

    // Cambios en Acabado / Color
    document.querySelectorAll('[data-color]').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('[data-color]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentColor = el.getAttribute('data-color');
            
            sumColor.innerText = el.innerText.trim();
            updateMaterials();
        });
    });

    // Cambios en Metales (Hardware)
    document.querySelectorAll('[data-hardware]').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('[data-hardware]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentHardware = el.getAttribute('data-hardware');
            
            sumHardware.innerText = el.innerText.trim();
            updateMaterials();
        });
    });

    // Cambios en Pastillas
    document.querySelectorAll('[data-pickups]').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('[data-pickups]').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            currentPickups = el.getAttribute('data-pickups');
            
            sumPickups.innerText = el.innerText.trim();
            rebuildGuitar();
        });
    });

    // Sliders CAD (Eventos de actualización instantánea)
    const sliders = [
        { sl: sliderLength, val: valLength },
        { sl: sliderWidth, val: valWidth },
        { sl: sliderThickness, val: valThickness },
        { sl: sliderScale, val: valScale }
    ];

    sliders.forEach(s => {
        s.sl.addEventListener('input', () => {
            s.val.innerText = s.sl.value;
            rebuildGuitar();
        });
    });

    // 8. Eventos de la barra de herramientas del Viewport 3D
    
    // Restablecer Cámara
    function resetCamera() {
        camera.position.set(0, 0.5, 7.5);
        if (controls) {
            controls.target.set(0, 0.8, 0);
            controls.update();
        }
    }
    btnReset.addEventListener('click', resetCamera);

    // Toggle Alambre
    btnWireframe.addEventListener('click', () => {
        isWireframe = !isWireframe;
        btnWireframe.classList.toggle('active', isWireframe);
        updateMaterials();
    });

    // Toggle Grilla CAD
    let isGridVisible = false;
    btnGrid.addEventListener('click', () => {
        isGridVisible = !isGridVisible;
        gridHelper.visible = isGridVisible;
        btnGrid.classList.toggle('active', isGridVisible);
    });

    // Toggle Ejes CAD
    let isAxesVisible = false;
    btnAxes.addEventListener('click', () => {
        isAxesVisible = !isAxesVisible;
        axesHelper.visible = isAxesVisible;
        btnAxes.classList.toggle('active', isAxesVisible);
    });

    // 9. Exportar Parámetros CAD en JSON
    btnExport.addEventListener('click', () => {
        const configData = {
            softwareCompatible: ["Autodesk Inventor", "SolidWorks", "Fusion 360"],
            timestamp: new Date().toISOString(),
            guitarModelBase: modeloId,
            woodSelected: currentWood,
            finishSelected: currentColor,
            hardwareSelected: currentHardware,
            pickupsSelected: currentPickups,
            // Parámetros en mm para importar en Inventor
            bodyLength: parseFloat(sliderLength.value),
            bodyWidth: parseFloat(sliderWidth.value),
            bodyThickness: parseFloat(sliderThickness.value),
            scaleLength: parseFloat(sliderScale.value)
        };

        const jsonStr = JSON.stringify(configData, null, 4);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = `ctrl_rock_${modeloId.toLowerCase()}_parametros_cad.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // 10. Loop de Animación de Renderizado
    function animate() {
        requestAnimationFrame(animate);
        
        // Suave rotación inicial en el configurador si el usuario no arrastra
        if (!controls.state === -1) {
            guitarGroup.rotation.y += 0.002;
        }

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // Redimensionado del canvas
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // === 11. EVENTOS DE INTEGRACIÓN MODO ASISTIDO / EXPERTO ===
    
    // Escuchar cambios de Modo Asistido y actualizar la vista 3D
    document.addEventListener('update3DFromWizard', (e) => {
        const settings = e.detail;
        
        // Sincronizar variables internas
        currentWood = settings.wood;
        currentColor = settings.color;
        currentHardware = settings.hardware;
        currentPickups = settings.pickups;
        
        // Actualizar sliders físicamente en el DOM (para que el experto se sincronice)
        sliderLength.value = settings.length;
        sliderWidth.value = settings.width;
        sliderThickness.value = settings.thickness;
        sliderScale.value = settings.scale;
        
        // Actualizar etiquetas de valor del modo experto
        valLength.innerText = settings.length;
        valWidth.innerText = settings.width;
        valThickness.innerText = settings.thickness;
        valScale.innerText = settings.scale;

        // Actualizar maderas/colores en el panel experto
        syncExpertPanelUI(settings);

        // Reconstruir y pintar modelo 3D
        updateMaterials();
        rebuildGuitar();
    });

    // Escuchar evento para sincronizar controles del modo experto
    document.addEventListener('syncExpertControls', () => {
        // Asegurar que las etiquetas y spans coincidan
        valLength.innerText = sliderLength.value;
        valWidth.innerText = sliderWidth.value;
        valThickness.innerText = sliderThickness.value;
        valScale.innerText = sliderScale.value;
        
        // Sincronizar spans de resumen
        const woodLabel = document.querySelector(`[data-wood="${currentWood}"]`)?.innerText.trim() || currentWood;
        const colorLabel = document.querySelector(`[data-color="${currentColor}"]`)?.innerText.trim() || currentColor;
        const hwLabel = document.querySelector(`[data-hardware="${currentHardware}"]`)?.innerText.trim() || currentHardware;
        const pkLabel = document.querySelector(`[data-pickups="${currentPickups}"]`)?.innerText.trim() || currentPickups;

        sumMadera.innerText = woodLabel;
        sumColor.innerText = colorLabel;
        sumHardware.innerText = hwLabel;
        sumPickups.innerText = pkLabel;
        sumCad.innerText = `${sliderLength.value} x ${sliderWidth.value} x ${sliderThickness.value} mm (Escala: ${sliderScale.value}mm)`;
    });

    // Función auxiliar para marcar activos los botones estéticos del panel experto
    function syncExpertPanelUI(settings) {
        // Madera
        document.querySelectorAll('[data-wood]').forEach(x => {
            x.classList.toggle('active', x.getAttribute('data-wood') === settings.wood);
        });
        // Color
        document.querySelectorAll('[data-color]').forEach(x => {
            x.classList.toggle('active', x.getAttribute('data-color') === settings.color);
        });
        // Herrajes
        document.querySelectorAll('[data-hardware]').forEach(x => {
            x.classList.toggle('active', x.getAttribute('data-hardware') === settings.hardware);
        });
        // Pastillas
        document.querySelectorAll('[data-pickups]').forEach(x => {
            x.classList.toggle('active', x.getAttribute('data-pickups') === settings.pickups);
        });
    }
});
