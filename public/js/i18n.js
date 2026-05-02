// Lightweight i18n (English / Arabic) for NutriSnap
const I18N = {
  en: {
    appTitle: "Chef Sana's Restaurant",
    home: "Home",
    addMeal: "Add Meal",
    summary: "Summary",
    admin: "Admin",
    logout: "Logout",
    searchPlaceholder: "Search meals by title or #tag...",
    showDescription: "Show Description",
    hideDescription: "Hide Description",
    date: "Date",
    tags: "Tags",
    calories: "Calories",
    satisfaction: "Satisfaction",
    views: "Views",
    avgRating: "Avg. Rating",
    reviews: "Reviews",
    showReviews: "Show Reviews",
    hideReviews: "Hide Reviews",
    yourRating: "Your rating",
    yourName: "Your name",
    yourComment: "Write a comment...",
    submitReview: "Submit Review",
    noReviews: "No reviews yet. Be the first!",
    pageTitleAdd: "Add New Meal",
    pageTitleEdit: "Edit Meal",
    mealTitle: "Meal Title",
    mealTags: "Tags (comma-separated)",
    mealCalories: "Calories",
    mealDescription: "Meal Description",
    mealSatisfaction: "Satisfaction (1-5)",
    mealImage: "Image URL",
    saveMeal: "Save Meal",
    summaryHeading: "Meal Summary",
    summarySubtitle: "Summary of meals grouped by tags.",
    tag: "Tag",
    totalMeals: "Total Meals",
    avgSatisfaction: "Avg Satisfaction",
    adminLoginTitle: "Admin Access",
    adminLoginSubtitle: "Enter the admin key to manage meals.",
    accessKey: "Access key",
    enter: "Enter",
    invalidKey: "Invalid key. Try again.",
    confirmDelete: "Are you sure you want to delete this meal?",
    mealSaved: "Meal saved successfully!",
    language: "Language",
    english: "English",
    arabic: "العربية",
    kcal: "kcal",
    by: "by",
    rateThisMeal: "Rate this meal",
    pleaseRate: "Please choose a star rating.",
    pleaseName: "Please enter your name.",
    pleaseComment: "Please enter a comment.",
    footer: "NutriSnap © 2025. Built with 💚 for Health & Simplicity.",
    footerShort: "NutriSnap © 2025"
  },
  ar: {
    appTitle: "مطعم الشيف سنا",
    home: "الرئيسية",
    addMeal: "إضافة وجبة",
    summary: "الملخص",
    admin: "المسؤول",
    logout: "تسجيل خروج",
    searchPlaceholder: "ابحث عن الوجبات بالعنوان أو #التصنيف...",
    showDescription: "إظهار الوصف",
    hideDescription: "إخفاء الوصف",
    date: "التاريخ",
    tags: "التصنيفات",
    calories: "السعرات",
    satisfaction: "الرضا",
    views: "المشاهدات",
    avgRating: "متوسط التقييم",
    reviews: "المراجعات",
    showReviews: "إظهار المراجعات",
    hideReviews: "إخفاء المراجعات",
    yourRating: "تقييمك",
    yourName: "اسمك",
    yourComment: "اكتب تعليقاً...",
    submitReview: "إرسال المراجعة",
    noReviews: "لا توجد مراجعات بعد. كن أول من يراجع!",
    pageTitleAdd: "إضافة وجبة جديدة",
    pageTitleEdit: "تعديل الوجبة",
    mealTitle: "اسم الوجبة",
    mealTags: "التصنيفات (مفصولة بفواصل)",
    mealCalories: "السعرات الحرارية",
    mealDescription: "وصف الوجبة",
    mealSatisfaction: "الرضا (1-5)",
    mealImage: "رابط الصورة",
    saveMeal: "حفظ الوجبة",
    summaryHeading: "ملخص الوجبات",
    summarySubtitle: "ملخص الوجبات مصنفة حسب التصنيفات.",
    tag: "التصنيف",
    totalMeals: "إجمالي الوجبات",
    avgSatisfaction: "متوسط الرضا",
    adminLoginTitle: "دخول المسؤول",
    adminLoginSubtitle: "أدخل مفتاح المسؤول لإدارة الوجبات.",
    accessKey: "مفتاح الدخول",
    enter: "دخول",
    invalidKey: "مفتاح غير صحيح. حاول مرة أخرى.",
    confirmDelete: "هل أنت متأكد من حذف هذه الوجبة؟",
    mealSaved: "تم حفظ الوجبة بنجاح!",
    language: "اللغة",
    english: "English",
    arabic: "العربية",
    kcal: "سعرة",
    by: "بواسطة",
    rateThisMeal: "قيّم هذه الوجبة",
    pleaseRate: "يرجى اختيار تقييم بالنجوم.",
    pleaseName: "يرجى إدخال اسمك.",
    pleaseComment: "يرجى إدخال تعليق.",
    footer: "نوتري سناب © 2025. صُنع بحب 💚 من أجل الصحة والبساطة.",
    footerShort: "نوتري سناب © 2025"
  }
};

function getLang() {
  return localStorage.getItem("lang") || "en";
}

function setLang(lang) {
  localStorage.setItem("lang", lang);
  applyLang();
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function applyLang() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });

  const select = document.getElementById("lang-select");
  if (select) select.value = lang;

  // Notify pages that need to re-render dynamic content
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}

document.addEventListener("DOMContentLoaded", () => {
  applyLang();
  const select = document.getElementById("lang-select");
  if (select) {
    select.addEventListener("change", e => setLang(e.target.value));
  }
});
