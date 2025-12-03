// js/estadisticas.js
// Mantener referencias a los gráficos para poder actualizarlos
let chartReservas = null;
let chartDeporte = null;
let chartHoras = null;
let chartOcupacion = null;

(function () {
  const API = (window.API_BASE_URL || "https://api.canchalibre.ar").replace(/\/$/, "");

  document.addEventListener("DOMContentLoaded", init);

let token = null; // 🔹 variable global disponible para todo el script

document.addEventListener("DOMContentLoaded", init);

async function init() {
  token = localStorage.getItem("clubToken"); // 🔹 ahora se asigna globalmente

  if (!token) {
    alert("Debes iniciar sesión como club.");
    window.location.href = "login-club.html";
    return;
  }

  await cargarIdentidad(token);
  await cargarOverview(token);
}

// 📅 Cargar lista de meses (últimos 12)
const meses = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const hoy = new Date();
const selectMes = document.getElementById("select-mes");
const labelMes = document.getElementById("mes-actual");

// Generar los últimos 12 meses (incluido el actual)
for (let i = 0; i < 12; i++) {
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
  const valor = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  const texto = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  const option = document.createElement("option");
  option.value = valor;
  option.textContent = texto;
  if (i === 0) option.selected = true;
  selectMes.appendChild(option);
}

labelMes.textContent = `📅 Mostrando datos de ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;

// Detectar cambio de mes
selectMes.addEventListener("change", async () => {
  const valor = selectMes.value; // ejemplo: "2025-11"
  const [anio, mes] = valor.split("-");
  await cargarOverview(token, Number(anio), Number(mes));
  labelMes.textContent = `📅 Mostrando datos de ${meses[Number(mes) - 1]} ${anio}`;
});

  // ======================================================
  // ✅ Cargar identidad del club
  // ======================================================
  async function cargarIdentidad(token) {
    try {
      const r = await fetch(`${API}/api/club/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) throw new Error();

      const club = await r.json();

      const el = document.getElementById("club-nombre");
      if (el) {
        el.textContent = `${club.nombre} (${club.localidad}, ${club.provincia})`;
      }
    } catch {
      alert("No se pudo identificar el club.");
      window.location.href = "login-club.html";
    }
  }

 // ======================================================
// ✅ Cargar overview + gráficos
// ======================================================
async function cargarOverview(token, anio, mes) {

  const ids = ["kpi-reservas", "kpi-ingresos", "kpi-ocupacion"];
  ids.forEach(id => document.getElementById(id).textContent = "—");

  try {
    // Si no se pasa mes/año, usar el actual
    const hoy = new Date();
    const añoActual = anio || hoy.getFullYear();
    const mesActual = mes || hoy.getMonth() + 1;

    // ✅ Ahora el fetch incluye los parámetros en la URL
    const r = await fetch(`${API}/api/stats/overview?anio=${añoActual}&mes=${mesActual}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await r.json();

    // === KPI ===
    document.getElementById("kpi-reservas").textContent = data.totalReservas ?? 0;
    document.getElementById("kpi-ingresos").textContent = "$" + (data.ingresosMP ?? 0);
    document.getElementById("kpi-ocupacion").textContent =
      data.ocupacionPromedio != null ? Math.round(data.ocupacionPromedio) + "%" : "—";

    // === GRÁFICOS ===
    renderReservasPorDia(data.reservasPorDia);
    renderIngresosPorDeporte(data.ingresosPorDeporte);
    renderHorasPico(data.horasPico);
    renderOcupacionPorCancha(data.ocupacionPorCancha);

  } catch (err) {
    console.error("Error cargando overview:", err);
  }
}


  // ======================================================
  // ✅ GRAFICO: Reservas por día
  // ======================================================
 function renderReservasPorDia(series) {
  const ctx = document.getElementById("chart-reservas-dia");

  // 🔹 Si ya existe un gráfico previo, lo destruimos
  if (chartReservas) chartReservas.destroy();

  chartReservas = new Chart(ctx, {
    type: "line",
    data: {
      labels: series.map(d => d.dia),
      datasets: [{
        label: "Reservas",
        data: series.map(d => d.cantidad),
        borderWidth: 2,
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13, 110, 253, 0.2)"
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

  // ======================================================
  // ✅ GRAFICO: Ingresos por deporte
  // ======================================================
  function renderIngresosPorDeporte(obj) {
  const ctx = document.getElementById("chart-deporte");

  if (chartDeporte) chartDeporte.destroy();

  chartDeporte = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(obj),
      datasets: [{
        label: "Ingresos",
        data: Object.values(obj),
        borderWidth: 2,
        backgroundColor: "rgba(13, 110, 253, 0.4)"
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}


  // ======================================================
  // ✅ GRAFICO: Horas pico
  // ======================================================
  function renderHorasPico(series) {
  const ctx = document.getElementById("chart-horas");

  if (chartHoras) chartHoras.destroy();

  chartHoras = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.map(d => d.hora),
      datasets: [{
        label: "Reservas",
        data: series.map(d => d.cantidad),
        borderWidth: 2,
        backgroundColor: "rgba(13, 110, 253, 0.4)"
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

  // ======================================================
  // ✅ GRAFICO: Ocupación por cancha
  // ======================================================
  function renderOcupacionPorCancha(series) {
  const ctx = document.getElementById("chart-ocupacion");

  if (chartOcupacion) chartOcupacion.destroy();

  chartOcupacion = new Chart(ctx, {
    type: "pie",
    data: {
      labels: series.map(c => c.nombre),
      datasets: [{
        data: series.map(c => c.cantidad),
        backgroundColor: ["#0d6efd", "#dc3545", "#ffc107", "#198754", "#6f42c1"]
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}


})();
