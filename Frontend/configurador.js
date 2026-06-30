// === CONFIGURADOR 3D INTERACTIVO Y PARAMÉTRICO DE GUITARRAS ===

document.addEventListener("DOMContentLoaded", () => {

    // ── 1. PARÁMETROS URL Y ELEMENTOS DOM ─────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const modeloId  = urlParams.get('modelo') || 'Strat';
    const modoId    = urlParams.get('modo') || 'experto'; // 'asistido' o 'experto'

    const container = document.getElementById('guitar-preview-container');
    const canvas    = document.getElementById('guitar-preview-canvas');

    // Sliders CAD
    const sliderLength    = document.getElementById('bodyLength');
    const sliderWidth     = document.getElementById('bodyWidth');
    const sliderThickness = document.getElementById('bodyThickness');
    const sliderScale     = document.getElementById('scaleLength');

    // Spans de valor
    const valLength    = document.getElementById('val-bodyLength');
    const valWidth     = document.getElementById('val-bodyWidth');
    const valThickness = document.getElementById('val-bodyThickness');
    const valScale     = document.getElementById('val-scaleLength');

    // Spans de resumen
    const sumMadera  = document.getElementById('sum-madera');
    const sumColor   = document.getElementById('sum-color');
    const sumHardware= document.getElementById('sum-hardware');
    const sumPickups = document.getElementById('sum-pickups');
    const sumCad     = document.getElementById('sum-cad');

    // Botones Toolbar
    const btnReset     = document.getElementById('btn-reset-cam');
    const btnWireframe = document.getElementById('btn-toggle-wireframe');
    const btnGrid      = document.getElementById('btn-toggle-grid');
    const btnAxes      = document.getElementById('btn-toggle-axes');
    const btnExport    = document.getElementById('btn-export-cad');

    // Inicializar labels de sliders con sus valores por defecto
    if (valLength    && sliderLength)    valLength.innerText    = sliderLength.value;
    if (valWidth     && sliderWidth)     valWidth.innerText     = sliderWidth.value;
    if (valThickness && sliderThickness) valThickness.innerText = sliderThickness.value;
    if (valScale     && sliderScale)     valScale.innerText     = sliderScale.value;

    // ── 2. ESCENA THREE.JS ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0.5, 7.5);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance   = 3;
    controls.maxDistance   = 12;
    controls.target.set(0, 0.8, 0);
    controls.update();

    // ── 3. HELPERS ─────────────────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(10, 20, 0x5c3a21, 0xd1c4b9);
    gridHelper.position.y = -1.8;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.set(-2, -1.5, 0);
    axesHelper.visible = false;
    scene.add(axesHelper);

    // ── 4. LUCES ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(5, 10, 7);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.set(1024, 1024);
    dirLight1.shadow.bias = -0.001;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffeedd, 0.4);
    dirLight2.position.set(-5, 5, -5);
    scene.add(dirLight2);

    const spotLight = new THREE.SpotLight(0xffffff, 0.6);
    spotLight.position.set(0, 4, 6);
    spotLight.angle    = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    // ── 5. GRUPO DE LA GUITARRA ────────────────────────────────────────────────
    const guitarGroup = new THREE.Group();
    scene.add(guitarGroup);

    // ── 6. ESTADO INICIAL ──────────────────────────────────────────────────────
    let currentWood     = 'caoba';
    let currentColor    = 'cherry';
    let currentHardware = 'chrome';
    let currentPickups  = 'humbucker';
    let isWireframe     = false;
    let autoRotate      = true; 

    // Valores por defecto manipulables geométricamente
    let targetLength    = 440;
    let targetWidth     = 325;
    let targetThickness = 45;
    let targetScale     = 648;

    // ── 7. TABLAS DE MATERIALES ────────────────────────────────────────────────
    const woodMaterials = {
        caoba: { color: 0x5c3a21, roughness: 0.35, metalness: 0.1  },
        fresno:{ color: 0xe6d4c3, roughness: 0.45, metalness: 0.05 },
        arce:   { color: 0xfbf4eb, roughness: 0.3,  metalness: 0.05 }
    };

    const finishMaterials = {
        cherry:  { color: 0xb73225, roughness: 0.10, metalness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        natural: { color: null,     roughness: 0.30, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.10 },
        sunburst:{ color: 0xe07a1b, roughness: 0.08, metalness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.05 },
        negro:   { color: 0x1f1a18, roughness: 0.80, metalness: 0.20, clearcoat: 0.0, clearcoatRoughness: 0.20 },
        goldtop: { color: 0xd4af37, roughness: 0.15, metalness: 0.85, clearcoat: 0.9, clearcoatRoughness: 0.05 }
    };

    const metalMaterials = {
        chrome:{ color: 0xcccccc, metalness: 0.95, roughness: 0.05 },
        gold:  { color: 0xdaa520, metalness: 0.90, roughness: 0.08 },
        black: { color: 0x222222, metalness: 0.80, roughness: 0.20 }
    };

    // ── 8. OBJETOS DE MATERIAL ────────────────────────────────────────────────
    const bodyMaterialObj = new THREE.MeshPhysicalMaterial({
        color: 0xb73225, roughness: 0.1, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.05
    });
    const neckMaterialObj = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.35, metalness: 0.1 });
    const fretboardMaterialObj = new THREE.MeshStandardMaterial({ color: 0x351c15, roughness: 0.8 });
    const hardwareMaterialObj = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.05 });
    const plasticMaterialObj = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const stringMaterialObj = new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 });

    let bodyMesh, neckMesh, fretboardMesh, headstockMesh, bridgeMesh;
    let pickupMeshes = [], tunerMeshes = [], stringLines = [];

    // ── 10. RECONSTRUCCIÓN PARAMÉTRICA ─────────────────────────────────────────
    function rebuildGuitar() {
        [bodyMesh, neckMesh, fretboardMesh, headstockMesh, bridgeMesh].forEach(m => { if (m) guitarGroup.remove(m); });
        [...pickupMeshes, ...tunerMeshes, ...stringLines].forEach(m => guitarGroup.remove(m));
        pickupMeshes = []; tunerMeshes = []; stringLines = [];

        // Leer valores de los targets asignados por sliders o asistente
        const L = targetLength / 100;
        const W = targetWidth / 100;
        const T = targetThickness / 100;
        const S = targetScale / 100;

        const bodyShape = new THREE.Shape();

        if (modeloId.toLowerCase() === 'strat') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo( W/2,    -L/2,    W*0.50, -L*0.20);
            bodyShape.quadraticCurveTo( W*0.55,  L*0.10, W*0.35,  L*0.25);
            bodyShape.quadraticCurveTo( W*0.40,  L*0.35, W*0.23,  L*0.48);
            bodyShape.quadraticCurveTo( W*0.10,  L*0.40, W*0.05,  L*0.25);
            bodyShape.quadraticCurveTo( 0,       L*0.30,-W*0.05,  L*0.25);
            bodyShape.quadraticCurveTo(-W*0.10,  L*0.40,-W*0.23,  L*0.48);
            bodyShape.quadraticCurveTo(-W*0.40,  L*0.35,-W*0.35,  L*0.25);
            bodyShape.quadraticCurveTo(-W*0.55,  L*0.10,-W*0.50, -L*0.20);
            bodyShape.quadraticCurveTo(-W/2,    -L/2,    0,       -L/2);
        } else if (modeloId.toLowerCase() === 'lespaul') {
            bodyShape.moveTo(0, -L/2);
            bodyShape.quadraticCurveTo( W*0.46, -L/2,    W*0.48, -L*0.25);
            bodyShape.quadraticCurveTo( W*0.48,  L*0.05, W*0.25,  L*0.13);
            bodyShape.quadraticCurveTo( W*0.33,  L*0.30, W*0.15,  L*0.45);
            bodyShape.quadraticCurveTo( 0,       L*0.44,-W*0.15,  L*0.45);
            bodyShape.quadraticCurveTo(-W*0.32,  L*0.32,-W*0.32,  L*0.18);
            bodyShape.quadraticCurveTo(-W*0.20,  L*0.08,-W*0.32, -0.05);
            bodyShape.quadraticCurveTo(-W*0.48, -L*0.25,-W*0.46, -L*0.25);
            bodyShape.quadraticCurveTo(-W*0.46, -L/2,    0,       -L/2);
        } else {
            // Flying V / Modelos angulares por defecto
            bodyShape.moveTo( 0,       L*0.42);
            bodyShape.lineTo(  W*0.46, -L*0.45);
            bodyShape.lineTo(  W*0.25, -L*0.48);
            bodyShape.lineTo(  0,      -L*0.12);
            bodyShape.lineTo( -W*0.25, -L*0.48);
            bodyShape.lineTo( -W*0.46, -L*0.45);
            bodyShape.lineTo(  0,       L*0.42);
        }

        const extrudeSettings = { depth: T, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
        const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
        bodyGeom.center();
        bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterialObj);
        bodyMesh.castShadow = bodyMesh.receiveShadow = true;
        guitarGroup.add(bodyMesh);

        // Mástil
        const neckLength = S * 0.45; const neckW = 0.16; const neckDepth = 0.08; const neckYPos = L / 2 + neckLength / 2 - 0.2;
        neckMesh = new THREE.Mesh(new THREE.BoxGeometry(neckW, neckLength, neckDepth), neckMaterialObj);
        neckMesh.position.set(0, neckYPos, T / 2);
        guitarGroup.add(neckMesh);

        // Diapasón
        fretboardMesh = new THREE.Mesh(new THREE.BoxGeometry(neckW - 0.01, neckLength - 0.05, 0.02), fretboardMaterialObj);
        fretboardMesh.position.set(0, neckYPos + 0.025, T / 2 + neckDepth / 2 + 0.01);
        guitarGroup.add(fretboardMesh);

        // Cabeza
        const headYPos = neckYPos + neckLength / 2 + 0.24;
        headstockMesh  = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.06), bodyMaterialObj);
        headstockMesh.position.set(0, headYPos, T / 2);
        guitarGroup.add(headstockMesh);

        // Clavijas (6 en línea para Strat, 3+3 para el resto)
        const pegGeom  = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8);
        const knobGeom = new THREE.BoxGeometry(0.04, 0.02, 0.03);
        const isSixInLine = (modeloId.toLowerCase() === 'strat');

        if (isSixInLine) {
            for (let i = 0; i < 6; i++) {
                const tg = new THREE.Group(); const peg = new THREE.Mesh(pegGeom, hardwareMaterialObj); peg.rotation.x = Math.PI / 2; tg.add(peg);
                const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj); knob.position.set(-0.06, 0, 0); tg.add(knob);
                tg.position.set(-0.14, headYPos - 0.2 + i * 0.07, T / 2); guitarGroup.add(tg); tunerMeshes.push(tg);
            }
        } else {
            for (const side of [-1, 1]) {
                for (let i = 0; i < 3; i++) {
                    const tg = new THREE.Group(); const peg = new THREE.Mesh(pegGeom, hardwareMaterialObj); peg.rotation.x = Math.PI / 2; tg.add(peg);
                    const knob = new THREE.Mesh(knobGeom, hardwareMaterialObj); knob.position.set(0.06 * side, 0, 0); tg.add(knob);
                    tg.position.set(0.14 * side, headYPos - 0.12 + i * 0.1, T / 2); guitarGroup.add(tg); tunerMeshes.push(tg);
                }
            }
        }

        // Puente y Pastillas
        const bridgeYPos = -L / 4 - 0.1;
        bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), hardwareMaterialObj);
        bridgeMesh.position.set(0, bridgeYPos, T / 2 + 0.03);
        guitarGroup.add(bridgeMesh);

        const isTriple = (modeloId.toLowerCase() === 'strat' && currentPickups === 'singlecoil');
        const pickupH = isTriple ? 0.08 : 0.14;
        const pickupGeom = new THREE.BoxGeometry(0.24, pickupH, 0.05);
        const pickupOffsets = isTriple ? [bridgeYPos + 0.35, bridgeYPos + 0.70, bridgeYPos + 1.05] : [bridgeYPos + 0.45, bridgeYPos + 0.95];

        pickupOffsets.forEach(yOff => {
            const ringMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, pickupH + 0.03, 0.06), plasticMaterialObj);
            ringMesh.position.set(0, yOff, T / 2 + 0.02); guitarGroup.add(ringMesh); pickupMeshes.push(ringMesh);

            const coreMaterial = (currentPickups === 'humbucker') ? plasticMaterialObj : hardwareMaterialObj;
            const coreMesh = new THREE.Mesh(pickupGeom, coreMaterial);
            coreMesh.position.set(0, yOff, T / 2 + 0.03); guitarGroup.add(coreMesh); pickupMeshes.push(coreMesh);
        });

        // Cuerdas
        const startZ = T / 2 + 0.05; const stringStartXs = [-0.08, -0.05, -0.02, 0.01, 0.04, 0.07];
        stringStartXs.forEach((sx, idx) => {
            const points = []; points.push(new THREE.Vector3(sx, bridgeYPos, startZ));
            let endX = isSixInLine ? sx * 0.7 : (idx < 3 ? -0.08 : 0.08);
            let endY = isSixInLine ? headYPos - 0.1 + idx * 0.05 : (idx < 3 ? headYPos - 0.1 + idx * 0.08 : headYPos - 0.1 + (idx - 3) * 0.08);
            points.push(new THREE.Vector3(endX, endY, T / 2 + 0.04));
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), stringMaterialObj);
            guitarGroup.add(line); stringLines.push(line);
        });

        if (sumCad) sumCad.innerText = `${targetLength} × ${targetWidth} × ${targetThickness} mm (Escala: ${targetScale} mm)`;
    }

    // ── 11. ACTUALIZAR MATERIALES ──────────────────────────────────────────────
    function updateMaterials() {
        const woodConf   = woodMaterials[currentWood]   || woodMaterials.caoba;
        const finishConf = finishMaterials[currentColor] || finishMaterials.cherry;
        const metalConf  = metalMaterials[currentHardware] || metalMaterials.chrome;

        neckMaterialObj.color.setHex(woodConf.color);
        if (currentColor === 'natural') {
            bodyMaterialObj.color.setHex(woodConf.color);
            bodyMaterialObj.clearcoat = 0.5;
        } else {
            bodyMaterialObj.color.setHex(finishConf.color);
            bodyMaterialObj.clearcoat = finishConf.clearcoat;
        }

        hardwareMaterialObj.color.setHex(metalConf.color);
        hardwareMaterialObj.metalness = metalConf.metalness;
        plasticMaterialObj.color.setHex(currentHardware === 'black' ? 0x0a0a0a : 0x1a1a1a);

        [bodyMaterialObj, neckMaterialObj, fretboardMaterialObj, hardwareMaterialObj, plasticMaterialObj].forEach(m => {
            m.wireframe = isWireframe; m.needsUpdate = true;
        });

        // Sincronizar etiquetas de resumen informativas
        if (sumMadera) sumMadera.innerText = currentWood.toUpperCase();
        if (sumColor) sumColor.innerText = currentColor.toUpperCase();
        if (sumHardware) sumHardware.innerText = currentHardware.toUpperCase();
        if (sumPickups) sumPickups.innerText = currentPickups.toUpperCase();
    }

