import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { translations, Language, Translations } from "./i18n";
import { icons } from "./icons";

// Data types
export interface ImageItem {
  id: string;
  path: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
  format: string;
  status: "pending" | "processing" | "success" | "error";
  newSize?: number;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
}

export interface BatchOptions {
  files: string[];
  format: string;
  resizeMode: string;
  resizeValue: number;
  resizeWidth?: number;
  resizeHeight?: number;
  fitMode?: string;
  noUpscale?: boolean;
  quality: number;
  targetSizeKb?: number;
  outputDir?: string;
  suffix?: string;
  overwriteSource: boolean;
}

export interface ProgressEventPayload {
  index: number;
  total: number;
  id: string;
  path: string;
  status: "processing" | "success" | "error";
  originalSize: number;
  newSize?: number;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
}

export interface BatchCompletePayload {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalOriginalBytes: number;
  totalNewBytes: number;
  durationMs: number;
  lastOutputPath?: string;
}

export interface Preset {
  id: string;
  name: string;
  titleKey?: keyof Translations;
  specsKey?: keyof Translations;
  nameKey?: keyof Translations;
  isBuiltIn?: boolean;
  format: "jpg" | "png" | "webp" | "avif";
  quality: number;
  targetSizeEnabled: boolean;
  targetSizeVal?: number;
  targetSizeUnit?: "kb" | "mb";
  resizeMode: "original" | "custom" | "scale";
  customWidth?: number;
  customHeight?: number;
  fitMode?: "fit" | "fill" | "stretch";
  noUpscale?: boolean;
  scaleVal?: number;
}

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "preset-web-1080p",
    name: "Web Standard — WEBP • 1080p Fit • 82%",
    titleKey: "presetTitleWebStandard",
    specsKey: "presetSpecsWebStandard",
    nameKey: "presetWebStandard",
    isBuiltIn: true,
    format: "webp",
    quality: 82,
    targetSizeEnabled: false,
    resizeMode: "custom",
    customWidth: 1920,
    customHeight: 1080,
    fitMode: "fit",
    noUpscale: true,
  },
  {
    id: "preset-ultra-4k",
    name: "Ultra HD / 4K — WEBP • 2160p Fit • 88%",
    titleKey: "presetTitleUltra4k",
    specsKey: "presetSpecsUltra4k",
    nameKey: "presetUltra4k",
    isBuiltIn: true,
    format: "webp",
    quality: 88,
    targetSizeEnabled: false,
    resizeMode: "custom",
    customWidth: 3840,
    customHeight: 2160,
    fitMode: "fit",
    noUpscale: true,
  },
  {
    id: "preset-email-doc",
    name: "Email & Docs — JPG • 720p Fit • Max 500 KB",
    titleKey: "presetTitleEmailDocs",
    specsKey: "presetSpecsEmailDocs",
    nameKey: "presetEmailDocs",
    isBuiltIn: true,
    format: "jpg",
    quality: 75,
    targetSizeEnabled: true,
    targetSizeVal: 500,
    targetSizeUnit: "kb",
    resizeMode: "custom",
    customWidth: 1280,
    customHeight: 720,
    fitMode: "fit",
    noUpscale: true,
  },
  {
    id: "preset-square-thumb",
    name: "Square Thumbnail — JPG • 300×300 Fill • 85%",
    titleKey: "presetTitleSquareThumb",
    specsKey: "presetSpecsSquareThumb",
    nameKey: "presetSquareThumb",
    isBuiltIn: true,
    format: "jpg",
    quality: 85,
    targetSizeEnabled: false,
    resizeMode: "custom",
    customWidth: 300,
    customHeight: 300,
    fitMode: "fill",
    noUpscale: false,
  },
  {
    id: "preset-social-portrait",
    name: "Social Media (4:5) — JPG • 1080×1350 Fit • 85%",
    titleKey: "presetTitleSocialMedia",
    specsKey: "presetSpecsSocialMedia",
    nameKey: "presetSocialMedia",
    isBuiltIn: true,
    format: "jpg",
    quality: 85,
    targetSizeEnabled: false,
    resizeMode: "custom",
    customWidth: 1080,
    customHeight: 1350,
    fitMode: "fit",
    noUpscale: false,
  },
  {
    id: "preset-webp-native",
    name: "Lightweight Native — WEBP • Orig. Size • 80%",
    titleKey: "presetTitleLightweightNative",
    specsKey: "presetSpecsLightweightNative",
    nameKey: "presetLightweightNative",
    isBuiltIn: true,
    format: "webp",
    quality: 80,
    targetSizeEnabled: false,
    resizeMode: "original",
  },
  {
    id: "preset-archive-avif",
    name: "High-Fidelity Archive — AVIF • Orig. Size • 85%",
    titleKey: "presetTitleHighFidelityArchive",
    specsKey: "presetSpecsHighFidelityArchive",
    nameKey: "presetHighFidelityArchive",
    isBuiltIn: true,
    format: "avif",
    quality: 85,
    targetSizeEnabled: false,
    resizeMode: "original",
  },
];

// State
let currentLang: Language = "en";
let filesQueue: ImageItem[] = [];
let isProcessing = false;
let isMaximized = false;
let userPresets: Preset[] = [];
let activePresetId: string | null = null;

// App Settings State & Storage
export interface AppSettings {
  lang: Language;
  theme: "dark" | "light" | "system";
  stripExif: boolean;
  defaultSuffix: string;
}

const SETTINGS_STORAGE_KEY = "shrinkr_settings";

const defaultSettings: AppSettings = {
  lang: "fr",
  theme: "dark",
  stripExif: true,
  defaultSuffix: "_min",
};

let appSettings: AppSettings = { ...defaultSettings };

function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        lang: parsed.lang === "en" || parsed.lang === "fr" ? parsed.lang : defaultSettings.lang,
        theme: parsed.theme === "light" || parsed.theme === "system" ? parsed.theme : "dark",
        stripExif: typeof parsed.stripExif === "boolean" ? parsed.stripExif : defaultSettings.stripExif,
        defaultSuffix: typeof parsed.defaultSuffix === "string" ? parsed.defaultSuffix : defaultSettings.defaultSuffix,
      };
    }
  } catch (e) {
    console.warn("Failed to load settings:", e);
  }
  return { ...defaultSettings };
}

function saveAppSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
  } catch (e) {
    console.warn("Failed to save settings:", e);
  }
}

