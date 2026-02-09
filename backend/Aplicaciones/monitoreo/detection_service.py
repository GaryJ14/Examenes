# ============================================================
# Aplicaciones/monitoreo/detection_service.py
# ============================================================

import numpy as np
import cv2
import os
import urllib.request

USE_TASKS = False
try:
    from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions
    from mediapipe.tasks.python.vision.face_landmarker import _BaseOptions
    try:
        from mediapipe.tasks.python.vision.core.image import Image, ImageFormat
    except Exception:
        from mediapipe.tasks.python.vision import Image, ImageFormat
    USE_TASKS = True
except Exception:
    import mediapipe as mp

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "face_landmarker_v2.task")
MODEL_URL  = "https://storage.googleapis.com/mediapipe-assets/face_landmarker_v2.task"

def _ensure_model():
    if not os.path.exists(MODEL_PATH):
        print("[DetectionService] Descargando face_landmarker_v2.task …")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("[DetectionService] ✓ Modelo descargado")

LEFT_EYE    = [33, 160, 158, 133, 153, 144]
RIGHT_EYE   = [362, 385, 387, 263, 373, 380]
LEFT_IRIS   = [474, 475, 476, 477]
RIGHT_IRIS  = [469, 470, 471, 472]
FACE_2D_IDX = [1, 152, 263, 33, 287, 57, 61, 291, 199]

MODEL_POINTS_3D = np.array([
    [ 0.0,   0.0,   0.0],
    [ 0.0, -63.6, -12.5],
    [-43.3, 32.7, -26.0],
    [ 43.3, 32.7, -26.0],
    [-28.9,-28.9, -24.1],
    [ 28.9,-28.9, -24.1],
    [-61.6,-11.2, -39.5],
    [ 61.6,-11.2, -39.5],
    [ 0.0, -48.0, -50.0],
], dtype="double")

MIN_FACE_SCALE = 0.08
GAZE_THRESH    = 0.22
EAR_CLOSED     = 0.15

# 90° = 100%
YAW_MAX_DEG_FOR_100 = 90.0

# Tu rango: 80–85 “OK (informativo)”, >85 “malo”
YAW_PCT_OK_LOW   = 80.0
YAW_PCT_OK_HIGH  = 85.0
YAW_PCT_BAD      = 85.0

_landmarker  = None
_face_mesh   = None
_initialized = False

def _init_model():
    global _landmarker, _face_mesh, _initialized, USE_TASKS
    if _initialized:
        return
    _ensure_model()

    if USE_TASKS:
        options = FaceLandmarkerOptions(
            base_options=_BaseOptions(model_asset_path=MODEL_PATH),
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=4,
        )
        _landmarker = FaceLandmarker.create_from_options(options)
        print("[DetectionService] ✓ FaceLandmarker (Tasks) cargado")
    else:
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            refine_landmarks=True,
            max_num_faces=4,
        )
        print("[DetectionService] ✓ FaceMesh (Solutions) cargado")

    _initialized = True


def _get_landmarks(rgb_frame):
    global _landmarker, _face_mesh
    if USE_TASKS and _landmarker:
        mp_image = Image(image_format=ImageFormat.SRGB, data=rgb_frame)
        result   = _landmarker.detect(mp_image)
        return result.face_landmarks
    elif _face_mesh:
        results = _face_mesh.process(rgb_frame)
        if results and results.multi_face_landmarks:
            return results.multi_face_landmarks
    return []


def _eye_aspect_ratio(landmarks, indices):
    pts = [(landmarks[i].x, landmarks[i].y) for i in indices]
    v1 = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    v2 = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    h  = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return (v1 + v2) / (2.0 * h) if h > 1e-6 else 0.0


def _head_pose(landmarks, w, h):
    image_points = np.array(
        [[landmarks[i].x * w, landmarks[i].y * h] for i in FACE_2D_IDX],
        dtype="double"
    )

    focal  = float(w)
    camera = np.array([
        [focal, 0,     w / 2.0],
        [0,     focal, h / 2.0],
        [0,     0,     1.0    ]
    ], dtype="double")

    try:
        ok, rvec, _ = cv2.solvePnP(
            MODEL_POINTS_3D, image_points, camera,
            np.zeros((4, 1)), flags=cv2.SOLVEPNP_ITERATIVE
        )
    except Exception:
        return 0.0, 0.0, 0.0

    if not ok:
        return 0.0, 0.0, 0.0

    rmat, _ = cv2.Rodrigues(rvec)
    sy    = np.sqrt(rmat[0, 0] ** 2 + rmat[1, 0] ** 2)
    pitch = np.degrees(np.arctan2( rmat[2, 1], rmat[2, 2]))
    yaw   = np.degrees(np.arctan2(-rmat[2, 0], sy))
    roll  = np.degrees(np.arctan2( rmat[1, 0], rmat[0, 0]))
    return float(pitch), float(yaw), float(roll)


