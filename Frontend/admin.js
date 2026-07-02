// ============================================================
// ============================================================
// Panel Administrativo - Ctrl+Rock
// ============================================================

// Evitar CORS/timeouts usando IP loopback explícita
const API_BASE = "http://127.0.0.1:5000";
// Token de acceso al panel admin (cambiar en producción)
const ADMIN_TOKEN = "admin123";

async function cargarPedidos() {
    const listaDiv = document.getElementById("pedidos-list");
    listaDiv.innerHTML = '<div class="loading">Cargando pedidos...</div>';

    try {
        const response = await fetchWithTimeout(`${API_BASE}/api/admin/pedidos?token=${ADMIN_TOKEN}`, 15000);
        
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Respuesta no JSON:", text);
            throw new Error(`El backend devolvió HTML en vez de JSON (HTTP ${response.status}). Verifica que el backend esté corriendo en http://localhost:5000 y que la ruta /api/admin/pedidos exista.`);
        }

        if (response.status === 401 || response.status === 403) {
            const errorData = await response.json();
            throw new Error(`⚠️ Acceso denegado: ${errorData.error || 'Token inválido'}`);
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const pedidos = data.pedidos || [];

        // Actualizar estadísticas
        actualizarEstadisticas(pedidos);

        // Renderizar pedidos
        if (pedidos.length === 0) {
            listaDiv.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">No hay pedidos registrados aún</p>';
            return;
        }

        listaDiv.innerHTML = pedidos.map(pedido => generarHTMLPedido(pedido)).join("");

        // Agregar event listeners a los botones de detalles
        document.querySelectorAll(".btn-ver-detalles").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pedidoId = e.target.dataset.pedidoId;
                toggleDetalles(pedidoId);
            });
        });

        // Agregar event listeners a los botones de sincronizacion
        document.querySelectorAll(".btn-sincronizar").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const pid = e.target.dataset.paymentIntentId;
                sincronizarPedido(pid, e.target);
            });
        });

    } catch (error) {
        console.error("Error cargando pedidos:", error);
        listaDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Función auxiliar para fetch con timeout
async function fetchWithTimeout(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Tiempo de espera agotado. Verifica que el backend esté corriendo.');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}


function actualizarEstadisticas(pedidos) {
    const totalPedidos = pedidos.length;
    const totalIngresos = pedidos.reduce((acc, p) => acc + (p.total_cop || 0), 0);
    
    // Pedidos del mes actual
    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();
    const pedidosMes = pedidos.filter(p => {
        const fecha = new Date(p.fecha);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
    }).length;

    document.getElementById("total-pedidos").textContent = totalPedidos;
    document.getElementById("total-ingresos").textContent = `$${totalIngresos.toLocaleString('es-CO')}`;
    document.getElementById("pedidos-mes").textContent = pedidosMes;
}


function generarHTMLPedido(pedido) {
    const fecha = new Date(pedido.fecha).toLocaleString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const detalles = pedido.detalles || [];

    return `
        <div class="pedido-card">
            <div class="pedido-header">
                <div class="pedido-id">Pedido #${pedido.id}</div>
                ${(() => {
                    const estado = (pedido.estado || 'pagado').toLowerCase();
                    const clase = estado === 'reembolsado' ? 'reembolsado' :
                                  estado === 'disputed' || estado === 'disputa' ? 'disputado' :
                                  estado === 'fallido' || estado === 'error' ? 'error' :
                                  'pagado';
                    return `<span class="pedido-estado ${clase}">${pedido.estado || 'pagado'}</span>`;
                })()}
            </div>
            
            <div class="pedido-info">
                <div class="info-item">
                    <span class="info-label">Cliente</span>
                    <span class="info-value">${escapeHTML(pedido.nombre || '')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-value">${escapeHTML(pedido.email || '')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Teléfono</span>
                    <span class="info-value">${escapeHTML(pedido.telefono || 'N/A')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Dirección</span>
                    <span class="info-value">${escapeHTML(pedido.direccion || 'N/A')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Ciudad</span>
                    <span class="info-value">${escapeHTML(pedido.ciudad || 'N/A')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Fecha</span>
                    <span class="info-value">${fecha}</span>
                </div>
            </div>

            <div class="pedido-total">
                Total: $${(pedido.total_cop || 0).toLocaleString('es-CO')} COP
                ${pedido.reembolsado ? `<div class="reembolso-info">Reembolsado: $${(pedido.monto_reembolsado || 0).toLocaleString('es-CO')} COP</div>` : ''}
            </div>

            ${detalles.length > 0 ? `
                <button class="btn-ver-detalles" data-pedido-id="${pedido.id}">
                    Ver materiales (${detalles.length})
                </button>
                <div class="detalles-materiales" id="detalles-${pedido.id}">
                    ${detalles.map(detalle => generarHTMLDetalle(detalle)).join("")}
                </div>
            ` : '<p style="color:#999;font-style:italic;">Sin detalles de materiales</p>'}

            ${pedido.stripe_payment_intent_id ? `
                <button class="btn-sincronizar" data-payment-intent-id="${escapeHTML(pedido.stripe_payment_intent_id)}">
                    Sincronizar con Stripe
                </button>
            ` : ''}
        </div>
    `;
}


function generarHTMLDetalle(detalle) {
    return `
        <div class="material-item">
            <div class="material-info">
                <div class="material-componente">${capitalizeFirst(detalle.componente || '')}</div>
                <div class="material-nombre">${escapeHTML(detalle.nombre || '')}</div>
            </div>
            <div class="material-precios">
                ${detalle.precio_usd ? `<div class="material-precio-usd">$${detalle.precio_usd.toFixed(2)} USD</div>` : ''}
                <div class="material-precio-cop">$${detalle.precio_cop.toLocaleString('es-CO')} COP</div>
            </div>
            ${detalle.enlace ? `
                <a href="${escapeHTML(detalle.enlace)}" target="_blank" rel="noopener noreferrer" class="btn-amazon">
                    🛒 Amazon
                </a>
            ` : ''}
        </div>
    `;
}


function toggleDetalles(pedidoId) {
    const detallesDiv = document.getElementById(`detalles-${pedidoId}`);
    const btn = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
    
    if (detallesDiv) {
        const isActive = detallesDiv.classList.contains("active");
        detallesDiv.classList.toggle("active");
        btn.textContent = isActive 
            ? `Ver materiales` 
            : `Ocultar materiales`;
    }
}


function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}


function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function sincronizarPedido(paymentIntentId, btnElement) {
    const originalText = btnElement.textContent;
    btnElement.disabled = true;
    btnElement.textContent = "Sincronizando...";
    try {
        const response = await fetchWithTimeout(`${API_BASE}/api/admin/sincronizar-pedido/${encodeURIComponent(paymentIntentId)}?token=${ADMIN_TOKEN}`, 10000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.mensaje || "Error en sincronización");
        alert(`Sincronización exitosa: ${data.mensaje}`);
        cargarPedidos();
    } catch (error) {
        console.error("Error sincronizando pedido:", error);
        alert(`Error: ${error.message}`);
    } finally {
        btnElement.disabled = false;
        btnElement.textContent = originalText;
    }
}

async function cargarWebhookLogs() {
    const logsDiv = document.getElementById("webhook-logs-list");
    if (!logsDiv) return;
    logsDiv.innerHTML = '<div class="loading">Cargando logs de webhooks...</div>';
    try {
        const response = await fetchWithTimeout(`${API_BASE}/api/admin/webhook-logs?token=${ADMIN_TOKEN}&limit=50`, 10000);
        
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            const text = await response.text();
            console.error("Respuesta no JSON:", text);
            throw new Error(`El backend devolvió HTML en vez de JSON (HTTP ${response.status}). Verifica que el backend esté corriendo en http://localhost:5000 y que la ruta /api/admin/webhook-logs exista.`);
        }

        if (response.status === 401 || response.status === 403) {
            const errorData = await response.json();
            throw new Error(`⚠️ Acceso denegado: ${errorData.error || 'Token inválido'}`);
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const logs = data.logs || [];
        if (logs.length === 0) {
            logsDiv.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">No hay logs de webhooks registrados aún</p>';
            return;
        }
        logsDiv.innerHTML = logs.map(log => `
            <div style="background:white;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <strong>${escapeHTML(log.evento || '')}</strong>
                    <span style="color:#666;font-size:12px;">${log.recibido_en || ''}</span>
                </div>
                ${log.payment_intent_id ? `<div style="margin-top:4px;font-size:13px;">PaymentIntent: ${escapeHTML(log.payment_intent_id)}</div>` : ''}
            </div>
        `).join("");
    } catch (error) {
        console.error("Error cargando logs de webhook:", error);
        logsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

async function sincronizarTodos() {
    try {
        const response = await fetchWithTimeout(`${API_BASE}/api/admin/sincronizar-todos?token=${ADMIN_TOKEN}`, 30000);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error en sincronización");
        alert(`Sincronización completada: ${data.resumen.actualizados}/${data.resumen.total} pedidos actualizados`);
        cargarPedidos();
    } catch (error) {
        console.error("Error sincronizando todos los pedidos:", error);
        alert(`Error: ${error.message}`);
    }
}

// Cargar pedidos y logs al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
    cargarPedidos();
    cargarWebhookLogs();
});

// Exportar funciones para uso global si es necesario
window.cargarPedidos = cargarPedidos;
window.cargarWebhookLogs = cargarWebhookLogs;
