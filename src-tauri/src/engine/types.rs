use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedImage {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub format: String,
    pub status: String,
    #[serde(default)]
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchConfig {
    pub files: Vec<String>,
    pub format: String,
    pub resize_mode: String,
    pub resize_value: u32,
    #[serde(default)]
    pub resize_width: Option<u32>,
    #[serde(default)]
    pub resize_height: Option<u32>,
    #[serde(default)]
    pub fit_mode: Option<String>,
    #[serde(default)]
    pub no_upscale: Option<bool>,
    pub quality: u8,
    pub target_size_kb: Option<u64>,
    pub output_dir: Option<String>,
    pub suffix: Option<String>,
    pub overwrite_source: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub index: usize,
    pub total: usize,
    pub id: String,
    pub path: String,
    pub status: String,
    pub original_size: u64,
    pub new_size: Option<u64>,
    pub output_path: Option<String>,
    pub output_width: Option<u32>,
    pub output_height: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCompletePayload {
    pub total_files: usize,
    pub success_count: usize,
    pub error_count: usize,
    pub total_original_bytes: u64,
    pub total_new_bytes: u64,
    pub duration_ms: u64,
    pub last_output_path: Option<String>,
}
