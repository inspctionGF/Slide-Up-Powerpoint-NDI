#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wincodec.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <string>
#include <vector>

#include "ndi_api.h"

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "windowscodecs.lib")

static HMODULE g_ndi_module = nullptr;
static fn_NDIlib_initialize g_NDIlib_initialize = nullptr;
static fn_NDIlib_destroy g_NDIlib_destroy = nullptr;
static fn_NDIlib_send_create g_NDIlib_send_create = nullptr;
static fn_NDIlib_send_destroy g_NDIlib_send_destroy = nullptr;
static fn_NDIlib_send_send_video_v2 g_NDIlib_send_send_video_v2 = nullptr;

static bool g_ready = false;
static NDIlib_send_instance_t g_sender = nullptr;
static std::string g_source_name = "Slide-up";
static const int kMaxNameAttempts = 5;

static void reply_ok() {
  fputs("{\"ok\":true}\n", stdout);
  fflush(stdout);
}

static void reply_error(const char* message) {
  fprintf(stdout, "{\"ok\":false,\"error\":\"");
  for (const char* p = message; *p; ++p) {
    if (*p == '"' || *p == '\\') fputc('\\', stdout);
    if (*p == '\n' || *p == '\r') continue;
    fputc(*p, stdout);
  }
  fputs("\"}\n", stdout);
  fflush(stdout);
}

static std::string json_get_string(const std::string& json, const char* key) {
  std::string needle = std::string("\"") + key + "\":\"";
  size_t pos = json.find(needle);
  if (pos == std::string::npos) return "";
  pos += needle.size();
  std::string out;
  for (size_t i = pos; i < json.size(); ++i) {
    char c = json[i];
    if (c == '\\' && i + 1 < json.size()) {
      out.push_back(json[++i]);
      continue;
    }
    if (c == '"') break;
    out.push_back(c);
  }
  return out;
}

static bool json_get_bool(const std::string& json, const char* key, bool fallback) {
  std::string needle = std::string("\"") + key + "\":";
  size_t pos = json.find(needle);
  if (pos == std::string::npos) return fallback;
  pos += needle.size();
  while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) pos++;
  if (json.compare(pos, 4, "true") == 0) return true;
  if (json.compare(pos, 5, "false") == 0) return false;
  return fallback;
}

static bool load_ndi_library() {
  if (g_ndi_module) return true;

  const wchar_t* candidates[] = {
    L"Processing.NDI.Lib.x64.dll",
    L".\\Processing.NDI.Lib.x64.dll",
    L"C:\\Program Files\\NDI\\NDI 6 Runtime\\v6\\Processing.NDI.Lib.x64.dll",
    L"C:\\Program Files\\NDI\\NDI 5 Runtime\\v5\\Processing.NDI.Lib.x64.dll",
    nullptr
  };

  for (int i = 0; candidates[i]; ++i) {
    g_ndi_module = LoadLibraryW(candidates[i]);
    if (g_ndi_module) break;
  }

  if (!g_ndi_module) {
    return false;
  }

  g_NDIlib_initialize = (fn_NDIlib_initialize)GetProcAddress(g_ndi_module, "NDIlib_initialize");
  g_NDIlib_destroy = (fn_NDIlib_destroy)GetProcAddress(g_ndi_module, "NDIlib_destroy");
  g_NDIlib_send_create = (fn_NDIlib_send_create)GetProcAddress(g_ndi_module, "NDIlib_send_create");
  g_NDIlib_send_destroy = (fn_NDIlib_send_destroy)GetProcAddress(g_ndi_module, "NDIlib_send_destroy");
  g_NDIlib_send_send_video_v2 =
    (fn_NDIlib_send_send_video_v2)GetProcAddress(g_ndi_module, "NDIlib_send_send_video_v2");

  if (!g_NDIlib_initialize || !g_NDIlib_destroy || !g_NDIlib_send_create ||
      !g_NDIlib_send_destroy || !g_NDIlib_send_send_video_v2) {
    FreeLibrary(g_ndi_module);
    g_ndi_module = nullptr;
    return false;
  }
  return true;
}

static bool decode_png_rgba(const wchar_t* path, std::vector<uint8_t>& rgba, UINT& width, UINT& height) {
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  bool com_ok = SUCCEEDED(hr) || hr == S_FALSE || hr == RPC_E_CHANGED_MODE;
  if (!com_ok) return false;

  IWICImagingFactory* factory = nullptr;
  hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                        IID_PPV_ARGS(&factory));
  if (FAILED(hr) || !factory) {
    return false;
  }

  IWICBitmapDecoder* decoder = nullptr;
  hr = factory->CreateDecoderFromFilename(path, nullptr, GENERIC_READ,
                                          WICDecodeMetadataCacheOnLoad, &decoder);
  if (FAILED(hr) || !decoder) {
    factory->Release();
    return false;
  }

  IWICBitmapFrameDecode* frame = nullptr;
  hr = decoder->GetFrame(0, &frame);
  if (FAILED(hr) || !frame) {
    decoder->Release();
    factory->Release();
    return false;
  }

  IWICFormatConverter* converter = nullptr;
  hr = factory->CreateFormatConverter(&converter);
  if (FAILED(hr) || !converter) {
    frame->Release();
    decoder->Release();
    factory->Release();
    return false;
  }

  hr = converter->Initialize(frame, GUID_WICPixelFormat32bppRGBA, WICBitmapDitherTypeNone,
                             nullptr, 0.0, WICBitmapPaletteTypeCustom);
  if (FAILED(hr)) {
    converter->Release();
    frame->Release();
    decoder->Release();
    factory->Release();
    return false;
  }

  hr = converter->GetSize(&width, &height);
  if (FAILED(hr) || width == 0 || height == 0) {
    converter->Release();
    frame->Release();
    decoder->Release();
    factory->Release();
    return false;
  }

  const UINT stride = width * 4;
  const UINT buffer_size = stride * height;
  rgba.resize(buffer_size);
  hr = converter->CopyPixels(nullptr, stride, buffer_size, rgba.data());

  converter->Release();
  frame->Release();
  decoder->Release();
  factory->Release();
  return SUCCEEDED(hr);
}