def _gaze_x(landmarks):
    def _cx(indices):
        return np.mean([landmarks[i].x for i in indices])
    def _w(indices):
        xs = [landmarks[i].x for i in indices]
        return (max(xs) - min(xs)) or 1e-6

    l_off = (_cx(LEFT_IRIS)  - _cx(LEFT_EYE))  / _w(LEFT_EYE)
    r_off = (_cx(RIGHT_IRIS) - _cx(RIGHT_EYE)) / _w(RIGHT_EYE)
    return float((l_off + r_off) / 2.0)


def _face_width_norm(landmarks):
    xs = [lm.x for lm in landmarks]
    return float(max(xs) - min(xs))


def _yaw_to_pct(abs_yaw_deg: float) -> float:
    pct = (abs_yaw_deg / YAW_MAX_DEG_FOR_100) * 100.0
    return float(max(0.0, min(100.0, pct)))


def analyze_frame(jpeg_bytes: bytes) -> dict:
    if not _initialized:
        _init_model()

    arr = np.frombuffer(jpeg_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return {
            "num_faces": 0,
            "faces": [],
            "events": ["FUERA_DE_ENCUADRE"],
            "primary": None,
            "status_text": "Frame inválido",
            "confidence": 0.0,
        }

    rgb  = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = bgr.shape[:2]

    all_landmarks = _get_landmarks(rgb)
    num_faces     = len(all_landmarks)

    if num_faces == 0:
        return {
            "num_faces": 0,
            "faces": [],
            "events": ["FUERA_DE_ENCUADRE"],
            "primary": None,
            "status_text": "Sin rostro detectado",
            "confidence": 0.85,
        }

    faces_info = []
    for lms in all_landmarks:
        fw = _face_width_norm(lms)
        pitch, yaw, roll = _head_pose(lms, w, h)
        gx  = _gaze_x(lms)
        ear = (_eye_aspect_ratio(lms, LEFT_EYE) + _eye_aspect_ratio(lms, RIGHT_EYE)) / 2.0

        faces_info.append({
            "face_width_norm": round(fw, 4),
            "yaw":             round(yaw, 2),
            "pitch":           round(pitch, 2),
            "roll":            round(roll, 2),
            "gaze_x":          round(gx, 4),
            "ear":             round(float(ear), 4),
            "eyes_open":       float(ear) >= EAR_CLOSED,
        })

    primary_idx = max(range(num_faces), key=lambda i: faces_info[i]["face_width_norm"])
    primary     = faces_info[primary_idx]

    events     = []
    confidence = 1.0
    status     = "✓ Rostro detectado"

    if num_faces >= 2:
        events.append("MULTIPLES_ROSTROS")
        confidence -= 0.1

    if primary["face_width_norm"] < MIN_FACE_SCALE:
        events.append("FUERA_DE_ENCUADRE")
        return {
            "num_faces": num_faces,
            "faces": faces_info,
            "events": events,
            "primary": primary,
            "status_text": "Rostro muy pequeño – alejándose",
            "confidence": 0.70,
        }

    if not primary["eyes_open"]:
        events.append("OJOS_CERRADOS")
        status     = "Ojos cerrados"
        confidence -= 0.4

    yaw_deg = float(primary["yaw"])
    abs_yaw = abs(yaw_deg)
    yaw_pct = _yaw_to_pct(abs_yaw)
    gaze    = float(primary["gaze_x"])
    lado    = "derecha" if yaw_deg > 0 else "izquierda"

    # ✅ severidad para que frontend decida si registrar o solo mostrar
    severity = "OK"

    # >85% = malo
    if yaw_pct >= YAW_PCT_BAD:
        severity = "BAD"
        events.append("MIRADA_DESVIADA")
        status = f"Cara muy girada (>85%) hacia {lado} ({abs_yaw:.0f}°)"
        confidence -= 0.5

    # 80–85% = “OK informativo”: NO evento (solo status)
    elif YAW_PCT_OK_LOW <= yaw_pct < YAW_PCT_OK_HIGH:
        severity = "OK_INFO"
        status = f"Cara girada (80–85%) hacia {lado} ({abs_yaw:.0f}°)"
        # No events.append aquí. No cuenta como advertencia.

    else:
        # Mirada desviada real por iris (si quieres)
        if abs(gaze) > GAZE_THRESH:
            severity = "WARN"
            events.append("MIRADA_DESVIADA")
            lado2 = "derecha" if gaze > 0 else "izquierda"
            status = f"Mirada desviada hacia {lado2} (yaw {abs_yaw:.0f}°)"
            confidence -= 0.2
        else:
            if "OJOS_CERRADOS" not in events:
                status = f"✓ Enfocado | Yaw: {yaw_deg:.1f}°"

    return {
        "num_faces":   num_faces,
        "faces":       faces_info,
        "events":      events,
        "primary":     primary,
        "status_text": status,
        "confidence":  round(max(0.0, min(1.0, confidence)), 2),
        "yaw_pct":     round(yaw_pct, 1),
        "severity":    severity,
    }
