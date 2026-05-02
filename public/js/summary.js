function getMeals() {
  return JSON.parse(localStorage.getItem("meals") || "[]");
}

function renderSummary() {
  const meals = getMeals();
  const summary = {};
  meals.forEach(meal => {
    (meal.tags || []).forEach(tag => {
      if (!summary[tag]) summary[tag] = { count: 0, total: 0 };
      summary[tag].count++;
      summary[tag].total += meal.satisfaction || 0;
    });
  });
  const body = document.getElementById("summary-body");
  body.innerHTML = "";
  for (let tag in summary) {
    const avg = (summary[tag].total / summary[tag].count).toFixed(2);
    const row = document.createElement("tr");
    row.innerHTML = `<td>#${tag}</td><td>${summary[tag].count}</td><td>⭐ ${avg}</td>`;
    body.appendChild(row);
  }
}

document.addEventListener("DOMContentLoaded", renderSummary);
document.addEventListener("langchange", renderSummary);