function applyTheme(theme: "dark" | "light" | "system") {
  appSettings.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

function updateSettingsUI() {
  if (langFrBtn) langFrBtn.classList.toggle("active", currentLang === "fr");
  if (langEnBtn) langEnBtn.classList.toggle("active", currentLang === "en");

  themePills?.querySelectorAll("[data-theme]").forEach(pill => {
    pill.classList.toggle("active", (pill as HTMLElement).dataset.theme === appSettings.theme);
  });

  if (toggleStripExif) {
    toggleStripExif.classList.toggle("active", appSettings.stripExif);
    toggleStripExif.setAttribute("aria-checked", appSettings.stripExif.toString());
  }

  if (inputSettingsDefaultSuffix) {
    inputSettingsDefaultSuffix.value = appSettings.defaultSuffix;
  }
}

// Selected Settings: Format & Quality
let selectedFormat = "jpg";
let qualityVal = 82;
let targetSizeEnabled = false;
let targetSizeVal = 500;
let targetSizeUnit: "kb" | "mb" = "kb";

// Selected Settings: Resize Engine (PowerToys style)
let selectedResizeMode: "original" | "custom" | "scale" = "original";
let customWidth = 1920;
let customHeight = 1080;
let aspectRatio = 1920 / 1080;
let isAspectRatioLocked = true;
let selectedFitMode: "fit" | "fill" | "stretch" = "fit";
let noUpscaleVal = false;
let scaleVal = 75;
let userHasModifiedDimensions = false;

// Selected Settings: Destination
let saveSameFolder = true;
let customOutputDir: string | null = null;
let fileSuffixVal = "_shrinkr";
let overwriteSourceVal = false;
let lastBatchOutputPath: string | null = null;

// Helpers
function formatBytes(bytes: number): string {
  if (typeof bytes !== "number" || isNaN(bytes) || bytes === null || bytes === undefined) {
    return "0 B";
  }
  if (bytes === 0) return "0 B";
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(absBytes) / Math.log(k)), sizes.length - 1);
  const val = parseFloat((absBytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

async function revealFolder(targetPath: string | null | undefined) {
  if (!targetPath || !targetPath.trim()) return;
  try {
    await invoke("open_folder", { path: targetPath.trim() });
  } catch (err) {
    console.error("Failed to open folder via open_folder:", err);
    try {
      await openPath(targetPath.trim());
    } catch (e) {
      console.error("Fallback openPath also failed:", e);
    }
  }
}

function t(key: keyof Translations): string {
  return translations[currentLang][key];
}

// DOM Elements: Titlebar
const btnMinimize = (document.getElementById("btn-minimize") || document.getElementById("btn-win-minimize")) as HTMLButtonElement | null;
const btnMaximize = (document.getElementById("btn-maximize") || document.getElementById("btn-win-maximize")) as HTMLButtonElement | null;
const btnClose = (document.getElementById("btn-close") || document.getElementById("btn-win-close")) as HTMLButtonElement | null;

const langEnBtn = (document.getElementById("lang-btn-en") || document.getElementById("lang-en")) as HTMLButtonElement | null;
const langFrBtn = (document.getElementById("lang-btn-fr") || document.getElementById("lang-fr")) as HTMLButtonElement | null;
const btnOpenSettings = document.getElementById("btn-open-settings");
const iconSettings = document.getElementById("icon-settings");

// DOM Elements: Adaptive Drop Zone
const dropZoneHero = document.getElementById("drop-zone-hero")!;
const dropIcon = document.getElementById("drop-icon")!;
const dropTitle = document.getElementById("drop-title")!;
const dropSubtitle = document.getElementById("drop-subtitle")!;
const btnBrowseFiles = document.getElementById("btn-browse-files")!;
const btnBrowseFolder = document.getElementById("btn-browse-folder")!;
const btnBrowseIcon = document.getElementById("btn-browse-icon")!;
const btnFolderIcon = document.getElementById("btn-folder-icon")!;
const labelBrowseFiles = document.getElementById("label-browse-files")!;
const labelBrowseFolder = document.getElementById("label-browse-folder")!;

const dropZoneCompact = document.getElementById("drop-zone-compact")!;
const iconCompactDrop = document.getElementById("icon-compact-drop")!;
const labelCompactDrop = document.getElementById("label-compact-drop")!;
const btnCompactBrowseFiles = document.getElementById("btn-compact-browse-files")!;
const iconCompactBrowse = document.getElementById("icon-compact-browse")!;
const labelCompactBrowseFiles = document.getElementById("label-compact-browse-files")!;
const btnCompactBrowseFolder = document.getElementById("btn-compact-browse-folder")!;
const iconCompactFolder = document.getElementById("icon-compact-folder")!;
const labelCompactBrowseFolder = document.getElementById("label-compact-browse-folder")!;

// DOM Elements: Presets Sidebar Block & Modal
const iconPresetHeader = document.getElementById("icon-preset-header");
const labelPresetHeader = document.getElementById("label-preset-header")!;
const btnPresetDelete = document.getElementById("btn-preset-delete") as HTMLButtonElement | null;
const iconPresetDelete = document.getElementById("icon-preset-delete");
const btnPresetAdd = document.getElementById("btn-preset-add") as HTMLButtonElement | null;
const iconPresetAdd = document.getElementById("icon-preset-add");
const labelPresetAdd = document.getElementById("label-preset-add")!;
const presetSelect = document.getElementById("preset-select") as HTMLSelectElement | null;
const iconPresetSelectChevron = document.getElementById("icon-preset-select-chevron");
const brandLogo = document.getElementById("brand-logo");

const modalSavePreset = document.getElementById("modal-save-preset")!;
const titleModalPreset = document.getElementById("title-modal-preset")!;
const descModalPreset = document.getElementById("desc-modal-preset")!;
const inputPresetName = document.getElementById("input-preset-name") as HTMLInputElement;
const labelModalPresetPreview = document.getElementById("label-modal-preset-preview");
const previewPresetSuffix = document.getElementById("preview-preset-suffix");
const btnClosePresetModal = document.getElementById("btn-close-preset-modal")!;
const btnCancelPresetSave = document.getElementById("btn-cancel-preset-save")!;
const btnConfirmPresetSave = document.getElementById("btn-confirm-preset-save")!;

// DOM Elements: Settings Modal
const modalSettings = document.getElementById("modal-settings");
const iconModalSettings = document.getElementById("icon-modal-settings");
const titleModalSettings = document.getElementById("title-modal-settings");
const btnCloseSettingsModal = document.getElementById("btn-close-settings-modal");
const btnDoneSettings = document.getElementById("btn-done-settings");
const labelSettingsLang = document.getElementById("label-settings-lang");
const labelSettingsAppearance = document.getElementById("label-settings-appearance");
const themePills = document.getElementById("theme-pills");
const themeBtnDark = document.getElementById("theme-btn-dark");
const themeBtnLight = document.getElementById("theme-btn-light");
const themeBtnSystem = document.getElementById("theme-btn-system");
const labelSettingsPrivacyTitle = document.getElementById("label-settings-privacy-title");
const labelSettingsStripExif = document.getElementById("label-settings-strip-exif");
const toggleStripExif = document.getElementById("toggle-strip-exif");
const labelSettingsFilesTitle = document.getElementById("label-settings-files-title");
const labelSettingsSuffixDesc = document.getElementById("label-settings-suffix-desc");
const inputSettingsDefaultSuffix = document.getElementById("input-settings-default-suffix") as HTMLInputElement | null;
const iconAboutLogo = document.getElementById("icon-about-logo");
const labelSettingsAboutDesc = document.getElementById("label-settings-about-desc");

// DOM Elements: Accordions
const iconFormatHeader = document.getElementById("icon-format-header")!;
const labelFormatHeader = document.getElementById("label-format-header")!;
const badgeSummaryFormat = document.getElementById("badge-summary-format")!;
const chevronFormat = document.getElementById("chevron-format")!;

const iconResizeHeader = document.getElementById("icon-resize-header")!;
const labelResizeHeader = document.getElementById("label-resize-header")!;
const badgeSummaryResize = document.getElementById("badge-summary-resize")!;
const chevronResize = document.getElementById("chevron-resize")!;

const iconDestHeader = document.getElementById("icon-dest-header")!;
const labelDestHeader = document.getElementById("label-dest-header")!;
const badgeSummaryDest = document.getElementById("badge-summary-dest")!;
const chevronDest = document.getElementById("chevron-dest")!;

// DOM Elements: Format Section
const labelOutputFormat = document.getElementById("label-output-format")!;
const formatPills = document.getElementById("format-pills")!;
const labelQuality = document.getElementById("label-quality")!;
const qualityValText = document.getElementById("quality-val")!;
const inputQuality = document.getElementById("input-quality") as HTMLInputElement;

const labelTargetSize = document.getElementById("label-target-size")!;
const targetSizeDesc = document.getElementById("target-size-desc")!;
const targetSizeToggle = document.getElementById("target-size-toggle")!;
const targetSizeInputs = document.getElementById("target-size-inputs")!;
const inputTargetSize = document.getElementById("input-target-size") as HTMLInputElement;
const unitPills = document.getElementById("unit-pills")!;

// DOM Elements: Resize Engine Section (PowerToys style)
const labelResizeMode = document.getElementById("label-resize-mode")!;
const resizeModePills = document.getElementById("resize-mode-pills")!;
const panelResizeCustom = document.getElementById("panel-resize-custom")!;
const panelResizeScale = document.getElementById("panel-resize-scale")!;

const labelCustomW = document.getElementById("label-custom-w")!;
const labelCustomH = document.getElementById("label-custom-h")!;
const inputCustomWidth = document.getElementById("input-custom-width") as HTMLInputElement;
const inputCustomHeight = document.getElementById("input-custom-height") as HTMLInputElement;
const btnLockAspect = document.getElementById("btn-lock-aspect") as HTMLButtonElement;
const iconLockAspect = document.getElementById("icon-lock-aspect")!;
const btnResetDimensions = document.getElementById("btn-reset-dimensions") as HTMLButtonElement;
const iconResetDimensions = document.getElementById("icon-reset-dimensions")!;

const labelFitMode = document.getElementById("label-fit-mode")!;
const fitModePills = document.getElementById("fit-mode-pills")!;
const checkNoUpscale = document.getElementById("check-no-upscale") as HTMLInputElement;
const labelNoUpscale = document.getElementById("label-no-upscale")!;

const inputScalePercent = document.getElementById("input-scale-percent") as HTMLInputElement;
const scalePresets = document.getElementById("scale-presets")!;

// DOM Elements: Destination Section
const toggleSameFolder = document.getElementById("toggle-same-folder")!;
const labelSameFolder = document.getElementById("label-same-folder")!;
const descSameFolder = document.getElementById("desc-same-folder")!;
const rowCustomFolder = document.getElementById("row-custom-folder")!;
const inputCustomFolderPath = document.getElementById("input-custom-folder-path") as HTMLInputElement;
const btnPickCustomFolder = document.getElementById("btn-pick-custom-folder")!;
const iconFolderBrowse = document.getElementById("icon-folder-browse")!;
const labelBrowseDestBtn = document.getElementById("label-browse-dest-btn")!;

const labelSuffixText = document.getElementById("label-suffix-text")!;
const inputSuffixText = document.getElementById("input-suffix-text") as HTMLInputElement;
const checkOverwrite = document.getElementById("check-overwrite") as HTMLInputElement;
const labelOverwriteText = document.getElementById("label-overwrite-text")!;

// DOM Elements: Queue & Footer
const labelQueueTitle = document.getElementById("label-queue-title")!;
const badgeFileCount = document.getElementById("badge-file-count")!;
const btnClearAll = document.getElementById("btn-clear-all") as HTMLButtonElement;
const labelClearAll = document.getElementById("label-clear-all")!;
const clearIcon = document.getElementById("clear-icon")!;
const fileList = document.getElementById("file-list")!;
const emptyState = document.getElementById("empty-state")!;

const footerStatus = document.getElementById("footer-status")!;
const footerSavings = document.getElementById("footer-savings")!;
const progressBar = document.getElementById("progress-bar")!;
const btnOpenLastFolder = document.getElementById("btn-open-last-folder")!;
const iconOpenLast = document.getElementById("icon-open-last")!;
const labelOpenLastBtn = document.getElementById("label-open-last-btn")!;
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnStartIcon = document.getElementById("btn-start-icon")!;
const labelStartBtn = document.getElementById("label-start-btn")!;

// Setup SVGs
function setupIcons() {
  if (brandLogo) brandLogo.innerHTML = icons.logo;
  if (btnMinimize) btnMinimize.innerHTML = icons.winMinimize;
  if (btnMaximize) btnMaximize.innerHTML = icons.winMaximize;
  if (btnClose) btnClose.innerHTML = icons.winClose;

  dropIcon.innerHTML = icons.dropZone;
  btnBrowseIcon.innerHTML = icons.image;
  btnFolderIcon.innerHTML = icons.folder;

  iconCompactDrop.innerHTML = icons.dropZone;
  iconCompactBrowse.innerHTML = icons.plus;
  iconCompactFolder.innerHTML = icons.folder;

  if (iconPresetHeader) iconPresetHeader.innerHTML = icons.tune;
  if (iconPresetDelete) iconPresetDelete.innerHTML = icons.trash;
  if (iconPresetAdd) iconPresetAdd.innerHTML = icons.plus;
  if (iconPresetSelectChevron) iconPresetSelectChevron.innerHTML = icons.chevronDown;

  iconFormatHeader.innerHTML = icons.sparkles;
  iconResizeHeader.innerHTML = icons.expand;
  iconDestHeader.innerHTML = icons.folder;

  chevronFormat.innerHTML = icons.chevronDown;
  chevronResize.innerHTML = icons.chevronDown;
  chevronDest.innerHTML = icons.chevronDown;

  iconLockAspect.innerHTML = isAspectRatioLocked ? icons.link : icons.unlink;
  if (iconResetDimensions) iconResetDimensions.innerHTML = icons.reset;
  iconFolderBrowse.innerHTML = icons.folderOpen;
  clearIcon.innerHTML = icons.trash;
  iconOpenLast.innerHTML = icons.folderOpen;
  btnStartIcon.innerHTML = icons.sparkles;

  if (iconSettings) iconSettings.innerHTML = icons.gear;
  if (iconModalSettings) iconModalSettings.innerHTML = icons.gear;
  if (iconAboutLogo) iconAboutLogo.innerHTML = icons.logo;
}

// Summary Badges
function updateSummaryBadges() {
  // 1. Format Badge
  if (targetSizeEnabled) {
    badgeSummaryFormat.textContent = `${selectedFormat.toUpperCase()} • Max ${targetSizeVal} ${targetSizeUnit.toUpperCase()}`;
  } else {
    badgeSummaryFormat.textContent = `${selectedFormat.toUpperCase()} • ${qualityVal}%`;
  }

  // 2. Resize Badge
  if (selectedResizeMode === "original") {
    badgeSummaryResize.textContent = t("resizeOriginal");
  } else if (selectedResizeMode === "custom") {
    badgeSummaryResize.textContent = `${selectedFitMode.toUpperCase()} ${customWidth}×${customHeight}`;
  } else if (selectedResizeMode === "scale") {
    badgeSummaryResize.textContent = `Scale ${scaleVal}%`;
  }

  // 3. Destination Badge
  if (saveSameFolder) {
    badgeSummaryDest.textContent = t("sameFolderBadge");
  } else {
    if (customOutputDir) {
      const parts = customOutputDir.split(/[\\/]/).filter(Boolean);
      badgeSummaryDest.textContent = parts.length > 0 ? parts[parts.length - 1] : t("customFolderBadge");
    } else {
      badgeSummaryDest.textContent = t("customFolderBadge");
    }
  }
}

// Adaptive Dropzone Header (expands when empty, compact banner when items loaded)
function updateAdaptiveHeader() {
  if (filesQueue.length === 0) {
    dropZoneHero.classList.remove("hidden");
    dropZoneCompact.classList.add("hidden");
    dropZoneCompact.classList.remove("flex");
  } else {
    dropZoneHero.classList.add("hidden");
    dropZoneCompact.classList.remove("hidden");
    dropZoneCompact.classList.add("flex");
  }
}

function updateLanguage(lang: Language) {
  currentLang = lang;
  appSettings.lang = lang;
  if (lang === "en") {
    langEnBtn?.classList.add("active");
    langFrBtn?.classList.remove("active");
  } else {
    langFrBtn?.classList.add("active");
    langEnBtn?.classList.remove("active");
  }

  // Windows tooltips
  if (btnMinimize) btnMinimize.title = t("winMinimize");
  if (btnMaximize) btnMaximize.title = isMaximized ? t("winRestore") : t("winMaximize");
  if (btnClose) btnClose.title = t("winClose");

  dropTitle.textContent = t("dropTitle");
  dropSubtitle.textContent = t("dropSubtitle");
  labelBrowseFiles.textContent = t("browseFiles");
  labelBrowseFolder.textContent = t("browseFolder");

  labelCompactDrop.textContent = t("dropCompactHint");
  labelCompactBrowseFiles.textContent = t("addFilesCompact");
  labelCompactBrowseFolder.textContent = t("addFolderCompact");

  if (titleModalPreset) titleModalPreset.textContent = t("presetModalTitle");
  if (descModalPreset) descModalPreset.textContent = t("presetModalDesc");
  if (inputPresetName) inputPresetName.placeholder = t("presetModalPlaceholder");
  if (labelModalPresetPreview) labelModalPresetPreview.textContent = t("presetModalPreview");
  if (btnCancelPresetSave) btnCancelPresetSave.textContent = t("presetModalCancel");
  if (btnConfirmPresetSave) btnConfirmPresetSave.textContent = t("presetModalSave");

  if (labelPresetHeader) labelPresetHeader.textContent = t("presetLabel");
  if (labelPresetAdd) labelPresetAdd.textContent = t("presetSaveBtn");
  if (btnPresetAdd) btnPresetAdd.title = t("presetChipAddTitle");
  if (btnPresetDelete) btnPresetDelete.title = t("presetDeleteBtn");
  renderPresetSelector();

  // Settings Modal labels
  if (btnOpenSettings) btnOpenSettings.title = t("settingsTitle");
  if (titleModalSettings) titleModalSettings.textContent = t("settingsTitle");
  if (labelSettingsLang) labelSettingsLang.textContent = t("settingsLangTitle");
  if (langFrBtn) langFrBtn.textContent = t("settingsLangFr");
  if (langEnBtn) langEnBtn.textContent = t("settingsLangEn");
  if (labelSettingsAppearance) labelSettingsAppearance.textContent = t("settingsAppearance");
  if (themeBtnDark) themeBtnDark.textContent = t("settingsThemeDark");
  if (themeBtnLight) themeBtnLight.textContent = t("settingsThemeLight");
  if (themeBtnSystem) themeBtnSystem.textContent = t("settingsThemeSystem");
  if (labelSettingsPrivacyTitle) labelSettingsPrivacyTitle.textContent = t("settingsPrivacyTitle");
  if (labelSettingsStripExif) labelSettingsStripExif.textContent = t("settingsStripExif");
  if (labelSettingsFilesTitle) labelSettingsFilesTitle.textContent = t("settingsFilesTitle");
  if (labelSettingsSuffixDesc) labelSettingsSuffixDesc.textContent = t("settingsDefaultSuffixDesc");
  if (labelSettingsAboutDesc) labelSettingsAboutDesc.textContent = t("settingsAboutDesc");
  if (btnDoneSettings) btnDoneSettings.textContent = t("settingsCloseBtn");

  labelFormatHeader.textContent = t("sectionFormat");
  labelResizeHeader.textContent = t("sectionResize");
  labelDestHeader.textContent = t("sectionDest");

  labelOutputFormat.textContent = t("outputFormat");
  labelQuality.textContent = t("quality");
  labelTargetSize.textContent = t("targetSize");
  targetSizeDesc.textContent = t("targetSizeDesc");

  labelResizeMode.textContent = t("resizeMode");
  const pillOrig = resizeModePills.querySelector('[data-mode="original"]');
  const pillCustom = resizeModePills.querySelector('[data-mode="custom"]');
  const pillScale = resizeModePills.querySelector('[data-mode="scale"]');
  if (pillOrig) pillOrig.textContent = t("resizeOriginal");
  if (pillCustom) pillCustom.textContent = t("resizeCustom");
  if (pillScale) pillScale.textContent = t("resizeScale");

  labelCustomW.textContent = `${t("widthLabel")} :`;
  labelCustomH.textContent = `${t("heightLabel")} :`;
  labelFitMode.textContent = `${t("fitModeLabel")}:`;

  const pillFit = fitModePills.querySelector('[data-fit="fit"]');
  const pillFill = fitModePills.querySelector('[data-fit="fill"]');
  const pillStretch = fitModePills.querySelector('[data-fit="stretch"]');
  if (pillFit) pillFit.textContent = t("fitContain");
  if (pillFill) pillFill.textContent = t("fitFill");
  if (pillStretch) pillStretch.textContent = t("fitStretch");

  labelNoUpscale.textContent = t("noUpscale");
  btnLockAspect.title = isAspectRatioLocked ? t("aspectRatioLock") : t("aspectRatioUnlock");
  if (btnResetDimensions) btnResetDimensions.title = t("resetDimensions");

  labelSameFolder.textContent = t("saveSameFolderToggle");
  descSameFolder.textContent = saveSameFolder ? t("sameFolderDesc") : t("customFolderDesc");
  inputCustomFolderPath.placeholder = t("customFolderPlaceholder");
  labelBrowseDestBtn.textContent = t("browseFolderBtn");
  labelSuffixText.textContent = t("fileSuffix") + ":";
  labelOverwriteText.textContent = t("overwriteSource");

  labelQueueTitle.textContent = t("fileQueue");
  labelClearAll.textContent = t("clearQueue");
  labelOpenLastBtn.textContent = t("openOutputFolder");
  labelStartBtn.textContent = isProcessing ? t("compressing") : t("startCompression");

  updateSummaryBadges();
  updateFooterMetrics();
  renderFileList();
}

function updateFooterMetrics() {
  const count = filesQueue.length;
  badgeFileCount.textContent = `${count} ${t("filesSelected")}`;
  btnClearAll.disabled = count === 0 || isProcessing;
  btnStart.disabled = count === 0 || isProcessing;

  if (count === 0) {
    footerStatus.textContent = t("statusPending");
    footerSavings.classList.add("hidden");
    progressBar.style.width = "0%";
    btnOpenLastFolder.classList.add("hidden");
    btnOpenLastFolder.classList.remove("flex");
    return;
  }

  let totalOriginal = 0;
  let totalNew = 0;
  let finishedCount = 0;
  let allTotalOriginal = 0;

  for (const item of filesQueue) {
    allTotalOriginal += (item.size || 0);
    if (item.status === "success" && typeof item.newSize === "number" && !isNaN(item.newSize)) {
      totalOriginal += (item.size || 0);
      totalNew += item.newSize;
      finishedCount++;
    }
  }

  if (finishedCount > 0 && totalOriginal > 0) {
    const diff = totalOriginal - totalNew; // positive: saved, negative: size increased
    const absDiff = Math.abs(diff);
    const pct = Math.round((absDiff / totalOriginal) * 100);

    if (diff > 0) {
      footerSavings.textContent = `${t("totalSaved")}: ${formatBytes(absDiff)} (-${pct}%)`;
      footerSavings.className = "text-xs font-semibold text-emerald-400";
    } else if (diff < 0) {
      footerSavings.textContent = `${t("sizeIncreased")}: +${formatBytes(absDiff)} (+${pct}%)`;
      footerSavings.className = "text-xs font-semibold text-amber-400";
    } else {
      footerSavings.textContent = `${t("sizeIdentical")} (0%)`;
      footerSavings.className = "text-xs font-semibold text-zinc-400";
    }
    footerSavings.classList.remove("hidden");
  } else {
    footerSavings.classList.add("hidden");
  }

  if (isProcessing) {
    footerStatus.textContent = `${t("compressing")} (${finishedCount}/${count})`;
    const pct = Math.round((finishedCount / count) * 100);
    progressBar.style.width = `${pct}%`;
    btnOpenLastFolder.classList.add("hidden");
    btnOpenLastFolder.classList.remove("flex");
  } else if (finishedCount === count && count > 0) {
    footerStatus.textContent = t("completed");
    progressBar.style.width = "100%";
    const outPath =
      lastBatchOutputPath ||
      filesQueue.find(f => f.outputPath)?.outputPath ||
      (!saveSameFolder && customOutputDir ? customOutputDir : null);
    if (outPath) {
      lastBatchOutputPath = outPath;
      btnOpenLastFolder.classList.remove("hidden");
      btnOpenLastFolder.classList.add("flex");
    }
  } else {
    footerStatus.textContent = `${count} ${t("filesSelected")} • ${formatBytes(allTotalOriginal)}`;
  }
}

// Render File Queue
function renderFileList() {
  updateAdaptiveHeader();

  if (filesQueue.length === 0) {
    emptyState.classList.remove("hidden");
    fileList.innerHTML = "";
    fileList.appendChild(emptyState);
    return;
  }

  emptyState.classList.add("hidden");
  fileList.innerHTML = "";

  filesQueue.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.04] transition-colors gap-3";

    // Left: Icon + Name + Info
    const left = document.createElement("div");
    left.className = "flex items-center gap-3 min-w-0 flex-1";

    const iconBox = document.createElement("div");
    iconBox.className = "w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-400 shrink-0 border border-white/[0.05]";
    iconBox.innerHTML = icons.image;

    const infoBox = document.createElement("div");
    infoBox.className = "flex flex-col min-w-0";

    const nameLine = document.createElement("div");
    nameLine.className = "flex items-center gap-2";

    const nameText = document.createElement("span");
    nameText.className = "text-xs font-medium text-white truncate max-w-[200px] sm:max-w-[320px]";
    nameText.textContent = item.name;

    const formatBadge = document.createElement("span");
    formatBadge.className = "text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/[0.04] uppercase";
    formatBadge.textContent = `${item.format} ➔ ${selectedFormat}`;

    nameLine.appendChild(nameText);
    nameLine.appendChild(formatBadge);

    const dimLine = document.createElement("span");
    dimLine.className = "text-[11px] text-zinc-400 mt-0.5";
    if (item.width && item.height) {
      dimLine.textContent = `${item.width} × ${item.height} px • ${formatBytes(item.size)}`;
    } else {
      dimLine.textContent = formatBytes(item.size);
    }

    infoBox.appendChild(nameLine);
    infoBox.appendChild(dimLine);

    if (item.status === "error" && item.error) {
      const errLine = document.createElement("div");
      errLine.className = "flex items-center gap-1.5 text-[11px] text-rose-400 mt-1 truncate max-w-[280px] sm:max-w-[420px]";
      errLine.title = item.error;
      errLine.innerHTML = `<span class="shrink-0 font-medium">⚠️</span> <span class="truncate">${item.error}</span>`;
      infoBox.appendChild(errLine);
    }

    left.appendChild(iconBox);
    left.appendChild(infoBox);

    // Right: Status & Size Comparison & Actions
    const right = document.createElement("div");
    right.className = "flex items-center gap-3 shrink-0";

    if (item.status === "success" && typeof item.newSize === "number" && !isNaN(item.newSize)) {
      const diff = item.size - item.newSize;
      const absDiff = Math.abs(diff);
      const pct = item.size > 0 ? Math.round((absDiff / item.size) * 100) : 0;
      const isPositive = diff >= 0;

      // Check if dimensions changed
      const hasDimChange =
        Boolean(item.width &&
        item.height &&
        item.outputWidth &&
        item.outputHeight &&
        (item.width !== item.outputWidth || item.height !== item.outputHeight));

      const dimHtml = hasDimChange
        ? `<div class="text-[10px] font-mono font-medium text-zinc-400">
             ${item.width}×${item.height} ➔ <span class="text-white">${item.outputWidth}×${item.outputHeight} px</span>
           </div>`
        : "";

      const sizeDisplay = document.createElement("div");
      sizeDisplay.className = "text-right flex flex-col items-end";
      sizeDisplay.innerHTML = `
        ${dimHtml}
        <div class="text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}">
          ${formatBytes(item.size)} ➔ ${formatBytes(item.newSize)}
        </div>
        <div class="text-[10px] font-medium ${isPositive ? 'text-emerald-500' : 'text-amber-500'}">
          ${diff === 0 ? '0%' : (isPositive ? `-${pct}%` : `+${pct}%`)}
        </div>
      `;
      right.appendChild(sizeDisplay);

      if (item.outputPath) {
        const btnOpen = document.createElement("button");
        btnOpen.type = "button";
        btnOpen.className = "p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 transition-colors cursor-pointer";
        btnOpen.title = t("openFileFolder");
        btnOpen.innerHTML = icons.folderOpen;
        const outPath = item.outputPath;
        btnOpen.addEventListener("click", (e) => {
          e.stopPropagation();
          revealFolder(outPath);
        });
        right.appendChild(btnOpen);
      }
    } else if (item.status === "processing") {
      const spinnerBox = document.createElement("div");
      spinnerBox.className = "flex items-center gap-1.5 text-xs text-blue-400";
      spinnerBox.innerHTML = `${icons.spinner} <span>${t("statusProcessing")}</span>`;
      right.appendChild(spinnerBox);
    } else if (item.status === "error") {
      const errBox = document.createElement("div");
      errBox.className = "flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg cursor-help transition-colors hover:bg-rose-500/20";
      errBox.innerHTML = `${icons.error} <span>${t("statusError")}</span>`;
      if (item.error) errBox.title = item.error;
      right.appendChild(errBox);

      const btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "text-zinc-400 hover:text-rose-400 p-1 transition-colors cursor-pointer";
      btnRemove.title = t("clearQueue");
      btnRemove.innerHTML = "✕";
      btnRemove.onclick = (e) => {
        e.stopPropagation();
        filesQueue.splice(index, 1);
        renderFileList();
        updateFooterMetrics();
      };
      right.appendChild(btnRemove);
    } else {
      const statusPill = document.createElement("span");
      statusPill.className = "text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-medium";
      statusPill.textContent = t("statusPending");
      right.appendChild(statusPill);

      const btnRemove = document.createElement("button");
      btnRemove.type = "button";
      btnRemove.className = "text-zinc-400 hover:text-rose-400 p-1 transition-colors cursor-pointer";
      btnRemove.innerHTML = "✕";
      btnRemove.onclick = (e) => {
        e.stopPropagation();
        filesQueue.splice(index, 1);
        renderFileList();
        updateFooterMetrics();
      };
      right.appendChild(btnRemove);
    }

    row.appendChild(left);
    row.appendChild(right);
    fileList.appendChild(row);
  });
}

