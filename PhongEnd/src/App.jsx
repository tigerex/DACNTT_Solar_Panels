

// // Using Mapbox
// import * as React from 'react';
// import Map from 'react-map-gl/mapbox';
// import 'mapbox-gl/dist/mapbox-gl.css';

// function App() {
//   return (
//     <Map
//       mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
//       initialViewState={{
//         longitude: -82.983330,
//         latitude: 39.983334,
//         zoom: 18
//       }}
//       style={{width: "100vw", height: "100vh"}}
//       mapStyle="mapbox://styles/mapbox/satellite-v9"
//     />
//   );
// }

// export default App;



import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import 'mapbox-gl/dist/mapbox-gl.css';




mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9", // hoặc satellite-v9
      center: [106.660172, 10.762622],
      zoom: 13,
    });

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      placeholder: "Tìm địa chỉ ở Việt Nam...",
      language: "vi",
      countries: "vn",
      marker: true, // tự đặt marker
    });

    mapRef.current.addControl(geocoder);

    // Lắng nghe sự kiện chọn địa chỉ
    geocoder.on("result", (e) => {
      const { center, place_name } = e.result;
      console.log("Tọa độ:", center);      // [lng, lat]
      console.log("Địa chỉ:", place_name); // tên địa điểm

      // Có thể lưu vào state / gửi về backend tại đây
    });

    return () => mapRef.current.remove();
  }, []);

  return (
    <div>
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}

export default App;

