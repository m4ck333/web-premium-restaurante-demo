/* ============================================================================
 * reserva-form.js - conexion del formulario estatico con la Edge Function
 * ----------------------------------------------------------------------------
 * Piloto A1. Reemplaza el action="#" (demo-mode) de la web de Brasa Norte /
 * Solaria Retreat por un POST real a la Edge Function crear-reserva.
 *
 * Fuente de verdad del contrato: architecture.md secciones 5.1-5.3.
 *
 * COMO INTEGRAR (resumen; detalle en frontend/README-integracion.md):
 *   1. Pega la anon key publica abajo (SUPABASE_ANON_KEY).
 *   2. Ajusta ORIGEN ('brasa-norte' o 'solaria-retreat') segun la web.
 *   3. Asegura que el <form> tiene el id/atributos que este JS espera
 *      (ver reserva-form.example.html).
 *   4. Carga este script con <script src="reserva-form.js" defer></script>.
 * ========================================================================== */

"use strict";

/* ----------------------------------------------------------------------------
 * Configuracion
 * --------------------------------------------------------------------------*/

// URL del proyecto Supabase (publica).
const SUPABASE_URL = "https://hsemxhgbtsisimjqwimo.supabase.co";

// La anon key es PUBLICA POR DISENO: va en el cliente y su seguridad la da el RLS
// (la tabla es deny-all para anon; ver migracion 0002). NO es un secreto. NO uses
// aqui jamas la service_role key. Reemplaza el placeholder por la anon key real.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZW14aGdidHNpc2ltanF3aW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjIzNTcsImV4cCI6MjA5NzAzODM1N30.ueUy9DdmXziH1NO3rFJKV-MdjAP0jasGvIzo_btlnFk";

// Endpoint de la Edge Function.
const ENDPOINT = `${SUPABASE_URL}/functions/v1/crear-reserva`;

/* ----------------------------------------------------------------------------
 * Inicializacion
 * --------------------------------------------------------------------------*/

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-reserva-form]");
  if (!form) return;

  // Origen de la reserva: se toma de data-origen del form ('brasa-norte' | 'solaria-retreat').
  const origen = form.getAttribute("data-origen") || "brasa-norte";
  // Valores validos de origen (cuadran con el enum reserva_origen de la BD). El backend
  // ya lo valida con Zod; este chequeo client-side es solo para detectar un data-origen
  // mal configurado en la integracion y avisar en consola (mejora debug).
  const ORIGENES_VALIDOS = ["brasa-norte", "solaria-retreat"];
  // Tipo por defecto: 'reserva' (con mesa) o 'lead' (sin mesa). Se puede sobreescribir
  // con data-tipo en el form, o con un campo input[name="tipo"].
  const tipoDefault = form.getAttribute("data-tipo") || "reserva";

  const statusEl = form.querySelector("[data-reserva-status]");
  const submitBtn = form.querySelector('[type="submit"]');

  form.addEventListener("submit", async (event) => {
    // Progressive enhancement: si el JS carga, interceptamos el submit nativo.
    // Si el JS NO carga o falla antes de aqui, el form hace su submit nativo al
    // action de fallback (ver decision en reserva-form.example.html).
    event.preventDefault();

    // S-05: si data-origen esta mal configurado, no enviar. Evita un 400 garantizado del
    // backend y deja constancia en consola para depurar la integracion.
    if (!ORIGENES_VALIDOS.includes(origen)) {
      console.error(
        `[reserva-form] data-origen invalido: "${origen}". ` +
          `Valores permitidos: ${ORIGENES_VALIDOS.join(", ")}. Envio cancelado.`,
      );
      setStatus(statusEl, "error", "Formulario mal configurado. Contacta con el administrador.");
      return;
    }

    clearFieldErrors(form);
    setStatus(statusEl, "enviando", "Enviando...");
    setBusy(submitBtn, true);

    const payload = buildPayload(form, origen, tipoDefault);

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // El gateway de Supabase exige la anon key para invocar la Function.
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (res.status === 201 && body && body.ok) {
        setStatus(statusEl, "exito", "Reserva enviada. Te contactaremos en breve.");
        form.reset();
        return;
      }

      if (res.status === 400 && body && !body.ok) {
        // Validacion: pinta el error por campo si el backend devolvio fields.
        if (body.error && body.error.fields) {
          paintFieldErrors(form, body.error.fields);
          setStatus(statusEl, "error", "Revisa los campos marcados.");
        } else {
          setStatus(statusEl, "error", (body.error && body.error.message) || "Datos invalidos.");
        }
        return;
      }

      if (res.status === 429) {
        setStatus(statusEl, "error", "Demasiados intentos. Espera unos minutos e intentalo de nuevo.");
        return;
      }

      if (res.status === 403) {
        setStatus(statusEl, "error", "No se pudo enviar desde este sitio. Contacta por telefono.");
        return;
      }

      // 405 / 500 / cualquier otro -> mensaje generico honesto.
      setStatus(statusEl, "error", "No se pudo enviar ahora mismo. Intentalo mas tarde.");
    } catch {
      // Error de red / CORS / offline.
      setStatus(statusEl, "error", "Sin conexion con el servidor. Comprueba tu red e intentalo de nuevo.");
    } finally {
      setBusy(submitBtn, false);
    }
  });
});

/* ----------------------------------------------------------------------------
 * Construccion del payload (cuadra con el schema Zod de la Edge Function)
 * --------------------------------------------------------------------------*/

function buildPayload(form, origen, tipoDefault) {
  const get = (name) => {
    const el = form.elements.namedItem(name);
    return el && typeof el.value === "string" ? el.value : "";
  };

  const tipo = get("tipo") || tipoDefault;

  // El honeypot 'website' SIEMPRE se envia (vacio en un humano). El backend decide.
  const payload = {
    website: get("website"),
    nombre: get("nombre"),
    email: get("email"),
    origen: origen,
    tipo: tipo,
  };

  const telefono = get("telefono").trim();
  if (telefono) payload.telefono = telefono;

  const mensaje = get("mensaje").trim();
  if (mensaje) payload.mensaje = mensaje;

  // Campos de mesa: solo se incluyen si tienen valor (lead puro los omite).
  const fecha = get("fecha_deseada").trim();
  if (fecha) payload.fecha_deseada = fecha;

  const personas = get("num_personas").trim();
  if (personas) payload.num_personas = personas; // string; el backend coacciona a int.

  return payload;
}

/* ----------------------------------------------------------------------------
 * UI helpers (estados honestos)
 * --------------------------------------------------------------------------*/

function setStatus(el, state, message) {
  if (!el) return;
  el.textContent = message;
  el.setAttribute("data-state", state);
  // aria-live="polite" en el HTML hace que los lectores de pantalla lo anuncien.
}

function setBusy(btn, busy) {
  if (!btn) return;
  btn.disabled = busy;
  btn.setAttribute("aria-busy", busy ? "true" : "false");
}

function clearFieldErrors(form) {
  form.querySelectorAll("[data-error-for]").forEach((el) => {
    el.textContent = "";
  });
  form.querySelectorAll("[aria-invalid='true']").forEach((el) => {
    el.removeAttribute("aria-invalid");
  });
}

function paintFieldErrors(form, fields) {
  Object.keys(fields).forEach((name) => {
    const msg = fields[name];
    const errEl = form.querySelector(`[data-error-for="${name}"]`);
    if (errEl) errEl.textContent = msg;
    const input = form.elements.namedItem(name);
    if (input && input.setAttribute) input.setAttribute("aria-invalid", "true");
  });
}