// Add files & directories handler
async function handlePaths(paths: string[]) {
  if (!paths || paths.length === 0) return;
  try {
    const scanned: ImageItem[] = await invoke("scan_paths", { paths });
    for (const item of scanned) {
      if (!filesQueue.some(f => f.path === item.path)) {
        filesQueue.push(item);
      }
    }

    // Suggest dimensions only if user hasn't modified them or if inputs were empty
    const firstWithDim = filesQueue.find(f => f.width && f.height && f.width > 0 && f.height > 0);
    if (firstWithDim && firstWithDim.width && firstWithDim.height) {
      const inputsEmpty = !inputCustomWidth.value.trim() || !inputCustomHeight.value.trim();

      if (!userHasModifiedDimensions || inputsEmpty) {
        customWidth = firstWithDim.width;
        customHeight = firstWithDim.height;
        aspectRatio = customWidth / customHeight;
        if (inputCustomWidth && inputCustomHeight) {
          inputCustomWidth.value = customWidth.toString();
          inputCustomHeight.value = customHeight.toString();
        }
      } else {
        // User already customized dimensions: preserve them strictly!
        if (customWidth > 0 && customHeight > 0) {
          aspectRatio = customWidth / customHeight;
        }
      }
    }

    renderFileList();
    updateFooterMetrics();
    updateSummaryBadges();
  } catch (err) {
    console.error("Failed to scan paths:", err);
  }
}