static std::wstring utf8_to_wide(const std::string& utf8) {
  if (utf8.empty()) return L"";
  int needed = MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, nullptr, 0);
  std::wstring wide(needed ? needed - 1 : 0, L'\0');
  if (needed > 1) {
    MultiByteToWideChar(CP_UTF8, 0, utf8.c_str(), -1, &wide[0], needed);
  }
  return wide;
}

static void cmd_destroy() {
  if (g_sender && g_NDIlib_send_destroy) {
    g_NDIlib_send_destroy(g_sender);
    g_sender = nullptr;
  }
  if (g_ready && g_NDIlib_destroy) {
    g_NDIlib_destroy();
  }
  g_ready = false;
}

static void cmd_init(const std::string& name) {
  cmd_destroy();

  if (!load_ndi_library()) {
    reply_error("Runtime NDI introuvable. Installez NDI Runtime ou placez Processing.NDI.Lib.x64.dll a cote du helper.");
    return;
  }

  if (!g_NDIlib_initialize()) {
    reply_error("Echec de NDIlib_initialize.");
    return;
  }

  g_source_name = name.empty() ? "Slide-up" : name;
  NDIlib_send_create_t desc = {};
  desc.p_ndi_name = g_source_name.c_str();
  desc.p_groups = nullptr;
  desc.clock_video = false;
  desc.clock_audio = false;

  g_sender = g_NDIlib_send_create(&desc);
  if (!g_sender) {
    char buffer[128];
    for (int i = 2; i <= kMaxNameAttempts; ++i) {
      sprintf_s(buffer, "%s (%d)", g_source_name.c_str(), i);
      desc.p_ndi_name = buffer;
      g_sender = g_NDIlib_send_create(&desc);
      if (g_sender) {
        g_source_name = buffer;
        break;
      }
    }
  }

  if (!g_sender) {
    g_NDIlib_destroy();
    reply_error("Impossible de creer la source NDI (trop d'instances?).");
    return;
  }

  g_ready = true;
  fprintf(stdout, "{\"ok\":true,\"sourceName\":\"%s\"}\n", g_source_name.c_str());
  fflush(stdout);
}

static void cmd_send(const std::string& path_utf8, bool once) {
  if (!g_ready || !g_sender) {
    reply_error("La source NDI n'est pas initialisee.");
    return;
  }
  if (path_utf8.empty()) {
    reply_error("Chemin PNG manquant.");
    return;
  }

  std::wstring path = utf8_to_wide(path_utf8);
  std::vector<uint8_t> rgba;
  UINT width = 0, height = 0;
  if (!decode_png_rgba(path.c_str(), rgba, width, height)) {
    reply_error("Impossible de decoder le PNG (fichier verrouille ou invalide).");
    return;
  }

  NDIlib_video_frame_v2_t frame = {};
  frame.xres = (int)width;
  frame.yres = (int)height;
  frame.FourCC = NDIlib_FourCC_type_RGBA;
  frame.frame_rate_N = 30000;
  frame.frame_rate_D = 1001;
  frame.picture_aspect_ratio = (height > 0) ? ((float)width / (float)height) : 0.0f;
  frame.frame_format_type = NDIlib_frame_format_type_progressive;
  frame.timecode = 0;
  frame.p_data = rgba.data();
  frame.line_stride_in_bytes = (int)(width * 4);
  frame.p_metadata = nullptr;
  frame.timestamp = 0;

  const int times = once ? 1 : 2;
  for (int i = 0; i < times; ++i) {
    g_NDIlib_send_send_video_v2(g_sender, &frame);
  }
  reply_ok();
}

static void handle_line(const std::string& line) {
  if (line.find("\"cmd\":\"ping\"") != std::string::npos) {
    reply_ok();
    return;
  }
  if (line.find("\"cmd\":\"destroy\"") != std::string::npos) {
    cmd_destroy();
    reply_ok();
    return;
  }
  if (line.find("\"cmd\":\"init\"") != std::string::npos) {
    cmd_init(json_get_string(line, "name"));
    return;
  }
  if (line.find("\"cmd\":\"send\"") != std::string::npos) {
    cmd_send(json_get_string(line, "path"), json_get_bool(line, "once", false));
    return;
  }
  reply_error("Commande inconnue.");
}

int main() {
  SetConsoleOutputCP(CP_UTF8);
  SetConsoleCP(CP_UTF8);

  char buffer[8192];
  while (fgets(buffer, sizeof(buffer), stdin)) {
    size_t len = strlen(buffer);
    while (len > 0 && (buffer[len - 1] == '\n' || buffer[len - 1] == '\r')) {
      buffer[--len] = '\0';
    }
    if (len == 0) continue;
    handle_line(buffer);
  }

  cmd_destroy();
  if (g_ndi_module) {
    FreeLibrary(g_ndi_module);
    g_ndi_module = nullptr;
  }
  return 0;
}
