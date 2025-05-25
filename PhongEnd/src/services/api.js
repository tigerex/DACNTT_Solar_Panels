export async function fetchDetectionResult(lat, lng, zoom) {
  const url = `http://localhost:8000/detect?lat=${lat}&lng=${lng}&zoom=${zoom}`; // URL của API, gồm vĩ độ, kinh độ và zoom level
  const res = await fetch(url);
  if (!res.ok) throw new Error("Backend error");
  return await res.json();
}