// Local Storage Session Persistence
interface UserPreferences {
  lang?: Language;
  activePresetId?: string | null;
  format?: string;
  quality?: number;
  targetSizeEnabled?: boolean;
  targetSizeVal?: number;
  targetSizeUnit?: "kb" | "mb";
  resizeMode?: "original" | "custom" | "scale";
  customWidth?: number;
  customHeight?: number;
  isAspectRatioLocked?: boolean;
  fitMode?: "fit" | "fill" | "stretch";
  noUpscale?: boolean;
  scaleVal?: number;
  saveSameFolder?: boolean;
  customOutputDir?: string | null;
  fileSuffix?: string;
  overwriteSource?: boolean;
  userHasModifiedDimensions?: boolean;
  collapsedSections?: {
    format?: boolean;
    resize?: boolean;
    dest?: boolean;
  };
}

const PREFERENCES_STORAGE_KEY = "shrinkr_user_preferences";

function savePreferences() {
  try {
    const prefs: UserPreferences = {
      lang: currentLang,
      activePresetId,
      format: selectedFormat,
      quality: qualityVal,
      targetSizeEnabled,
      targetSizeVal,
      targetSizeUnit,
      resizeMode: selectedResizeMode,
      customWidth,
      customHeight,
      isAspectRatioLocked,
      fitMode: selectedFitMode,
      noUpscale: noUpscaleVal,
      scaleVal,
      saveSameFolder,
      customOutputDir,
      fileSuffix: fileSuffixVal,
      overwriteSource: overwriteSourceVal,
      userHasModifiedDimensions,
      collapsedSections: {
        format: document.getElementById("section-format")?.classList.contains("collapsed") ?? true,
        resize: document.getElementById("section-resize")?.classList.contains("collapsed") ?? true,
        dest: document.getElementById("section-dest")?.classList.contains("collapsed") ?? true,
      },
    };
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("Could not save preferences to localStorage:", err);
  }
}

function loadPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return;
    const prefs: UserPreferences = JSON.parse(raw);

    if (prefs.lang === "en" || prefs.lang === "fr") {
      currentLang = prefs.lang;
    }

    if (typeof prefs.activePresetId !== "undefined") {
      activePresetId = prefs.activePresetId;
    }

    if (prefs.format && ["jpg", "png", "webp", "avif"].includes(prefs.format)) {
      selectedFormat = prefs.format;
      formatPills?.querySelectorAll("[data-format]").forEach(p => {
        p.classList.toggle("active", (p as HTMLElement).dataset.format === selectedFormat);
      });
    }

    if (typeof prefs.quality === "number" && prefs.quality >= 5 && prefs.quality <= 100) {
      qualityVal = prefs.quality;
      if (inputQuality) inputQuality.value = qualityVal.toString();
      if (qualityValText) qualityValText.textContent = `${qualityVal}%`;
    }

    if (typeof prefs.targetSizeEnabled === "boolean") {
      targetSizeEnabled = prefs.targetSizeEnabled;
      targetSizeToggle?.classList.toggle("active", targetSizeEnabled);
      targetSizeToggle?.setAttribute("aria-checked", targetSizeEnabled.toString());
      if (targetSizeInputs) {
        if (targetSizeEnabled) {
          targetSizeInputs.classList.remove("opacity-40", "pointer-events-none");
        } else {
          targetSizeInputs.classList.add("opacity-40", "pointer-events-none");
        }
      }
    }

    if (typeof prefs.targetSizeVal === "number" && prefs.targetSizeVal > 0) {
      targetSizeVal = prefs.targetSizeVal;
      if (inputTargetSize) inputTargetSize.value = targetSizeVal.toString();
    }

    if (prefs.targetSizeUnit === "kb" || prefs.targetSizeUnit === "mb") {
      targetSizeUnit = prefs.targetSizeUnit;
      unitPills?.querySelectorAll("[data-unit]").forEach(p => {
        p.classList.toggle("active", (p as HTMLElement).dataset.unit === targetSizeUnit);
      });
    }

    if (prefs.resizeMode && ["original", "custom", "scale"].includes(prefs.resizeMode)) {
      selectedResizeMode = prefs.resizeMode;
      resizeModePills?.querySelectorAll("[data-mode]").forEach(p => {
        p.classList.toggle("active", (p as HTMLElement).dataset.mode === selectedResizeMode);
      });

      if (panelResizeCustom && panelResizeScale) {
        if (selectedResizeMode === "original") {
          panelResizeCustom.classList.add("hidden");
          panelResizeCustom.classList.remove("flex");
          panelResizeScale.classList.add("hidden");
          panelResizeScale.classList.remove("flex");
        } else if (selectedResizeMode === "custom") {
          panelResizeCustom.classList.remove("hidden");
          panelResizeCustom.classList.add("flex");
          panelResizeScale.classList.add("hidden");
          panelResizeScale.classList.remove("flex");
        } else if (selectedResizeMode === "scale") {
          panelResizeScale.classList.remove("hidden");
          panelResizeScale.classList.add("flex");
          panelResizeCustom.classList.add("hidden");
          panelResizeCustom.classList.remove("flex");
        }
      }
    }

    if (typeof prefs.customWidth === "number" && prefs.customWidth > 0) {
      customWidth = prefs.customWidth;
      if (inputCustomWidth) inputCustomWidth.value = customWidth.toString();
    }
    if (typeof prefs.customHeight === "number" && prefs.customHeight > 0) {
      customHeight = prefs.customHeight;
      if (inputCustomHeight) inputCustomHeight.value = customHeight.toString();
    }
    if (customWidth > 0 && customHeight > 0) {
      aspectRatio = customWidth / customHeight;
    }

    if (typeof prefs.isAspectRatioLocked === "boolean") {
      isAspectRatioLocked = prefs.isAspectRatioLocked;
      btnLockAspect?.classList.toggle("active", isAspectRatioLocked);
      if (iconLockAspect) {
        iconLockAspect.innerHTML = isAspectRatioLocked ? icons.link : icons.unlink;
      }
    }

    if (prefs.fitMode && ["fit", "fill", "stretch"].includes(prefs.fitMode)) {
      selectedFitMode = prefs.fitMode;
      fitModePills?.querySelectorAll("[data-fit]").forEach(p => {
        p.classList.toggle("active", (p as HTMLElement).dataset.fit === selectedFitMode);
      });
    }

    if (typeof prefs.noUpscale === "boolean") {
      noUpscaleVal = prefs.noUpscale;
      if (checkNoUpscale) checkNoUpscale.checked = noUpscaleVal;
    }

    if (typeof prefs.scaleVal === "number" && prefs.scaleVal > 0) {
      scaleVal = prefs.scaleVal;
      if (inputScalePercent) inputScalePercent.value = scaleVal.toString();
      scalePresets?.querySelectorAll("[data-scale]").forEach(p => {
        p.classList.toggle("border-blue-500/40", (p as HTMLElement).dataset.scale === scaleVal.toString());
      });
    }

    if (typeof prefs.saveSameFolder === "boolean") {
      saveSameFolder = prefs.saveSameFolder;
      toggleSameFolder?.classList.toggle("active", saveSameFolder);
      toggleSameFolder?.setAttribute("aria-checked", saveSameFolder.toString());

      if (rowCustomFolder) {
        if (saveSameFolder) {
          rowCustomFolder.classList.add("hidden");
          rowCustomFolder.classList.remove("flex");
        } else {
          rowCustomFolder.classList.remove("hidden");
          rowCustomFolder.classList.add("flex");
        }
      }
    }

    if (typeof prefs.customOutputDir === "string") {
      customOutputDir = prefs.customOutputDir;
      if (inputCustomFolderPath) inputCustomFolderPath.value = customOutputDir || "";
    }

    if (typeof prefs.fileSuffix === "string") {
      fileSuffixVal = prefs.fileSuffix;
      if (inputSuffixText) inputSuffixText.value = fileSuffixVal;
    }

    if (typeof prefs.overwriteSource === "boolean") {
      overwriteSourceVal = prefs.overwriteSource;
      if (checkOverwrite) checkOverwrite.checked = overwriteSourceVal;
    }

    if (typeof prefs.userHasModifiedDimensions === "boolean") {
      userHasModifiedDimensions = prefs.userHasModifiedDimensions;
    }

    if (prefs.collapsedSections) {
      if (typeof prefs.collapsedSections.format === "boolean") {
        document.getElementById("section-format")?.classList.toggle("collapsed", prefs.collapsedSections.format);
      }
      if (typeof prefs.collapsedSections.resize === "boolean") {
        document.getElementById("section-resize")?.classList.toggle("collapsed", prefs.collapsedSections.resize);
      }
      if (typeof prefs.collapsedSections.dest === "boolean") {
        document.getElementById("section-dest")?.classList.toggle("collapsed", prefs.collapsedSections.dest);
      }
    }
  } catch (err) {
    console.warn("Could not load preferences from localStorage:", err);
  }
}

// Preset Technical Formatter & Helpers
export function getActiveSettings() {
  return {
    format: selectedFormat,
    quality: qualityVal,
    targetSizeEnabled,
    targetSizeVal,
    targetSizeUnit,
    resizeMode: selectedResizeMode,
    customWidth,
    customHeight,
    fitMode: selectedFitMode,
    scaleVal,
  };
}

