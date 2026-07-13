// ===================================================
// CALCULADOR DE PRECIOS - CONFIGURADOR DE GUITARRAS
// ===================================================

const PRECIOS = {
    modelo: {
        'Strat': 500000,
        'LesPaul': 600000,
        'V-Agresiva': 550000
    },
    madera: {
        'caoba': 150000,
        'palisandro': 200000,
        'alamo': 100000,
        'cedro': 120000
    },
    clavijero: {
        'cromatico': 80000,
        'vintage': 120000,
        'hiperbolico': 180000,
        'moderno': 150000
    },
    color: {
        'negro': 45000,
        'blanco': 35000,
        'rojo': 50000,
        'azul': 48000,
        'natural': 25000,
        'sunburst': 60000
    },
    pastillas: {
        '1': 200000,
        '2': 350000,
        '3': 500000
    },
    nobs: {
        '2': 80000,
        '3': 120000,
        '4': 150000
    },
    trastes: {
        'nickel': 90000,
        'jumbo': 140000,
        'stainless': 130000
    },
    puente: {
        'fijo': 120000,
        'tremolo': 200000,
        'floyd': 350000
    }
};

const PORCENTAJE_PLUSVALIA = 0.30; // 30% de ganancia

/**
 * Verifica si todos los componentes están seleccionados
 * @returns {boolean} - true si todos están seleccionados
 */
function todosComponentesSeleccionados() {
    const selects = ['tipo-madera', 'clavijero', 'color', 'pastillas', 'nobs', 'trastes', 'puente'];
    return selects.every(id => {
        const element = document.getElementById(id);
        return element && element.value; // Debe tener un valor seleccionado
    });
}

/**
 * Calcula el costo total de materiales
 * - Si NO están todos seleccionados: retorna 0
 * - Si están TODOS seleccionados: suma modelo base + todos los componentes
 * @returns {number} - Costo total
 */
function calcularCostoMateriales() {
    // Si no están todos seleccionados, retorna 0
    if (!todosComponentesSeleccionados()) {
        console.log('⚠️ No todos los componentes están seleccionados. Retornando $0');
        return 0;
    }

    let total = 0;

    // Precio base del modelo
    const modeloElement = document.getElementById('modelo-titulo');
    const modelo = modeloElement ? modeloElement.innerText.split(': ')[1] : 'Strat';
    const precioModelo = PRECIOS.modelo[modelo] || 500000;
    total += precioModelo;
    console.log(`Modelo ${modelo}: $${precioModelo}`);

    // Mapeo de IDs a categorías
    const mapeo = {
        'tipo-madera': 'madera',
        'clavijero': 'clavijero',
        'color': 'color',
        'pastillas': 'pastillas',
        'nobs': 'nobs',
        'trastes': 'trastes',
        'puente': 'puente'
    };

    // Agregar componentes (ahora sí todos están seleccionados)
    for (const [id, categoria] of Object.entries(mapeo)) {
        const element = document.getElementById(id);
        if (element && element.value) {
            const valor = element.value; // Obtiene la clave (ej: 'caoba')
            const precio = PRECIOS[categoria][valor] || 0;
            total += precio;
            console.log(`${id} (${valor}): $${precio}`);
        }
    }

    console.log(`🎸 COSTO TOTAL DE MATERIALES: $${total}`);
    return total;
}

/**
 * Formatea un número como moneda colombiana
 * @param {number} num - Número a formatear
 * @returns {string} - Número formateado
 */
function formatearMoneda(num) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

/**
 * Actualiza el resumen de precios en la pantalla
 */
function actualizarResumenPrecios() {
    const costoMateriales = calcularCostoMateriales();
    const plusvalia = Math.round(costoMateriales * PORCENTAJE_PLUSVALIA);
    const precioFinal = costoMateriales + plusvalia;

    // Debug en consola
    console.log('=== ACTUALIZACIÓN DE PRECIOS ===');
    console.log('Costo Materiales: $' + costoMateriales);
    console.log('Plusvalía (30%): $' + plusvalia);
    console.log('Precio Final: $' + precioFinal);

    // Actualizar DOM
    const precioMaterialesEl = document.getElementById('precio-materiales');
    const precioTrabajoEl = document.getElementById('precio-trabajo');
    const precioFinalEl = document.getElementById('precio-final');

    if (precioMaterialesEl) precioMaterialesEl.innerText = formatearMoneda(costoMateriales);
    if (precioTrabajoEl) precioTrabajoEl.innerText = formatearMoneda(plusvalia);
    if (precioFinalEl) precioFinalEl.innerText = formatearMoneda(precioFinal);

    // Guardar en localStorage
    localStorage.setItem('costoMateriales', costoMateriales);
    localStorage.setItem('plusvalia', plusvalia);
    localStorage.setItem('precioFinal', precioFinal);
}

/**
 * Obtiene un resumen de los componentes seleccionados
 * @returns {object} - Objeto con todos los datos seleccionados
 */
function obtenerConfiguracionSeleccionada() {
    return {
        modelo: document.getElementById('modelo-titulo').innerText.split(': ')[1],
        madera: document.getElementById('tipo-madera').options[document.getElementById('tipo-madera').selectedIndex].text,
        clavijero: document.getElementById('clavijero').options[document.getElementById('clavijero').selectedIndex].text,
        color: document.getElementById('color').options[document.getElementById('color').selectedIndex].text,
        pastillas: document.getElementById('pastillas').options[document.getElementById('pastillas').selectedIndex].text,
        nobs: document.getElementById('nobs').options[document.getElementById('nobs').selectedIndex].text,
        trastes: document.getElementById('trastes').options[document.getElementById('trastes').selectedIndex].text,
        puente: document.getElementById('puente').options[document.getElementById('puente').selectedIndex].text,
        costoMateriales: parseInt(localStorage.getItem('costoMateriales')) || 0,
        plusvalia: parseInt(localStorage.getItem('plusvalia')) || 0,
        precioFinal: parseInt(localStorage.getItem('precioFinal')) || 0
    };
}

/**
 * Inicializa el calculador
 * Agrega listeners a todos los selects
 */
function inicializarCalculador() {
    const selects = ['tipo-madera', 'clavijero', 'color', 'pastillas', 'nobs', 'trastes', 'puente'];
    
    selects.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                console.log(`📍 Cambio detectado en: ${id}`);
                actualizarResumenPrecios();
            });
        }
    });

    console.log('✅ Calculador inicializado');
    // Calcular inicial
    actualizarResumenPrecios();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCalculador);
} else {
    inicializarCalculador();
}
