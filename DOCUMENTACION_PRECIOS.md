# Documentación: Cálculo de Precios - Ctrl+Rock

## Resumen Ejecutivo

El precio final de una guitarra personalizada en Ctrl+Rock se calcula mediante un solo flujo backend unificado. El sistema toma el costo de todas las partes (arbitrarias + hardware Amazon), agrega el costo de producción, y aplica un markup completo que incluye transporte, imprevistos, ganancia, comisión Stripe e IVA.

Todos los precios están centralizados en `Backend/precios.py`.

---

## 1. Componentes del Costo Base

### 1.1 Partes Arbitrarias (COP)

| Categoría | Opción | Precio COP | Fuente |
|-----------|--------|------------|--------|
| **Modelo** | lespaul | $600,000 | `precios.py` |
| | stratocaster | $500,000 | `precios.py` |
| | ibanezxp | $650,000 | `precios.py` |
| | stingray | $600,000 | `precios.py` |
| | ibanezrg | $700,000 | `precios.py` |
| | danelectro | $450,000 | `precios.py` |
| **Madera** | fresno | $0 (base) | `precios.py` |
| | caoba | $150,000 | `precios.py` |
| | nogal | $300,000 | `precios.py` |
| **Acabado** | cherry | $50,000 | `precios.py` |
| | natural | $25,000 | `precios.py` |
| | carbon | $45,000 | `precios.py` |
| **Picks** | rojo/amarillo/azul/rosado/morado | $5,000 c/u | `precios.py` |

### 1.2 Hardware (Amazon USD via ZenRows)

Componentes cuyo precio se obtiene desde Amazon mediante scraping. El costo total se suma globalmente (independiente de la selección del usuario).

| Componente | ASIN | Precio USD (default si falla scraping) |
|------------|------|--------------------------------------|
| Trastes | B003B0D4OU | $18.81 |
| Clavijeros | B08MQWZ2MD | $31.99 |
| Knobs | B0BLMWPDQ9 | $11.99 |
| Puente | B0FY5M9G97 | $34.99 |
| Pastillas Alnico | B0FZKM55QD | $40.37 |

**Conversión USD/COP:** Tasa dinámica desde exchangerate-api.com con fallback a 4,200 COP/USD.

### 1.3 Costo de Producción (COP)

Valor fijo que cubre mano de obra directa (2 empleados de carpintería y ensamble) y overhead de taller:

```
COSTO_PRODUCCION_COP = $350,000
```

---

## 2. Flujo de Cálculo Backend (Único y Oficial)

### 2.1 Ecuación Paso a Paso (Orden Correcto)

```
# 1. Costo de partes arbitrarias
costo_partes_arbitrarias = modelo + madera + acabado + picks

# 2. Costo de hardware (Amazon USD -> COP)
costo_hardware_cop = sum(precios_componentes_amazon) * tasa_cambio

# 3. Costo total de partes
costo_partes_totales = costo_partes_arbitrarias + costo_hardware_cop

# 4. Costo de fabricacion base (subtotal de costos)
subtotal_costos = costo_partes_totales + COSTO_PRODUCCION_COP

# 5. Margenes sobre subtotal de costos
transporte      = subtotal_costos * 0.05   (5%)
imprevistos     = subtotal_costos * 0.04   (4%)
ganancia_neta   = subtotal_costos * 0.18   (18%)

# 6. Subtotal con margenes
subtotal_con_margenes = subtotal_costos + transporte + imprevistos + ganancia_neta

# 7. IVA sobre subtotal con margenes
iva = subtotal_con_margenes * 0.19

# 8. Total con IVA (esto es lo que ve el cliente)
total_con_iva = subtotal_con_margenes + iva

# 9. Comision Stripe sobre total con IVA (Stripe cobra sobre lo cobrado al cliente)
comision_stripe = (total_con_iva * 0.029) + ($0.30 USD)

# 10. Precio final (lo que realmente se carga a la tarjeta)
precio_final = total_con_iva + comision_stripe
```

### 2.2 Desglose de Rubros

| Rubro | Porcentaje | Aplicado sobre | Descripción |
|-------|-----------|---------------|-------------|
| Partes y materiales | — | Costo directo | Modelo + madera + acabado + picks + hardware Amazon |
| Producción | — | Costo directo | Mano de obra (2 empleados) + taller |
| Transporte | 5% | Subtotal costos | Logística de envío |
| Imprevistos | 4% | Subtotal costos | Reserva para contingencias |
| Ganancia neta | 18% | Subtotal costos | Margen de rentabilidad |
| IVA | 19% | Subtotal con márgenes | Impuesto al valor agregado |
| Comisión Stripe | 2.9% + $0.30 USD | **Total con IVA** | Pasarela de pago (se cobra al final sobre el total) |