export function formatPresetTechnicalDetails(
  settings: {
    format: string;
    quality: number;
    targetSizeEnabled: boolean;
    targetSizeVal?: number;
    targetSizeUnit?: "kb" | "mb";
    resizeMode: "original" | "custom" | "scale";
    customWidth?: number;
    customHeight?: number;
    fitMode?: "fit" | "fill" | "stretch";
    scaleVal?: number;
  },
  lang: Language = currentLang
): string {
  // 1. Format de sortie (JPG, PNG, WEBP, AVIF)
  const fmt = settings.format.toUpperCase();

  // 2. Redimensionnement
  let resizeDesc = "";
  if (settings.resizeMode === "original") {
    resizeDesc = lang === "fr" ? "taille source" : "Orig. Size";
  } else if (settings.resizeMode === "scale") {
    const s = settings.scaleVal ?? 75;
    resizeDesc = `${s}%`;
  } else {
    // Custom
    const w = settings.customWidth || 1920;
    const h = settings.customHeight || 1080;
    const fit = settings.fitMode || "fit";

    // Notation standard de hauteur si applicable (1080p, 2160p, 720p, 1200p, etc.)
    let dimStr = `${w}×${h}`;
    if (
      (w === 1920 && h === 1080) ||
      (w === 3840 && h === 2160) ||
      (w === 1280 && h === 720) ||
      (w === 2560 && h === 1440) ||
      (w / h >= 1.5 && [480, 720, 900, 1080, 1200, 1440, 2160].includes(h))
    ) {
      dimStr = `${h}p`;
    }

    if (fit === "fit") {
      resizeDesc = lang === "fr" ? `${dimStr} ajusté` : `${dimStr} Fit`;
    } else if (fit === "fill") {
      resizeDesc = lang === "fr" ? `${w}×${h} rempli` : `${w}×${h} Fill`;
    } else if (fit === "stretch") {
      resizeDesc = lang === "fr" ? `${w}×${h} étiré` : `${w}×${h} Stretch`;
    } else {
      resizeDesc = dimStr;
    }
  }

  // 3. Compression
  let compDesc = "";
  if (settings.targetSizeEnabled) {
    const size = settings.targetSizeVal || 500;
    const unit = settings.targetSizeUnit || "kb";
    if (lang === "fr") {
      const unitStr = unit === "mb" ? "Mo" : "Ko";
      compDesc = `max ${size} ${unitStr}`;
    } else {
      const unitStr = unit.toUpperCase();
      compDesc = `Max ${size} ${unitStr}`;
    }
  } else {
    compDesc = `${settings.quality || 82}%`;
  }

  return `${fmt} • ${resizeDesc} • ${compDesc}`;
}

