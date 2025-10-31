require("dotenv").config();

async function listarModelos() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = "https://generativelanguage.googleapis.com/v1/models";

    const res = await fetch(`${url}?key=${apiKey}`);
    const data = await res.json();

    if (data.models) {
      console.log("✅ Modelos disponibles:\n");
      data.models.forEach((m, i) => {
        console.log(`${i + 1}. ${m.name} — ${m.displayName || "Sin nombre visible"}`);
      });
    } else {
      console.error("⚠️ No se encontraron modelos o la API Key no tiene permisos.");
      console.error(data);
    }
  } catch (err) {
    console.error("❌ Error al listar modelos:", err);
  }
}

listarModelos();
