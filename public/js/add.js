// Admin add/edit meal form. Writes meals to Supabase and uploads photos to
// Supabase Storage (bucket: meal-images). Admin-only: non-admins are bounced.

// Tag chip state. Splits on both English ',' and Arabic '،'.
let tagsList = [];
const TAG_SPLIT = /[,،]+/;

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderTagChips() {
  const wrap = document.getElementById("tag-chips");
  if (!wrap) return;
  wrap.innerHTML = tagsList
    .map(
      (tag, i) => `
    <span class="tag-chip">
      <span class="tag-chip-text">#${escHtml(tag)}</span>
      <button type="button" class="tag-chip-remove" data-index="${i}" data-i18n-title="removeTag" title="Remove tag" aria-label="Remove">×</button>
    </span>
  `
    )
    .join("");
  wrap.querySelectorAll(".tag-chip-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"));
      tagsList.splice(idx, 1);
      renderTagChips();
    });
  });
}

function addTagsFromInput(rawText) {
  if (!rawText) return;
  const parts = rawText.split(TAG_SPLIT).map((s) => s.trim()).filter(Boolean);
  let added = false;
  parts.forEach((p) => {
    if (!tagsList.includes(p)) {
      tagsList.push(p);
      added = true;
    }
  });
  if (added) renderTagChips();
}

const MAX_IMAGE_WIDTH = 1000; // downscale uploads/pastes before storing
const JPEG_QUALITY = 0.85;

function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
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

// Convert a data: URL into a Blob for upload.
function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(",");
  const mime = (head.match(/:(.*?);/) || [, "image/jpeg"])[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadImageIfNeeded(value) {
  // Only freshly added images are data: URLs — upload those to Storage and
  // return the public URL. Plain http(s) URLs (or empty) are kept as-is.
  if (!value || !value.startsWith("data:")) return value;
  const blob = dataUrlToBlob(value);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage
    .from("meal-images")
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from("meal-images").getPublicUrl(path);
  return data.publicUrl;
}

document.addEventListener("DOMContentLoaded", async function () {
  // Guard: only admins (Chef Sana) may use this page.
  await authReady;
  if (!isAdmin()) {
    window.location.replace("account.html");
    return;
  }

  const editing = JSON.parse(localStorage.getItem("editingMeal") || "null");
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
      if (!editing.image.startsWith("data:")) {
        document.getElementById("image-url").value = editing.image;
      }
    }
    localStorage.removeItem("editingMeal");
  }

  const tagEntry = document.getElementById("tag-entry");
  const addTagBtn = document.getElementById("add-tag-btn");
  function commitTagEntry() {
    addTagsFromInput(tagEntry.value);
    tagEntry.value = "";
    tagEntry.focus();
  }
  addTagBtn.addEventListener("click", commitTagEntry);
  tagEntry.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTagEntry();
    }
  });
  tagEntry.addEventListener("input", (e) => {
    if (TAG_SPLIT.test(e.target.value)) commitTagEntry();
  });

  document.getElementById("image-file").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handleFile(file);
  });

  document.getElementById("image-url").addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) setImageValue(url);
    else if (!document.getElementById("image-file").files[0]) setImageValue("");
  });

  document.getElementById("image-remove").addEventListener("click", () => {
    setImageValue("");
    document.getElementById("image-file").value = "";
    document.getElementById("image-url").value = "";
  });

  document.addEventListener("paste", async (e) => {
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

  document.getElementById("meal-form").addEventListener("submit", onSubmit);
});

async function onSubmit(e) {
  e.preventDefault();
  const pending = document.getElementById("tag-entry").value;
  if (pending && pending.trim()) addTagsFromInput(pending);

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const idVal = document.getElementById("meal-id").value;
  const caloriesVal = document.getElementById("calories").value;
  const satisfactionVal = document.getElementById("satisfaction").value;

  let imageUrl;
  try {
    imageUrl = await uploadImageIfNeeded(document.getElementById("image").value);
  } catch (err) {
    console.error("Image upload failed:", err);
    alert(t("imageUploadFailed"));
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  const row = {
    title: document.getElementById("title").value.trim(),
    tags: [...tagsList],
    calories: caloriesVal ? parseInt(caloriesVal) : null,
    description: document.getElementById("description").value,
    satisfaction: satisfactionVal ? parseInt(satisfactionVal) : null,
    image: imageUrl || null,
  };

  let error;
  if (idVal) {
    ({ error } = await sb.from("meals").update(row).eq("id", parseInt(idVal)));
  } else {
    ({ error } = await sb.from("meals").insert(row));
  }

  if (error) {
    console.error(error);
    alert(error.message);
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  alert(t("mealSaved"));
  window.location.href = "../index.html";
}
