#pragma once

/**
 * Minimal NDI C API surface for dynamic loading (NDI 5/6 Runtime).
 * Struct layouts match public NDI SDK headers for send video v2.
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define NDILIB_FOURCC(ch0, ch1, ch2, ch3) \
  ((uint32_t)(uint8_t)(ch0) | ((uint32_t)(uint8_t)(ch1) << 8) | \
   ((uint32_t)(uint8_t)(ch2) << 16) | ((uint32_t)(uint8_t)(ch3) << 24))

typedef enum NDIlib_FourCC_video_type_e {
  NDIlib_FourCC_video_type_UYVY = NDILIB_FOURCC('U', 'Y', 'V', 'Y'),
  NDIlib_FourCC_type_UYVY = NDIlib_FourCC_video_type_UYVY,
  NDIlib_FourCC_video_type_BGRA = NDILIB_FOURCC('B', 'G', 'R', 'A'),
  NDIlib_FourCC_type_BGRA = NDIlib_FourCC_video_type_BGRA,
  NDIlib_FourCC_video_type_BGRX = NDILIB_FOURCC('B', 'G', 'R', 'X'),
  NDIlib_FourCC_type_BGRX = NDIlib_FourCC_video_type_BGRX,
  NDIlib_FourCC_video_type_RGBA = NDILIB_FOURCC('R', 'G', 'B', 'A'),
  NDIlib_FourCC_type_RGBA = NDIlib_FourCC_video_type_RGBA,
  NDIlib_FourCC_video_type_RGBX = NDILIB_FOURCC('R', 'G', 'B', 'X'),
  NDIlib_FourCC_type_RGBX = NDIlib_FourCC_video_type_RGBX
} NDIlib_FourCC_video_type_e;

typedef enum NDIlib_frame_format_type_e {
  NDIlib_frame_format_type_progressive = 1,
  NDIlib_frame_format_type_interleaved = 0,
  NDIlib_frame_format_type_field_0 = 2,
  NDIlib_frame_format_type_field_1 = 3
} NDIlib_frame_format_type_e;

typedef struct NDIlib_send_create_t {
  const char* p_ndi_name;
  const char* p_groups;
  bool clock_video;
  bool clock_audio;
} NDIlib_send_create_t;

typedef struct NDIlib_video_frame_v2_t {
  int xres;
  int yres;
  NDIlib_FourCC_video_type_e FourCC;
  int frame_rate_N;
  int frame_rate_D;
  float picture_aspect_ratio;
  NDIlib_frame_format_type_e frame_format_type;
  int64_t timecode;
  uint8_t* p_data;
  int line_stride_in_bytes;
  const char* p_metadata;
  int64_t timestamp;
} NDIlib_video_frame_v2_t;

typedef void* NDIlib_send_instance_t;

typedef bool (*fn_NDIlib_initialize)(void);
typedef void (*fn_NDIlib_destroy)(void);
typedef NDIlib_send_instance_t (*fn_NDIlib_send_create)(const NDIlib_send_create_t* p_create_settings);
typedef void (*fn_NDIlib_send_destroy)(NDIlib_send_instance_t p_instance);
typedef void (*fn_NDIlib_send_send_video_v2)(
  NDIlib_send_instance_t p_instance,
  const NDIlib_video_frame_v2_t* p_video_data
);

#ifdef __cplusplus
}
#endif