// Preset Logic & Handlers
function loadPresets() {
  try {
    const raw = localStorage.getItem("shrinkr_presets");
    if (raw) {
      userPresets = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to load user presets:", e);
  }

  const savedActiveId = localStorage.getItem("shrinkr_active_preset");
  if (savedActiveId) {
    activePresetId = savedActiveId;
  }
}

function updateDeleteButtonVisibility() {
  if (!btnPresetDelete) return;
  const isUserPresetActive = activePresetId !== null && userPresets.some(p => p.id === activePresetId);
  if (isUserPresetActive) {
    btnPresetDelete.classList.remove("hidden");
    btnPresetDelete.classList.add("flex");
  } else {
    btnPresetDelete.classList.add("hidden");
    btnPresetDelete.classList.remove("flex");
  }
}

function deleteUserPreset(id: string) {
  const idx = userPresets.findIndex(p => p.id === id);
  if (idx !== -1) {
    userPresets.splice(idx, 1);
    try {
      localStorage.setItem("shrinkr_presets", JSON.stringify(userPresets));
    } catch (_) {}
    if (activePresetId === id) {
      activePresetId = BUILT_IN_PRESETS[0].id;
      try {
        localStorage.setItem("shrinkr_active_preset", activePresetId);
      } catch (_) {}
      applyPreset(BUILT_IN_PRESETS[0]);
    } else {
      renderPresetSelector();
    }
  }
}

function renderPresetSelector() {
  if (!presetSelect) return;
  presetSelect.innerHTML = "";

  // 1. User Custom Presets (OptGroup)
  if (userPresets.length > 0) {
    const userGroup = document.createElement("optgroup");
    userGroup.label = t("presetCustomGroup");
    for (const p of userPresets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      const parts = p.name.split(" — ");
      const title = parts[0].trim();
      const specs = parts[1] ? parts[1].trim() : formatPresetTechnicalDetails(p, currentLang);
      opt.textContent = `⭐ ${title} — ${specs}`;
      userGroup.appendChild(opt);
    }
    presetSelect.appendChild(userGroup);
  }

  // 2. Built-in Recommended Presets (OptGroup)
  const builtInGroup = document.createElement("optgroup");
  builtInGroup.label = t("presetRecommendedGroup");
  for (const p of BUILT_IN_PRESETS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.nameKey ? t(p.nameKey) : (p.titleKey ? `${t(p.titleKey)} — ${formatPresetTechnicalDetails(p, currentLang)}` : p.name);
    builtInGroup.appendChild(opt);
  }
  presetSelect.appendChild(builtInGroup);

  // 3. Custom / Modified Option (shown when manual settings deviate)
  const customOpt = document.createElement("option");
  customOpt.value = "custom";
  customOpt.textContent = t("presetCustomOption");
  customOpt.disabled = true;
  presetSelect.appendChild(customOpt);

  // Set selected value
  if (activePresetId && (userPresets.some(p => p.id === activePresetId) || BUILT_IN_PRESETS.some(p => p.id === activePresetId))) {
    presetSelect.value = activePresetId;
  } else {
    presetSelect.value = "custom";
  }

  // Update delete button visibility for active user preset
  updateDeleteButtonVisibility();
}

function applyPreset(preset: Preset) {
  activePresetId = preset.id;
  try {
    localStorage.setItem("shrinkr_active_preset", preset.id);
  } catch (_) {}

  // 1. Format
  selectedFormat = preset.format;
  formatPills.querySelectorAll("[data-format]").forEach(p => {
    p.classList.toggle("active", (p as HTMLElement).dataset.format === selectedFormat);
  });

  // 2. Quality
  qualityVal = preset.quality;
  inputQuality.value = qualityVal.toString();
  qualityValText.textContent = `${qualityVal}%`;

  // 3. Target Size
  targetSizeEnabled = preset.targetSizeEnabled;
  targetSizeToggle.classList.toggle("active", targetSizeEnabled);
  targetSizeToggle.setAttribute("aria-checked", targetSizeEnabled.toString());
  if (targetSizeEnabled) {
    targetSizeInputs.classList.remove("opacity-40", "pointer-events-none");
  } else {
    targetSizeInputs.classList.add("opacity-40", "pointer-events-none");
  }
  if (preset.targetSizeVal) {
    targetSizeVal = preset.targetSizeVal;
    inputTargetSize.value = targetSizeVal.toString();
  }
  if (preset.targetSizeUnit) {
    targetSizeUnit = preset.targetSizeUnit;
    unitPills.querySelectorAll("[data-unit]").forEach(p => {
      p.classList.toggle("active", (p as HTMLElement).dataset.unit === targetSizeUnit);
    });
  }

  // 4. Resize Mode
  selectedResizeMode = preset.resizeMode;
  resizeModePills.querySelectorAll("[data-mode]").forEach(p => {
    p.classList.toggle("active", (p as HTMLElement).dataset.mode === selectedResizeMode);
  });

  if (selectedResizeMode === "original") {
    panelResizeCustom.classList.add("hidden");
    panelResizeCustom.classList.remove("flex");
    panelResizeScale.classList.add("hidden");
    panelResizeScale.classList.remove("flex");
  } else if (selectedResizeMode === "custom") {
    panelResizeCustom.classList.remove("hidden");
    panelResizeCustom.classList.add("flex");
    panelResizeScale.classList.add("hidden");
    panelResizeScale.classList.remove("flex");

    if (typeof preset.customWidth === "number") {
      customWidth = preset.customWidth;
      inputCustomWidth.value = customWidth.toString();
    }
    if (typeof preset.customHeight === "number") {
      customHeight = preset.customHeight;
      inputCustomHeight.value = customHeight.toString();
    }
    if (customWidth > 0 && customHeight > 0) {
      aspectRatio = customWidth / customHeight;
    }

    if (preset.fitMode) {
      selectedFitMode = preset.fitMode;
      fitModePills.querySelectorAll("[data-fit]").forEach(p => {
        p.classList.toggle("active", (p as HTMLElement).dataset.fit === selectedFitMode);
      });
    }

    if (typeof preset.noUpscale === "boolean") {
      noUpscaleVal = preset.noUpscale;
      checkNoUpscale.checked = noUpscaleVal;
    }
    userHasModifiedDimensions = true;
  } else if (selectedResizeMode === "scale") {
    panelResizeScale.classList.remove("hidden");
    panelResizeScale.classList.add("flex");
    panelResizeCustom.classList.add("hidden");
    panelResizeCustom.classList.remove("flex");

    if (typeof preset.scaleVal === "number") {
      scaleVal = preset.scaleVal;
      inputScalePercent.value = scaleVal.toString();
    }
    userHasModifiedDimensions = true;
  }

  renderPresetSelector();
  updateSummaryBadges();
  renderFileList();
  savePreferences();
}

function markPresetCustom() {
  if (activePresetId !== null) {
    activePresetId = null;
    try {
      localStorage.removeItem("shrinkr_active_preset");
    } catch (_) {}
    if (presetSelect) presetSelect.value = "custom";
    updateDeleteButtonVisibility();
  }
}

// Setup Event Listeners
function setupEvents() {
  const appWindow = getCurrentWindow();

  // Windows 11 Fluent Caption Buttons
  btnMinimize?.addEventListener("click", () => {
    appWindow.minimize();
  });

  btnMaximize?.addEventListener("click", async () => {
    await appWindow.toggleMaximize();
    isMaximized = await appWindow.isMaximized();
    if (btnMaximize) {
      btnMaximize.innerHTML = isMaximized ? icons.winRestore : icons.winMaximize;
      btnMaximize.title = isMaximized ? t("winRestore") : t("winMaximize");
    }
  });

  btnClose?.addEventListener("click", () => {
    appWindow.close();
  });

  window.addEventListener("resize", async () => {
    isMaximized = await appWindow.isMaximized();
    if (btnMaximize) {
      btnMaximize.innerHTML = isMaximized ? icons.winRestore : icons.winMaximize;
      btnMaximize.title = isMaximized ? t("winRestore") : t("winMaximize");
    }
  });

  // Language Switch
  langEnBtn?.addEventListener("click", () => {
    appSettings.lang = "en";
    saveAppSettings();
    savePreferences();
    updateLanguage("en");
  });
  langFrBtn?.addEventListener("click", () => {
    appSettings.lang = "fr";
    saveAppSettings();
    savePreferences();
    updateLanguage("fr");
  });

  // Accordion Expand/Collapse
  document.querySelectorAll(".accordion-header").forEach(header => {
    header.addEventListener("click", () => {
      const section = header.closest(".accordion-section");
      if (section) {
        section.classList.toggle("collapsed");
        savePreferences();
      }
    });
  });

  // Format Selection
  formatPills.querySelectorAll("[data-format]").forEach(pill => {
    pill.addEventListener("click", (e) => {
      markPresetCustom();
      formatPills.querySelectorAll("[data-format]").forEach(p => p.classList.remove("active"));
      const target = e.currentTarget as HTMLElement;
      target.classList.add("active");
      selectedFormat = target.dataset.format || "jpg";
      updateSummaryBadges();
      renderFileList();
      savePreferences();
    });
  });

  // Quality Slider
  inputQuality.addEventListener("input", () => {
    markPresetCustom();
    qualityVal = parseInt(inputQuality.value);
    qualityValText.textContent = `${qualityVal}%`;
    updateSummaryBadges();
    savePreferences();
  });

  // Target Size Toggle & Inputs
  targetSizeToggle.addEventListener("click", () => {
    markPresetCustom();
    targetSizeEnabled = !targetSizeEnabled;
    targetSizeToggle.classList.toggle("active", targetSizeEnabled);
    targetSizeToggle.setAttribute("aria-checked", targetSizeEnabled.toString());
    if (targetSizeEnabled) {
      targetSizeInputs.classList.remove("opacity-40", "pointer-events-none");
    } else {
      targetSizeInputs.classList.add("opacity-40", "pointer-events-none");
    }
    updateSummaryBadges();
    savePreferences();
  });

  inputTargetSize.addEventListener("input", () => {
    markPresetCustom();
    targetSizeVal = parseInt(inputTargetSize.value) || 500;
    updateSummaryBadges();
    savePreferences();
  });

  unitPills.querySelectorAll("[data-unit]").forEach(pill => {
    pill.addEventListener("click", (e) => {
      markPresetCustom();
      unitPills.querySelectorAll("[data-unit]").forEach(p => p.classList.remove("active"));
      const target = e.currentTarget as HTMLElement;
      target.classList.add("active");
      targetSizeUnit = (target.dataset.unit as "kb" | "mb") || "kb";
      updateSummaryBadges();
      savePreferences();
    });
  });

  // Resize Engine: Mode Selection (Original / Custom / Scale)
  resizeModePills.querySelectorAll("[data-mode]").forEach(pill => {
    pill.addEventListener("click", (e) => {
      markPresetCustom();
      resizeModePills.querySelectorAll("[data-mode]").forEach(p => p.classList.remove("active"));
      const target = e.currentTarget as HTMLElement;
      target.classList.add("active");
      selectedResizeMode = (target.dataset.mode as "original" | "custom" | "scale") || "original";

      if (selectedResizeMode === "original") {
        panelResizeCustom.classList.add("hidden");
        panelResizeCustom.classList.remove("flex");
        panelResizeScale.classList.add("hidden");
        panelResizeScale.classList.remove("flex");
      } else if (selectedResizeMode === "custom") {
        panelResizeCustom.classList.remove("hidden");
        panelResizeCustom.classList.add("flex");
        panelResizeScale.classList.add("hidden");
        panelResizeScale.classList.remove("flex");
      } else if (selectedResizeMode === "scale") {
        panelResizeScale.classList.remove("hidden");
        panelResizeScale.classList.add("flex");
        panelResizeCustom.classList.add("hidden");
        panelResizeCustom.classList.remove("flex");
      }
      updateSummaryBadges();
      savePreferences();
    });
  });

  // PowerToys Custom Mode: Aspect Ratio Lock Toggle
  btnLockAspect.addEventListener("click", () => {
    markPresetCustom();
    isAspectRatioLocked = !isAspectRatioLocked;
    btnLockAspect.classList.toggle("active", isAspectRatioLocked);
    iconLockAspect.innerHTML = isAspectRatioLocked ? icons.link : icons.unlink;
    btnLockAspect.title = isAspectRatioLocked ? t("aspectRatioLock") : t("aspectRatioUnlock");

    // Recalculate ratio from current values
    if (customWidth > 0 && customHeight > 0) {
      aspectRatio = customWidth / customHeight;
    }
    savePreferences();
  });

  // PowerToys Custom Mode: Reset Dimensions to Source / Default
  btnResetDimensions?.addEventListener("click", () => {
    markPresetCustom();
    const firstWithDim = filesQueue.find(f => f.width && f.height && f.width > 0 && f.height > 0);
    if (firstWithDim && firstWithDim.width && firstWithDim.height) {
      customWidth = firstWithDim.width;
      customHeight = firstWithDim.height;
      aspectRatio = customWidth / customHeight;
      inputCustomWidth.value = customWidth.toString();
      inputCustomHeight.value = customHeight.toString();
      userHasModifiedDimensions = false;
    } else {
      customWidth = 1920;
      customHeight = 1080;
      aspectRatio = 1920 / 1080;
      inputCustomWidth.value = "1920";
      inputCustomHeight.value = "1080";
      userHasModifiedDimensions = false;
    }
    updateSummaryBadges();
    savePreferences();
  });

  // PowerToys Custom Mode: Proportional Width/Height changes
  inputCustomWidth.addEventListener("input", () => {
    markPresetCustom();
    userHasModifiedDimensions = true;
    const val = parseInt(inputCustomWidth.value);
    if (!isNaN(val) && val > 0) {
      customWidth = val;
      if (isAspectRatioLocked && aspectRatio > 0) {
        customHeight = Math.max(1, Math.round(customWidth / aspectRatio));
        inputCustomHeight.value = customHeight.toString();
      }
      updateSummaryBadges();
      savePreferences();
    }
  });

  inputCustomHeight.addEventListener("input", () => {
    markPresetCustom();
    userHasModifiedDimensions = true;
    const val = parseInt(inputCustomHeight.value);
    if (!isNaN(val) && val > 0) {
      customHeight = val;
      if (isAspectRatioLocked && aspectRatio > 0) {
        customWidth = Math.max(1, Math.round(customHeight * aspectRatio));
        inputCustomWidth.value = customWidth.toString();
      }
      updateSummaryBadges();
      savePreferences();
    }
  });

  // Fit Mode Selection (Fit / Fill / Stretch)
  fitModePills.querySelectorAll("[data-fit]").forEach(pill => {
    pill.addEventListener("click", (e) => {
      markPresetCustom();
      userHasModifiedDimensions = true;
      fitModePills.querySelectorAll("[data-fit]").forEach(p => p.classList.remove("active"));
      const target = e.currentTarget as HTMLElement;
      target.classList.add("active");
      selectedFitMode = (target.dataset.fit as "fit" | "fill" | "stretch") || "fit";
      updateSummaryBadges();
      savePreferences();
    });
  });

  // Do Not Upscale Checkbox
  checkNoUpscale.addEventListener("change", () => {
    markPresetCustom();
    userHasModifiedDimensions = true;
    noUpscaleVal = checkNoUpscale.checked;
    savePreferences();
  });

  // Scale % Input & Presets
  inputScalePercent.addEventListener("input", () => {
    markPresetCustom();
    userHasModifiedDimensions = true;
    const val = parseInt(inputScalePercent.value);
    if (!isNaN(val) && val > 0) {
      scaleVal = val;
      updateSummaryBadges();
      savePreferences();
    }
  });

  scalePresets.querySelectorAll("[data-scale]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      markPresetCustom();
      userHasModifiedDimensions = true;
      const target = e.currentTarget as HTMLElement;
      const s = parseInt(target.dataset.scale || "75");
      scaleVal = s;
      inputScalePercent.value = s.toString();
      updateSummaryBadges();
      savePreferences();
    });
  });

  const updateModalPreview = () => {
    const suffix = formatPresetTechnicalDetails(getActiveSettings(), currentLang);
    const rawVal = inputPresetName.value.trim();
    const baseLabel = rawVal ? rawVal.split(" — ")[0].trim() : (currentLang === "fr" ? "Mon préréglage" : "My Preset");
    if (previewPresetSuffix) {
      previewPresetSuffix.textContent = `${baseLabel} — ${suffix}`;
    }
  };

  presetSelect?.addEventListener("change", () => {
    const selectedId = presetSelect.value;
    const found = userPresets.find(p => p.id === selectedId) || BUILT_IN_PRESETS.find(p => p.id === selectedId);
    if (found) {
      applyPreset(found);
    }
  });

  btnPresetDelete?.addEventListener("click", () => {
    if (activePresetId && userPresets.some(p => p.id === activePresetId)) {
      deleteUserPreset(activePresetId);
    }
  });

  btnPresetAdd?.addEventListener("click", () => {
    modalSavePreset.classList.remove("hidden");
    inputPresetName.value = "";
    updateModalPreview();
    inputPresetName.focus();
  });

  inputPresetName.addEventListener("input", updateModalPreview);

  const closeModal = () => {
    modalSavePreset.classList.add("hidden");
  };

  btnClosePresetModal.addEventListener("click", closeModal);
  btnCancelPresetSave.addEventListener("click", closeModal);
  modalSavePreset.addEventListener("click", (e) => {
    if (e.target === modalSavePreset) closeModal();
  });

  const handleSavePreset = () => {
    const rawName = inputPresetName.value.trim();
    if (!rawName) {
      inputPresetName.focus();
      return;
    }

    // Strip any existing " — ..." if user re-saves an existing preset name
    const baseName = rawName.split(" — ")[0].trim();
    const technicalSuffix = formatPresetTechnicalDetails(getActiveSettings(), currentLang);
    const finalName = `${baseName} — ${technicalSuffix}`;

    const newPreset: Preset = {
      id: "preset-custom-" + Date.now(),
      name: finalName,
      isBuiltIn: false,
      format: selectedFormat as any,
      quality: qualityVal,
      targetSizeEnabled,
      targetSizeVal: targetSizeEnabled ? targetSizeVal : undefined,
      targetSizeUnit: targetSizeEnabled ? targetSizeUnit : undefined,
      resizeMode: selectedResizeMode,
      customWidth: selectedResizeMode === "custom" ? customWidth : undefined,
      customHeight: selectedResizeMode === "custom" ? customHeight : undefined,
      fitMode: selectedResizeMode === "custom" ? selectedFitMode : undefined,
      noUpscale: selectedResizeMode === "custom" ? noUpscaleVal : undefined,
      scaleVal: selectedResizeMode === "scale" ? scaleVal : undefined,
    };

    userPresets.unshift(newPreset);
    try {
      localStorage.setItem("shrinkr_presets", JSON.stringify(userPresets));
    } catch (e) {
      console.warn("Failed to save user presets:", e);
    }

    activePresetId = newPreset.id;
    try {
      localStorage.setItem("shrinkr_active_preset", newPreset.id);
    } catch (_) {}
    closeModal();
    renderPresetSelector();
    savePreferences();
  };

  btnConfirmPresetSave.addEventListener("click", handleSavePreset);
  inputPresetName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSavePreset();
    } else if (e.key === "Escape") {
      closeModal();
    }
  });

  // Settings Modal Events
  const openSettingsModal = () => {
    updateSettingsUI();
    modalSettings?.classList.remove("hidden");
  };

  const closeSettingsModal = () => {
    modalSettings?.classList.add("hidden");
  };

  btnOpenSettings?.addEventListener("click", openSettingsModal);
  btnCloseSettingsModal?.addEventListener("click", closeSettingsModal);
  btnDoneSettings?.addEventListener("click", closeSettingsModal);

  modalSettings?.addEventListener("click", (e) => {
    if (e.target === modalSettings) closeSettingsModal();
  });

  // Theme pills
  themePills?.querySelectorAll("[data-theme]").forEach(pill => {
    pill.addEventListener("click", () => {
      const theme = (pill as HTMLElement).dataset.theme as "dark" | "light" | "system";
      if (theme) {
        applyTheme(theme);
        themePills?.querySelectorAll("[data-theme]").forEach(p => {
          p.classList.toggle("active", p === pill);
        });
        saveAppSettings();
      }
    });
  });

  // Strip EXIF toggle
  toggleStripExif?.addEventListener("click", () => {
    appSettings.stripExif = !appSettings.stripExif;
    toggleStripExif.classList.toggle("active", appSettings.stripExif);
    toggleStripExif.setAttribute("aria-checked", appSettings.stripExif.toString());
    saveAppSettings();
  });

  // Default suffix input
  inputSettingsDefaultSuffix?.addEventListener("input", () => {
    appSettings.defaultSuffix = inputSettingsDefaultSuffix.value.trim() || "_min";
    saveAppSettings();
  });

  // Global keydown for Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeSettingsModal();
    }
  });

  // Destination: Toggle Switch "Save in original folder"
  toggleSameFolder.addEventListener("click", () => {
    saveSameFolder = !saveSameFolder;
    toggleSameFolder.classList.toggle("active", saveSameFolder);
    toggleSameFolder.setAttribute("aria-checked", saveSameFolder.toString());

    if (saveSameFolder) {
      rowCustomFolder.classList.add("hidden");
      rowCustomFolder.classList.remove("flex");
      descSameFolder.textContent = t("sameFolderDesc");
    } else {
      rowCustomFolder.classList.remove("hidden");
      rowCustomFolder.classList.add("flex");
      descSameFolder.textContent = t("customFolderDesc");
      if (!customOutputDir) {
        btnPickCustomFolder.click();
      }
    }
    updateSummaryBadges();
    savePreferences();
  });

  btnPickCustomFolder.addEventListener("click", async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      customOutputDir = selected;
      inputCustomFolderPath.value = selected;
      updateSummaryBadges();
      savePreferences();
    }
  });

  inputCustomFolderPath.addEventListener("input", () => {
    customOutputDir = inputCustomFolderPath.value.trim() || null;
    updateSummaryBadges();
    savePreferences();
  });

  // Filename Suffix & Overwrite
  inputSuffixText.addEventListener("input", () => {
    fileSuffixVal = inputSuffixText.value.trim() || "_shrinkr";
    savePreferences();
  });

  checkOverwrite.addEventListener("change", () => {
    overwriteSourceVal = checkOverwrite.checked;
    savePreferences();
  });

  // Browse Files & Folder (Hero Drop Zone)
  btnBrowseFiles.addEventListener("click", async (e) => {
    e.stopPropagation();
    const files = await open({
      multiple: true,
      filters: [{
        name: "Images",
        extensions: ["jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "svg", "bmp", "tiff", "tif", "gif", "ico"]
      }]
    });
    if (files && Array.isArray(files)) {
      handlePaths(files);
    }
  });

  btnBrowseFolder.addEventListener("click", async (e) => {
    e.stopPropagation();
    const folder = await open({ directory: true, multiple: false });
    if (folder && typeof folder === "string") {
      handlePaths([folder]);
    }
  });

  // Browse Files & Folder (Compact Banner)
  btnCompactBrowseFiles.addEventListener("click", async (e) => {
    e.stopPropagation();
    btnBrowseFiles.click();
  });

  btnCompactBrowseFolder.addEventListener("click", async (e) => {
    e.stopPropagation();
    btnBrowseFolder.click();
  });

  // HTML5 Drag & Drop setup on both Drop Zones
  [dropZoneHero, dropZoneCompact].forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("border-blue-500", "bg-blue-500/10");
    });

    zone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      zone.classList.remove("border-blue-500", "bg-blue-500/10");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("border-blue-500", "bg-blue-500/10");
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i] as File & { path?: string };
          if (file.path) {
            paths.push(file.path);
          }
        }
        if (paths.length > 0) {
          handlePaths(paths);
        }
      }
    });

    zone.addEventListener("click", (e) => {
      // Don't trigger if clicked on child button
      if ((e.target as HTMLElement).closest("button")) return;
      btnBrowseFiles.click();
    });
  });

  // Clear Queue
  btnClearAll.addEventListener("click", () => {
    if (filesQueue.length === 0 || isProcessing) return;
    filesQueue = [];
    lastBatchOutputPath = null;
    renderFileList();
    updateFooterMetrics();
  });

  // Quick Open Last Batch Output Folder
  btnOpenLastFolder.addEventListener("click", () => {
    const target =
      lastBatchOutputPath ||
      filesQueue.find(f => f.outputPath)?.outputPath ||
      (!saveSameFolder && customOutputDir ? customOutputDir : null);
    if (target) {
      revealFolder(target);
    }
  });

  // Start Batch Compression
  btnStart.addEventListener("click", async () => {
    if (filesQueue.length === 0 || isProcessing) return;

    isProcessing = true;
    updateFooterMetrics();
    labelStartBtn.textContent = t("compressing");
    btnStart.disabled = true;

    filesQueue.forEach(f => f.status = "pending");
    renderFileList();

    const targetSizeKb = targetSizeEnabled
      ? (targetSizeUnit === "mb" ? targetSizeVal * 1024 : targetSizeVal)
      : undefined;

    const options: BatchOptions = {
      files: filesQueue.map(f => f.path),
      format: selectedFormat,
      resizeMode: selectedResizeMode === "original" ? "auto" : selectedResizeMode,
      resizeValue: selectedResizeMode === "scale" ? scaleVal : customWidth,
      resizeWidth: selectedResizeMode === "custom" ? customWidth : undefined,
      resizeHeight: selectedResizeMode === "custom" ? customHeight : undefined,
      fitMode: selectedResizeMode === "custom" ? selectedFitMode : undefined,
      noUpscale: selectedResizeMode === "custom" ? noUpscaleVal : undefined,
      quality: qualityVal,
      targetSizeKb: targetSizeKb,
      outputDir: !saveSameFolder && customOutputDir ? customOutputDir : undefined,
      suffix: fileSuffixVal,
      overwriteSource: overwriteSourceVal,
    };

    try {
      await invoke("process_batch", { options });
    } catch (err) {
      console.error("Error executing batch:", err);
      isProcessing = false;
      labelStartBtn.textContent = t("startCompression");
      btnStart.disabled = filesQueue.length === 0;
      updateFooterMetrics();
    }
  });

  // Listen for Tauri IPC Progress Events
  listen<ProgressEventPayload>("shrinkr://batch-progress", (event) => {
    const payload = event.payload;
    const item = filesQueue.find(f => f.path === payload.path);
    if (item) {
      item.status = payload.status;
      item.newSize = payload.newSize;
      item.outputPath = payload.outputPath;
      item.outputWidth = payload.outputWidth;
      item.outputHeight = payload.outputHeight;
      item.error = payload.error;
    }
    renderFileList();
    updateFooterMetrics();
  });

  // Listen for Tauri IPC Complete Event
  listen<BatchCompletePayload>("shrinkr://batch-complete", (event) => {
    isProcessing = false;
    labelStartBtn.textContent = t("startCompression");
    btnStart.disabled = filesQueue.length === 0;
    if (event.payload.lastOutputPath) {
      lastBatchOutputPath = event.payload.lastOutputPath;
    }
    updateFooterMetrics();
  });

  // Tauri Native Window Drag & Drop listener
  appWindow.onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        handlePaths(paths);
      }
    }
  });
}

// Initial Boot
appSettings = loadAppSettings();
currentLang = appSettings.lang;
applyTheme(appSettings.theme);
setupIcons();
loadPresets();
loadPreferences();
if (appSettings.lang) {
  currentLang = appSettings.lang;
}
setupEvents();
updateLanguage(currentLang);
updateSettingsUI();
