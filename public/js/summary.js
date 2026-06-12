// Tag summary: counts and average satisfaction per tag. Reads live from Supabase.

let summaryMeals = [];

async function loadSummaryMeals() {
  const { data, error } = await sb.from("meals").select("tags,satisfaction");
  if (error) {
    console.error("Failed to load meals for summary:", error);
    return;
  }
  summaryMeals = data || [];
}

function renderSummary() {
  const summary = {};
  summaryMeals.forEach((meal) => {
    (meal.tags || []).forEach((tag) => {
      if (!summary[tag]) summary[tag] = { count: 0, total: 0 };
      summary[tag].count++;
      summary[tag].total += meal.satisfaction || 0;
    });
  });
  const body = document.getElementById("summary-body");
  if (!body) return;
  body.innerHTML = "";
  for (const tag in summary) {
    const avg = (summary[tag].total / summary[tag].count).toFixed(2);
    const row = document.createElement("tr");
    row.innerHTML = `<td>#${tag}</td><td>${summary[tag].count}</td><td>⭐ ${avg}</td>`;
    body.appendChild(row);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadSummaryMeals();
  renderSummary();
});
document.addEventListener("langchange", renderSummary);