// ── 12. CONTROL DE VISTAS ESTRICTO (ASISTENTE VS EXPERTO) ──────────────────
    const panelAsistido = document.getElementById('panel-asistido');
    const panelExperto  = document.getElementById('panel-experto');

    // Ocultar por completo la barra selectora superior para cumplir el aislamiento estricto
    const selectorModos = document.querySelector('.user-mode-selector');
    if (selectorModos) {
        selectorModos.style.display = 'none';
    }

    if (modoId === 'asistido') {
        if (panelAsistido) panelAsistido.style.display = 'block';
        if (panelExperto)  panelExperto.style.display = 'none';
        inicializarLogicaWizardReal();
    } else {
        if (panelExperto)  panelExperto.style.display = 'block';
        if (panelAsistido) panelAsistido.style.display = 'none';
        inicializarLogicaExperto();
    }

    // Inicialización geométrica por defecto
    if (modoId !== 'asistido') {
        actualizarValoresDesdeSliders();
        updateMaterials();
        rebuildGuitar();
    }

    function actualizarValoresDesdeSliders() {
        if (!sliderLength) return;
        targetLength    = parseFloat(sliderLength.value);
        targetWidth     = parseFloat(sliderWidth.value);
        targetThickness = parseFloat(sliderThickness.value);
        targetScale     = parseFloat(sliderScale.value);
    }

    // ── 13. LÓGICA DE INTERACCIÓN MODO EXPERTO (DISEÑO LIBRE) ──────────────────
    function inicializarLogicaExperto() {
        // Escuchar inputs en sliders manuales
        if (sliderLength) {
            [sliderLength, sliderWidth, sliderThickness, sliderScale].forEach(sl => {
                if (sl) sl.addEventListener('input', () => {
                    actualizarValoresDesdeSliders();
                    rebuildGuitar();
                });
            });
        }

        // Escuchar clics en las opciones estéticas (Maderas, Colores, Metales, Pastillas)
        document.querySelectorAll('.option-swatch').forEach(swatch => {
            swatch.addEventListener('click', function() {
                // Desmarcar hermanos del mismo contenedor y activar este
                this.parentElement.querySelectorAll('.option-swatch').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Leer qué propiedad se ha clickeado
                if (this.hasAttribute('data-wood'))     currentWood     = this.getAttribute('data-wood');
                if (this.hasAttribute('data-color'))    currentColor    = this.getAttribute('data-color');
                if (this.hasAttribute('data-hardware')) currentHardware = this.getAttribute('data-hardware');
                if (this.hasAttribute('data-pickups'))  currentPickups  = this.getAttribute('data-pickups');

                updateMaterials();
                rebuildGuitar();
            });
        });
    }

    // ── 14. LÓGICA DE INTERACCIÓN MODO ASISTENTE (WIZARD REAL) ─────────────────

    // ── 14. LÓGICA DE INTERACCIÓN MODO ASISTENTE (WIZARD REAL CON NAVEGACIÓN) ─
    function inicializarLogicaWizardReal() {
        let pasoActual = 1;
        const totalPasos = 4;

        // Forzar sincronización inicial con los valores por defecto
        const settingsIniciales = elWizardSugeriráValores();
        aplicarAjustesAsistidosAlModelo(settingsIniciales);

        // A. Capturar elementos de navegación del HTML (CORREGIDO ID DE PROGRESSBAR)
        const btnNextWiz = document.getElementById('wiz-next-btn');
        const btnPrevWiz = document.getElementById('wiz-prev-btn');
        const progressBar = document.getElementById('wiz-progress'); // <--- ID corregido aquí

        // B. Escuchar clics nativos en las tarjetas de selección
        document.querySelectorAll('.wizard-card').forEach(card => {
            card.addEventListener('click', () => {
                // Cambiar clase activa visualmente en el HTML dentro del mismo paso
                const stepElement = card.closest('.wizard-step');
                if (stepElement) {
                    stepElement.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected'));
                }
                card.classList.add('selected');

                // Leer qué opciones están seleccionadas en todo el formulario actualmente
                const activeSound = document.querySelector('[data-wiz-sound].selected')?.getAttribute('data-wiz-sound') || 'heavy';
                const activeFeel  = document.querySelector('[data-wiz-feel].selected')?.getAttribute('data-wiz-feel') || 'light';
                const activeLook  = document.querySelector('[data-wiz-look].selected')?.getAttribute('data-wiz-look') || 'classic';

                // Modificar el lienzo tridimensional en tiempo real
                const nuevasPropiedades = elWizardSugeriráValores(activeSound, activeFeel, activeLook);
                aplicarAjustesAsistidosAlModelo(nuevasPropiedades);
            });
        });

        // C. Lógica del Botón "Siguiente / Continuar" (Navegación de Pantallas)
        if (btnNextWiz) {
            btnNextWiz.addEventListener('click', () => {
                if (pasoActual < totalPasos) {
                    // Ocultar paso actual
                    const pasoActualEl = document.querySelector(`.wizard-step[data-step="${pasoActual}"]`);
                    if (pasoActualEl) pasoActualEl.style.display = 'none';

                    // Avanzar e indexar el siguiente paso
                    pasoActual++;

                    // Mostrar nuevo paso
                    const siguientePasoEl = document.querySelector(`.wizard-step[data-step="${pasoActual}"]`);
                    if (siguientePasoEl) siguientePasoEl.style.display = 'block';

                    // Mostrar botón "Atrás" si ya salimos del primer paso
                    if (btnPrevWiz) btnPrevWiz.style.display = 'inline-block';

                    // Actualizar barra de progreso visual (CORREGIDO: Ahora sí avanzará)
                    if (progressBar) {
                        progressBar.style.width = `${(pasoActual / totalPasos) * 100}%`;
                    }

                    // Si llegamos al último paso (Formulario de cotización), ocultamos el botón de avanzar
                    if (pasoActual === totalPasos) {
                        btnNextWiz.style.display = 'none';
                    }

                    // Recalcular y pintar el estado actual por seguridad y actualizar el resumen textual del paso 4
                    const activeSound = document.querySelector('[data-wiz-sound].selected')?.getAttribute('data-wiz-sound') || 'heavy';
                    const activeFeel  = document.querySelector('[data-wiz-feel].selected')?.getAttribute('data-wiz-feel') || 'light';
                    const activeLook  = document.querySelector('[data-wiz-look].selected')?.getAttribute('data-wiz-look') || 'classic';
                    
                    const propiedadesActuales = elWizardSugeriráValores(activeSound, activeFeel, activeLook);
                    aplicarAjustesAsistidosAlModelo(propiedadesActuales);
                    
                    // Actualizar dinámicamente las etiquetas de texto del paso 4 (Resumen)
                    const maderasNombres = { heavy: 'Caoba', bright: 'Fresno', balanced: 'Arce' };
                    const pkNombres = { heavy: 'Humbucker', bright: 'Single Coil', balanced: 'Humbucker' };
                    const coloresNombres = {
                        classic: (activeSound === 'bright' ? 'Sunburst' : 'Rojo Cereza'),
                        modern: (activeSound === 'heavy' ? 'Negro Mate' : 'Oro Vintage')
                    };
                    const hwNombres = {
                        classic: 'Cromo',
                        modern: (activeSound === 'heavy' ? 'Negro Obsidian' : 'Oro')
                    };

                    if(document.getElementById('wiz-sum-madera'))   document.getElementById('wiz-sum-madera').innerText = maderasNombres[activeSound];
                    if(document.getElementById('wiz-sum-color'))    document.getElementById('wiz-sum-color').innerText = coloresNombres[activeLook];
                    if(document.getElementById('wiz-sum-hardware')) document.getElementById('wiz-sum-hardware').innerText = hwNombres[activeLook];
                    if(document.getElementById('wiz-sum-pickups'))  document.getElementById('wiz-sum-pickups').innerText = pkNombres[activeSound];
                    if(document.getElementById('wiz-sum-cad'))      document.getElementById('wiz-sum-cad').innerText = `${propiedadesActuales.length}x${propiedadesActuales.width}x${propiedadesActuales.thickness}mm`;
                    
                    if(document.getElementById('wiz-colloquial-summary')) {
                        document.getElementById('wiz-colloquial-summary').innerText = `Configuración sugerida basada en tu perfil: Una guitarra con cuerpo de ${maderasNombres[activeSound]} para una respuesta acústica ideal, dimensiones optimizadas para un tacto ${activeFeel === 'light' ? 'ligero y rápido' : activeFeel === 'heavy' ? 'robusto con sustain' : 'equilibrado'}, y una estética de acabado ${coloresNombres[activeLook]}.`;
                    }
                }
            });
        }

        // D. Lógica del Botón "Atrás"
        if (btnPrevWiz) {
            btnPrevWiz.addEventListener('click', () => {
                if (pasoActual > 1) {
                    // Ocultar paso actual
                    const pasoActualEl = document.querySelector(`.wizard-step[data-step="${pasoActual}"]`);
                    if (pasoActualEl) pasoActualEl.style.display = 'none';

                    // Retroceder un índice
                    pasoActual--;

                    // Mostrar paso anterior
                    const anteriorPasoEl = document.querySelector(`.wizard-step[data-step="${pasoActual}"]`);
                    if (anteriorPasoEl) anteriorPasoEl.style.display = 'block';

                    // Volver a asegurar que el botón Siguiente sea visible si volvimos atrás
                    if (btnNextWiz) btnNextWiz.style.display = 'inline-block';

                    // Ocultar "Atrás" si regresamos a la primera pantalla
                    if (pasoActual === 1) {
                        btnPrevWiz.style.display = 'none';
                    }

                    // Actualizar barra de progreso al retroceder
                    if (progressBar) {
                        progressBar.style.width = `${(pasoActual / totalPasos) * 100}%`;
                    }
                }
            });
        }
    }
    // Mapeo lógico idéntico al HTML para traducir las elecciones asistidas a física CAD y 3D
    function elWizardSugeriráValores(sonido = 'heavy', ergonomia = 'light', look = 'classic') {
        const resultado = {
            wood: 'caoba', pickups: 'humbucker', length: 360, width: 280, thickness: 40, scale: 648, color: 'cherry', hardware: 'chrome'
        };

        if (sonido === 'heavy')       { resultado.wood = 'caoba';  resultado.pickups = 'humbucker'; } 
        else if (sonido === 'bright')  { resultado.wood = 'fresno'; resultado.pickups = 'singlecoil'; } 
        else if (sonido === 'balanced'){ resultado.wood = 'arce';   resultado.pickups = 'humbucker'; }

        if (ergonomia === 'light')     { resultado.length = 330; resultado.width = 240; resultado.thickness = 32; resultado.scale = 610; } 
        else if (ergonomia === 'heavy') { resultado.length = 400; resultado.width = 300; resultado.thickness = 48; resultado.scale = 650; } 
        else if (ergonomia === 'standard') { resultado.length = 360; resultado.width = 280; resultado.thickness = 40; resultado.scale = 648; }

        if (look === 'classic') {
            resultado.color = (sonido === 'bright') ? 'sunburst' : 'cherry';
            resultado.hardware = 'chrome';
        } else if (look === 'modern') {
            resultado.color = (sonido === 'heavy') ? 'negro' : 'goldtop';
            resultado.hardware = (sonido === 'heavy') ? 'black' : 'gold';
        }

        return resultado;
    }

    function aplicarAjustesAsistidosAlModelo(props) {
        // Asignar a variables globales de control tridimensional
        currentWood     = props.wood;
        currentColor    = props.color;
        currentHardware = props.hardware;
        currentPickups  = props.pickups;
        targetLength    = props.length;
        targetWidth     = props.width;
        targetThickness = props.thickness;
        targetScale     = props.scale;

        // Forzar actualización inmediata en el Canvas 3D
        updateMaterials();
        rebuildGuitar();
    }

    // ── 15. LOOP DE ANIMACIÓN & RESIZE ─────────────────────────────────────────
    controls.addEventListener('start', () => { autoRotate = false; });

    function animate() {
        requestAnimationFrame(animate);
        if (autoRotate) guitarGroup.rotation.y += 0.003;
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
    window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// =====================================
// BOTÓN COTIZAR
// =====================================

const btnCotizar = document.getElementById("btn-enviar");

if (btnCotizar) {

    btnCotizar.addEventListener("click", async () => {

        try {

            btnCotizar.disabled = true;
            btnCotizar.textContent = "Calculando...";

            const response = await fetch("http://localhost:5000/cotizar");

            const data = await response.json();

            document.getElementById("precio-final").textContent =
                `$${data.precio_final_cop.toLocaleString("es-CO")} COP`;

            document
                .getElementById("modal-cotizacion")
                .classList.add("active");

        } catch (error) {

            console.error(error);

            alert("No fue posible generar la cotización.");

        } finally {

            btnCotizar.disabled = false;
            btnCotizar.textContent = "Cotizar mi guitarra";

        }

    });

}

// =====================================
// MODALES
// =====================================

const btnComprar = document.getElementById("btn-comprar");
const btnCancelar = document.getElementById("btn-cancelar");
const btnCancelarCompra = document.getElementById("btn-cancelar-compra");

if (btnComprar) {

    btnComprar.addEventListener("click", () => {

        document
            .getElementById("modal-cotizacion")
            .classList.remove("active");

        document
            .getElementById("modal-compra")
            .classList.add("active");

    });

}

if (btnCancelar) {

    btnCancelar.addEventListener("click", () => {

        document
            .getElementById("modal-cotizacion")
            .classList.remove("active");

    });

}

if (btnCancelarCompra) {

    btnCancelarCompra.addEventListener("click", () => {

        document
            .getElementById("modal-compra")
            .classList.remove("active");

    });

}
document.addEventListener('DOMContentLoaded', () => {
    const btnVer3D = document.getElementById('btnVer3D');
    const contenedor3D = document.getElementById('contenedor3D');
    const visorBajo = document.getElementById('visorBajo');
    const btnCotizar = document.getElementById('btnCotizarFase2');

    btnVer3D.addEventListener('click', function() {
        // 1. Deshabilitar el botón temporalmente para evitar múltiples clics
        this.disabled = true;
        this.textContent = 'Cargando modelo interactivo...';

        // 2. Obtener la ruta del .glb según lo que configuró el usuario
        // Aquí llamarías a tu función que determina qué archivo cargar
        const rutaArchivoGLB = obtenerRutaDelGLBGenerado(); 

        // 3. Asignar el archivo al visor
        visorBajo.src = rutaArchivoGLB;

        // 4. Mostrar el contenedor del visor
        contenedor3D.style.display = 'block';

        // Opcional: Escuchar el evento de carga completa de Khronos/model-viewer
        visorBajo.addEventListener('load', () => {
             btnVer3D.style.display = 'none'; // Ocultamos el botón de ver 3D
             btnCotizar.style.display = 'block'; // Mostramos el botón de cotizar real
        });
    });
});

// Función simulada: Aquí debes poner tu lógica para saber qué modelo cargar
function obtenerRutaDelGLBGenerado() {
    // Ejemplo: Si el usuario eligió Nogal Rojo Tamaño 1/4
    return 'assets/modelos_3d/stingray_nogal_rojo_1_4.glb'; 
}
});
