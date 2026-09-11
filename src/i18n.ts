export type Language = 'en' | 'fr';

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  dropTitle: string;
  dropSubtitle: string;
  dropCompactHint: string;
  browseFiles: string;
  browseFolder: string;
  addFilesCompact: string;
  addFolderCompact: string;
  
  // Accordion Sections
  sectionFormat: string;
  sectionResize: string;
  sectionDest: string;

  // Format
  outputFormat: string;
  quality: string;
  targetSize: string;
  targetSizeDesc: string;
  targetSizeEnable: string;
  unitKb: string;
  unitMb: string;

  // Resize Engine (PowerToys style)
  resizeMode: string;
  resizeOriginal: string;
  resizeCustom: string;
  resizeScale: string;
  widthLabel: string;
  heightLabel: string;
  fitModeLabel: string;
  fitContain: string;
  fitFill: string;
  fitStretch: string;
  noUpscale: string;
  aspectRatioLock: string;
  aspectRatioUnlock: string;
  resetDimensions: string;

  // Destination
  outputDestination: string;
  saveSameFolderToggle: string;
  sameFolderDesc: string;
  customFolderDesc: string;
  customFolderPlaceholder: string;
  browseFolderBtn: string;
  sameFolderBadge: string;
  customFolderBadge: string;
  filenameConflict: string;
  fileSuffix: string;
  overwriteSource: string;

  // Queue & Actions
  fileQueue: string;
  filesSelected: string;
  clearQueue: string;
  startCompression: string;
  compressing: string;
  completed: string;
  statusPending: string;
  statusProcessing: string;
  statusSuccess: string;
  statusError: string;
  openFileFolder: string;
  openOutputFolder: string;
  totalSaved: string;
  sizeIncreased: string;
  sizeIdentical: string;
  original: string;
  newSize: string;
  reduction: string;
  noFilesWarning: string;
  confirmClear: string;

  // Presets
  presetLabel: string;
  presetCustomGroup: string;
  presetRecommendedGroup: string;
  presetWebStandard: string;
  presetUltra4k: string;
  presetEmailDocs: string;
  presetSquareThumb: string;
  presetSocialMedia: string;
  presetLightweightNative: string;
  presetHighFidelityArchive: string;
  presetTitleWebStandard: string;
  presetSpecsWebStandard: string;
  presetTitleUltra4k: string;
  presetSpecsUltra4k: string;
  presetTitleEmailDocs: string;
  presetSpecsEmailDocs: string;
  presetTitleSquareThumb: string;
  presetSpecsSquareThumb: string;
  presetTitleSocialMedia: string;
  presetSpecsSocialMedia: string;
  presetTitleLightweightNative: string;
  presetSpecsLightweightNative: string;
  presetTitleHighFidelityArchive: string;
  presetSpecsHighFidelityArchive: string;
  presetChipNew: string;
  presetChipDeleteTitle: string;
  presetChipAddTitle: string;
  presetSaveBtn: string;
  presetDeleteBtn: string;
  presetCustomOption: string;
  presetModalTitle: string;
  presetModalDesc: string;
  presetModalPlaceholder: string;
  presetModalPreview: string;
  presetModalCancel: string;
  presetModalSave: string;

  // Window controls
  winMinimize: string;
  winMaximize: string;
  winRestore: string;
  winClose: string;

  // Settings Modal
  settingsTitle: string;
  settingsLangTitle: string;
  settingsLangFr: string;
  settingsLangEn: string;
  settingsAppearance: string;
  settingsThemeDark: string;
  settingsThemeLight: string;
  settingsThemeSystem: string;
  settingsPrivacyTitle: string;
  settingsStripExif: string;
  settingsFilesTitle: string;
  settingsDefaultSuffixDesc: string;
  settingsAboutTitle: string;
  settingsAboutDesc: string;
  settingsCloseBtn: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appTitle: "shrinkr",
    appSubtitle: "Ultra-fast batch image optimizer & converter",
    dropTitle: "Drop images or folders here",
    dropSubtitle: "Supports JPG, PNG, WEBP, AVIF, HEIC, SVG, BMP, TIFF, GIF, ICO",
    dropCompactHint: "Drop more images or folders here",
    browseFiles: "Browse Files",
    browseFolder: "Add Folder",
    addFilesCompact: "+ Files",
    addFolderCompact: "+ Folder",

    sectionFormat: "Format & Compression",
    sectionResize: "Resize Engine",
    sectionDest: "Output Destination",

    outputFormat: "Output Format",
    quality: "Quality",
    targetSize: "Target File Size (Max)",
    targetSizeDesc: "Binary search convergence in 5-7 passes",
    targetSizeEnable: "Limit max size",
    unitKb: "KB",
    unitMb: "MB",

    resizeMode: "Mode",
    resizeOriginal: "Original",
    resizeCustom: "Custom",
    resizeScale: "Scale %",
    widthLabel: "Width",
    heightLabel: "Height",
    fitModeLabel: "Fit Mode",
    fitContain: "Fit",
    fitFill: "Fill",
    fitStretch: "Stretch",
    noUpscale: "Do not enlarge if smaller",
    aspectRatioLock: "Aspect ratio locked",
    aspectRatioUnlock: "Aspect ratio unlocked",
    resetDimensions: "Reset to source image dimensions",

    outputDestination: "Output Destination",
    saveSameFolderToggle: "Save in original file folder",
    sameFolderDesc: "Each image is saved alongside its source, even across multiple folders",
    customFolderDesc: "Save all processed images in a single custom destination folder",
    customFolderPlaceholder: "Select destination folder...",
    browseFolderBtn: "Browse...",
    sameFolderBadge: "Same folder",
    customFolderBadge: "Custom folder",
    filenameConflict: "Filename & Collision Handling",
    fileSuffix: "Filename suffix",
    overwriteSource: "Overwrite original file if identical name",

    fileQueue: "Queue & Results",
    filesSelected: "files ready",
    clearQueue: "Clear Queue",
    startCompression: "Compress Images",
    compressing: "Compressing...",
    completed: "Batch Completed!",
    statusPending: "Ready",
    statusProcessing: "Optimizing...",
    statusSuccess: "Done",
    statusError: "Failed",
    openFileFolder: "Reveal in Explorer",
    openOutputFolder: "Open Destination Folder",
    totalSaved: "Total saved",
    sizeIncreased: "Size changed",
    sizeIdentical: "Identical size",
    original: "Original",
    newSize: "New",
    reduction: "Saved",
    noFilesWarning: "Please add at least one image to process.",
    confirmClear: "Clear the current queue?",
    // Presets
    presetLabel: "Preset",
    presetCustomGroup: "My Presets",
    presetRecommendedGroup: "Recommended Presets",
    presetWebStandard: "Web Standard — WEBP • 1080p Fit • 82%",
    presetUltra4k: "Ultra HD / 4K — WEBP • 2160p Fit • 88%",
    presetEmailDocs: "Email & Docs — JPG • 720p Fit • Max 500 KB",
    presetSquareThumb: "Square Thumbnail — JPG • 300×300 Fill • 85%",
    presetSocialMedia: "Social Media (4:5) — JPG • 1080×1350 Fit • 85%",
    presetLightweightNative: "Lightweight Native — WEBP • Orig. Size • 80%",
    presetHighFidelityArchive: "High-Fidelity Archive — AVIF • Orig. Size • 85%",
    presetTitleWebStandard: "Web Standard",
    presetSpecsWebStandard: "WEBP • 1080p • 82%",
    presetTitleUltra4k: "Ultra HD / 4K",
    presetSpecsUltra4k: "WEBP • 2160p • 88%",
    presetTitleEmailDocs: "Email & Docs",
    presetSpecsEmailDocs: "JPG • 720p • Max 500 KB",
    presetTitleSquareThumb: "Square Thumbnail",
    presetSpecsSquareThumb: "JPG • 300×300 • 85%",
    presetTitleSocialMedia: "Social Media (4:5)",
    presetSpecsSocialMedia: "JPG • 1080×1350 • 85%",
    presetTitleLightweightNative: "Lightweight Native",
    presetSpecsLightweightNative: "WEBP • Orig. Size • 80%",
    presetTitleHighFidelityArchive: "High-Fidelity Archive",
    presetSpecsHighFidelityArchive: "AVIF • Orig. Size • 85%",
    presetChipNew: "+ New",
    presetChipDeleteTitle: "Delete this preset",
    presetChipAddTitle: "Save current settings as preset",
    presetSaveBtn: "+ New",
    presetDeleteBtn: "Delete Preset",
    presetCustomOption: "Custom (Modified)",
    presetModalTitle: "Save Preset",
    presetModalDesc: "Save current compression and resize settings as a reusable preset.",
    presetModalPlaceholder: "e.g. Client Banner",
    presetModalPreview: "Preview:",
    presetModalCancel: "Cancel",
    presetModalSave: "Save Preset",

    winMinimize: "Minimize",
    winMaximize: "Maximize",
    winRestore: "Restore",
    winClose: "Close",

    // Settings Modal
    settingsTitle: "Settings",
    settingsLangTitle: "Language",
    settingsLangFr: "Français",
    settingsLangEn: "English",
    settingsAppearance: "Appearance",
    settingsThemeDark: "Dark (default)",
    settingsThemeLight: "Light",
    settingsThemeSystem: "System",
    settingsPrivacyTitle: "Privacy and metadata",
    settingsStripExif: "Strip EXIF metadata during processing",
    settingsFilesTitle: "Files",
    settingsDefaultSuffixDesc: "Default suffix",
    settingsAboutTitle: "About",
    settingsAboutDesc: "shrinkr v1.0 • Local and private engine",
    settingsCloseBtn: "Close",
  },
  fr: {
    appTitle: "shrinkr",
    appSubtitle: "Optimiseur et convertisseur d'images par lots ultra-rapide",
    dropTitle: "Glissez vos images ou dossiers ici",
    dropSubtitle: "Formats pris en charge : JPG, PNG, WEBP, AVIF, HEIC, SVG, BMP, TIFF, GIF, ICO",
    dropCompactHint: "Déposez d'autres images ou dossiers ici",
    browseFiles: "Parcourir les fichiers",
    browseFolder: "Ajouter un dossier",
    addFilesCompact: "+ Fichiers",
    addFolderCompact: "+ Dossier",

    sectionFormat: "Format et compression",
    sectionResize: "Moteur de redimensionnement",
    sectionDest: "Dossier de destination",

    outputFormat: "Format de sortie",
    quality: "Qualité",
    targetSize: "Taille maximale cible",
    targetSizeDesc: "Recherche dichotomique en 5 à 7 passes",
    targetSizeEnable: "Plafonner la taille",
    unitKb: "Ko",
    unitMb: "Mo",

    resizeMode: "Mode",
    resizeOriginal: "Original",
    resizeCustom: "Personnalisé",
    resizeScale: "% Échelle",
    widthLabel: "Largeur",
    heightLabel: "Hauteur",
    fitModeLabel: "Cadrage",
    fitContain: "Ajuster (Fit)",
    fitFill: "Remplir (Fill)",
    fitStretch: "Étirer",
    noUpscale: "Ne pas agrandir si plus petite",
    aspectRatioLock: "Proportions verrouillées",
    aspectRatioUnlock: "Proportions libres",
    resetDimensions: "Réinitialiser aux dimensions d'origine",

    outputDestination: "Dossier de destination",
    saveSameFolderToggle: "Enregistrer dans le dossier d'origine",
    sameFolderDesc: "Chaque image est enregistrée dans son dossier source respectif",
    customFolderDesc: "Enregistrer toutes les images traitées dans un dossier unique",
    customFolderPlaceholder: "Sélectionnez un dossier de destination...",
    browseFolderBtn: "Parcourir...",
    sameFolderBadge: "Dossier source",
    customFolderBadge: "Dossier personnalisé",
    filenameConflict: "Conflits de noms et préservation",
    fileSuffix: "Suffixe de nom",
    overwriteSource: "Écraser le fichier source si nom identique",

    fileQueue: "File d'attente et résultats",
    filesSelected: "fichiers prêts",
    clearQueue: "Vider la file d'attente",
    startCompression: "Compresser les images",
    compressing: "Compression en cours...",
    completed: "Traitement terminé !",
    statusPending: "En attente",
    statusProcessing: "Optimisation...",
    statusSuccess: "Terminé",
    statusError: "Échec",
    openFileFolder: "Afficher dans l'Explorateur",
    openOutputFolder: "Ouvrir le dossier de destination",
    totalSaved: "Gain total",
    sizeIncreased: "Taille accrue",
    sizeIdentical: "Taille identique",
    original: "Original",
    newSize: "Nouveau",
    reduction: "Gain",
    noFilesWarning: "Veuillez ajouter au moins une image à traiter.",
    confirmClear: "Vider la file d'attente actuelle ?",
    // Presets
    presetLabel: "Préréglage",
    presetCustomGroup: "Mes préréglages",
    presetRecommendedGroup: "Préréglages recommandés",
    presetWebStandard: "Web standard — WEBP • 1080p ajusté • 82%",
    presetUltra4k: "Ultra HD / 4K — WEBP • 2160p ajusté • 88%",
    presetEmailDocs: "Courriel et documents — JPG • 720p ajusté • max 500 Ko",
    presetSquareThumb: "Miniature carrée — JPG • 300×300 rempli • 85%",
    presetSocialMedia: "Format réseaux (portrait 4:5) — JPG • 1080×1350 ajusté • 85%",
    presetLightweightNative: "WebP léger — WEBP • taille source • 80%",
    presetHighFidelityArchive: "Archivage haute fidélité — AVIF • taille source • 85%",
    presetTitleWebStandard: "Web standard",
    presetSpecsWebStandard: "WEBP • 1080p • 82%",
    presetTitleUltra4k: "Ultra HD / 4K",
    presetSpecsUltra4k: "WEBP • 2160p • 88%",
    presetTitleEmailDocs: "Courriel et documents",
    presetSpecsEmailDocs: "JPG • 720p • max 500 Ko",
    presetTitleSquareThumb: "Miniature carrée",
    presetSpecsSquareThumb: "JPG • 300×300 • 85%",
    presetTitleSocialMedia: "Format réseaux",
    presetSpecsSocialMedia: "JPG • 1080×1350 • 85%",
    presetTitleLightweightNative: "WebP léger",
    presetSpecsLightweightNative: "WEBP • taille source • 80%",
    presetTitleHighFidelityArchive: "Archivage haute fidélité",
    presetSpecsHighFidelityArchive: "AVIF • taille source • 85%",
    presetChipNew: "+ Nouveau",
    presetChipDeleteTitle: "Supprimer ce préréglage",
    presetChipAddTitle: "Enregistrer la configuration actuelle en préréglage",
    presetSaveBtn: "+ Nouveau",
    presetDeleteBtn: "Supprimer le préréglage",
    presetCustomOption: "Personnalisé (modifié)",
    presetModalTitle: "Enregistrer le préréglage",
    presetModalDesc: "Enregistrer la configuration actuelle comme préréglage réutilisable.",
    presetModalPlaceholder: "ex : Bannière client",
    presetModalPreview: "Aperçu :",
    presetModalCancel: "Annuler",
    presetModalSave: "Enregistrer",

    winMinimize: "Réduire",
    winMaximize: "Agrandir",
    winRestore: "Niveau inférieur",
    winClose: "Fermer",

    // Settings Modal
    settingsTitle: "Paramètres",
    settingsLangTitle: "Langue",
    settingsLangFr: "Français",
    settingsLangEn: "English",
    settingsAppearance: "Apparence",
    settingsThemeDark: "Sombre (défaut)",
    settingsThemeLight: "Clair",
    settingsThemeSystem: "Système",
    settingsPrivacyTitle: "Confidentialité et métadonnées",
    settingsStripExif: "Supprimer les métadonnées EXIF lors du traitement",
    settingsFilesTitle: "Fichiers",
    settingsDefaultSuffixDesc: "Suffixe par défaut",
    settingsAboutTitle: "À propos",
    settingsAboutDesc: "shrinkr v1.0 • Moteur local et privé",
    settingsCloseBtn: "Fermer",
  }
};
