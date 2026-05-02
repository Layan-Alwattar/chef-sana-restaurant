function getMeals() {
  return JSON.parse(localStorage.getItem("meals") || "[]");
}
function saveMeals(meals) {
  localStorage.setItem("meals", JSON.stringify(meals));
}

// Tag chip state. Splits on both English ',' and Arabic '،' so pasted lists
// like "vegan, healthy ، خضار" all become individual chips.
let tagsList = [];
const TAG_SPLIT = /[,،]+/;

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderTagChips() {
  const wrap = document.getElementById("tag-chips");
  if (!wrap) return;
  wrap.innerHTML = tagsList.map((tag, i) => `
    <span class="tag-chip">
      <span class="tag-chip-text">#${escHtml(tag)}</span>
      <button type="button" class="tag-chip-remove" data-index="${i}" data-i18n-title="removeTag" title="Remove tag" aria-label="Remove">×</button>
    </span>
  `).join("");
  wrap.querySelectorAll(".tag-chip-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      tagsList.splice(idx, 1);
      renderTagChips();
    });
  });
}

function addTagsFromInput(rawText) {
  if (!rawText) return;
  const parts = rawText.split(TAG_SPLIT).map(s => s.trim()).filter(Boolean);
  let added = false;
  parts.forEach(p => {
    if (!tagsList.includes(p)) {
      tagsList.push(p);
      added = true;
    }
  });
  if (added) renderTagChips();
}

const MAX_IMAGE_WIDTH = 1000;   // downscale uploads/pastes so localStorage stays small
const JPEG_QUALITY = 0.85;

// Read a File/Blob, downscale to MAX_IMAGE_WIDTH if larger, return a JPEG data URL.
function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setImageValue(value) {
  const hidden = document.getElementById("image");
  const preview = document.getElementById("image-preview");
  const wrap = document.getElementById("preview-wrap");
  hidden.value = value || "";
  if (value) {
    preview.src = value;
    wrap.hidden = false;
  } else {
    preview.removeAttribute("src");
    wrap.hidden = true;
  }
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await fileToResizedDataUrl(file);
    setImageValue(dataUrl);
    document.getElementById("image-url").value = "";
  } catch (err) {
    console.error("Failed to process image:", err);
    alert("Could not read image.");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const editing = JSON.parse(localStorage.getItem("editingMeal"));
  if (editing) {
    document.getElementById("page-title").setAttribute("data-i18n", "pageTitleEdit");
    document.getElementById("page-title").textContent = t("pageTitleEdit");
    document.getElementById("meal-id").value = editing.id;
    document.getElementById("title").value = editing.title;
    tagsList = Array.isArray(editing.tags) ? [...editing.tags] : [];
    renderTagChips();
    document.getElementById("calories").value = editing.calories;
    document.getElementById("description").value = editing.description;
    document.getElementById("satisfaction").value = editing.satisfaction;
    if (editing.image) {
      setImageValue(editing.image);
      // If it's a normal URL (not a data URL), echo it into the URL field so it stays editable.
      if (!editing.image.startsWith("data:")) {
        document.getElementById("image-url").value = editing.image;
      }
    }
    localStorage.removeItem("editingMeal");
  }

  // Tag entry: + button and Enter both add the current input as a chip.
  const tagEntry = document.getElementById("tag-entry");
  const addTagBtn = document.getElementById("add-tag-btn");
  function commitTagEntry() {
    addTagsFromInput(tagEntry.value);
    tagEntry.value = "";
    tagEntry.focus();
  }
  addTagBtn.addEventListener("click", commitTagEntry);
  tagEntry.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTagEntry();
    }
  });
  // Auto-split when user types a comma so they don't have to press +.
  tagEntry.addEventListener("input", e => {
    if (TAG_SPLIT.test(e.target.value)) commitTagEntry();
  });

  // File chooser
  document.getElementById("image-file").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
  });

  // Manual URL entry
  document.getElementById("image-url").addEventListener("input", e => {
    const url = e.target.value.trim();
    if (url) setImageValue(url);
    else if (!document.getElementById("image-file").files[0]) setImageValue("");
  });

  // Remove button
  document.getElementById("image-remove").addEventListener("click", () => {
    setImageValue("");
    document.getElementById("image-file").value = "";
    document.getElementById("image-url").value = "";
  });

  // Paste an image from the clipboard anywhere on the page (Ctrl/⌘ + V).
  document.addEventListener("paste", async e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          await handleFile(file);
          e.preventDefault();
          return;
        }
      }
    }
  });
});

document.getElementById("meal-form").addEventListener("submit", function (e) {
  e.preventDefault();
  // If user typed a tag but didn't press +, fold it in before saving.
  const pending = document.getElementById("tag-entry").value;
  if (pending && pending.trim()) addTagsFromInput(pending);
  const id = document.getElementById("meal-id").value;
  const numericId = id ? parseInt(id) : Date.now();
  const existing = getMeals().find(m => m.id === numericId);
  const meal = {
    id: numericId,
    title: document.getElementById("title").value,
    tags: [...tagsList],
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
  try {
    saveMeals(updated);
  } catch (err) {
    // QuotaExceededError typically means localStorage filled with too many big images.
    alert("Storage is full — try removing old meals or using a smaller image.");
    console.error(err);
    return;
  }
  alert(t("mealSaved"));
  window.location.href = "../index.html";
});