---

## 3. Flujo Frontend (Configurador)

El configurador envía al backend todas las selecciones del usuario vía POST a `/api/cotizar`. El backend devuelve:

```json
{
  "precio_final_cop": 4500000,
  "desglose_componentes": {
    "modelo": {"clave": "lespaul", "precio_cop": 600000},
    "madera": {"clave": "caoba", "precio_cop": 150000},
    "acabado": {"clave": "cherry", "precio_cop": 50000},
    "picks": {"clave": "rojo", "precio_cop": 5000}
  },
  "costo_hardware_usd": 137.16,
  "costo_hardware_cop": 576072,
  "costo_partes_totales_cop": 1381072,
  "costo_produccion_cop": 350000,
  "tasa_cambio_usd_cop": 4200,
  "desglose_hardware": { ... },
  "desglose_precios": {
    "costo_partes_totales": 1381072,
    "costo_produccion": 350000,
    "subtotal_costos": 1731072,
    "transporte": 86554,
    "imprevistos": 69243,
    "ganancia_neta": 311593,
    "subtotal_con_margenes": 2198462,
    "iva": 417708,
    "total_con_iva": 2616170,
    "comision_stripe_cop": 77129,
    "precio_final_cop": 2693299
  }
}
```

El frontend muestra el precio final y un desglose detallado en el modal de cotización.

---

## 4. Tasas y Factores Externos

### 4.1 Tasa de Cambio USD/COP
- **Fuente:** exchangerate-api.com (fallback: fxratesapi.com)
- **Caché:** 12 horas
- **Fallback:** 4,200 COP/USD si ambas APIs fallan

### 4.2 Precios de Componentes (Amazon)
- **Fuente:** Amazon.com vía ZenRows API
- **Caché:** 24 horas
- **Fallback:** Precios default actualizados según últimos valores scrapeados

---

## 5. Flujo de Pago (Stripe)

1. Usuario solicita cotización → backend calcula precio final con markup completo
2. Usuario ve precio final + desglose en modal
3. Usuario hace clic en "Comprar" → se crea PaymentIntent en Stripe por el monto exacto
4. Usuario ingresa datos de tarjeta y confirma
5. Backend verifica el pago, guarda pedido en BD, genera factura PDF y envía correo

---

## 6. Ejemplo Práctico de Cálculo

**Entrada:**
- Modelo: LesPaul ($600,000)
- Madera: Caoba ($150,000)
- Acabado: Cherry ($50,000)
- Picks: Rojo ($5,000)
- Hardware: ~$137.16 USD (5 componentes) → ~$576,072 COP (tasa 4,200)
- **Costo partes totales: $1,381,072 COP**
- **Subtotal costos (partes + producción): $1,731,072 COP**

**Cálculo (orden correcto):**
1. `transporte = 1,731,072 * 0.05 = $86,554`
2. `imprevistos = 1,731,072 * 0.04 = $69,243`
3. `ganancia_neta = 1,731,072 * 0.18 = $311,593`
4. `subtotal_con_margenes = 1,731,072 + 86,554 + 69,243 + 311,593 = $2,198,462`
5. `iva = 2,198,462 * 0.19 = $417,708`
6. `total_con_iva = 2,198,462 + 417,708 = $2,616,170`
7. `comision_stripe = (2,616,170 * 0.029) + (0.30 * 4,200) = $75,869 + $1,260 = $77,129`

**Precio Final:**
```
2,616,170 + 77,129 = $2,693,299 COP
```

---

## 7. Archivos del Sistema de Precios

| Archivo | Propósito |
|---------|-----------|
| `Backend/precios.py` | Diccionario centralizado de todos los precios y tasas |
| `Backend/app.py` | Endpoint `/api/cotizar` con la lógica de cálculo |
| `Backend/zenrows_scraper.py` | Scraping de precios Amazon + precios default |
| `Backend/exchange_rates.py` | Obtención de tasa de cambio USD/COP |
| `Frontend/configurador.js` | Envío de configuración y visualización de resultados |
| `Frontend/configurador.html` | Modal con desglose de precios |

---

## 8. Facturación e Impuestos

- **IVA:** 19% sobre (subtotal + comisión Stripe)
- **Documento:** PDF generado con ReportLab
- **Secuencia:** CTR-{YYYYMMDD}-{####}