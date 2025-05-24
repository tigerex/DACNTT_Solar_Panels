import cv2
import numpy as np
import math

def calculate_angle(pt1, pt2, pt3):
    """
    Tính góc tại điểm pt2 giữa pt1 và pt3.
    """
    a = np.array(pt1)
    b = np.array(pt2)
    c = np.array(pt3)

    ab = a - b
    cb = c - b

    cosine_angle = np.dot(ab, cb) / (np.linalg.norm(ab) * np.linalg.norm(cb))
    angle = np.arccos(cosine_angle)
    return np.degrees(angle)

def calculate_parallelogram_area(a: float, b: float, angle_deg: float) -> float:
    """
    Tính diện tích hình bình hành với góc nghiêng.
    """
    angle_rad = math.radians(angle_deg)
    return a * b * math.sin(angle_rad)

def detect_roof_shape(image_path: str) -> dict:
    """
    Phân tích hình dạng mái nhà từ ảnh: hình chữ nhật hay bình hành.
    """
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for cnt in contours:
        epsilon = 0.02 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)

        if len(approx) == 4:
            pts = [tuple(p[0]) for p in approx]
            angles = []
            for i in range(4):
                angle = calculate_angle(pts[i - 1], pts[i], pts[(i + 1) % 4])
                angles.append(angle)

            if all(88 <= a <= 92 for a in angles):
                return {"shape": "rectangle", "angles": angles}
            else:
                return {"shape": "parallelogram", "angles": angles}

    return {"shape": "unknown", "angles": []}
