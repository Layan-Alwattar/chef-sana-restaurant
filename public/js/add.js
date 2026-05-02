function getMeals() {
  return JSON.parse(localStorage.getItem("meals") || "[]");
}
function saveMeals(meals) {
  localStorage.setItem("meals", JSON.stringify(meals));
}

document.addEventListener("DOMContentLoaded", function () {
  const editing = JSON.parse(localStorage.getItem("editingMeal"));
  if (editing) {
    document.getElementById("page-title").setAttribute("data-i18n", "pageTitleEdit");
    document.getElementById("page-title").textContent = t("pageTitleEdit");
    document.getElementById("meal-id").value = editing.id;
    document.getElementById("title").value = editing.title;
    document.getElementById("tags").value = (editing.tags || []).join(", ");
    document.getElementById("calories").value = editing.calories;
    document.getElementById("description").value = editing.description;
    document.getElementById("satisfaction").value = editing.satisfaction;
    document.getElementById("image").value = editing.image || "";
    localStorage.removeItem("editingMeal");
  }
});

document.getElementById("meal-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const id = document.getElementById("meal-id").value;
  const numericId = id ? parseInt(id) : Date.now();
  const existing = getMeals().find(m => m.id === numericId);
  const meal = {
    id: numericId,
    title: document.getElementById("title").value,
    tags: document.getElementById("tags").value.split(",").map(t => t.trim()).filter(Boolean),
    calories: parseInt(document.getElementById("calories").value),
    description: document.getElementById("description").value,
    satisfaction: parseInt(document.getElementById("satisfaction").value),
    image: document.getElementById("image").value,
    date: existing ? existing.date : new Date().toISOString(),
    userId: existing ? existing.userId : 1,
    views: existing ? (existing.views || 0) : 0,
    reviews: existing ? (existing.reviews || []) : []
  };
  const meals = getMeals();
  const updated = meals.some(m => m.id === meal.id)
    ? meals.map(m => m.id === meal.id ? meal : m)
    : [...meals, meal];
  saveMeals(updated);
  alert(t("mealSaved"));
  window.location.href = "../index.html";
});
