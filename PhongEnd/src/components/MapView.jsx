
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import 'mapbox-gl/dist/mapbox-gl.css';




mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN; // Lấy token từ env


export default function MapView({ onLocationSelected }) {
  const mapContainer = useRef(null);    // Tham chiếu đến thẻ div chứa bản đồ
  const mapRef = useRef(null);          // Tham chiếu đến đối tượng bản đồ
  const markerRef = useRef(null);       // Tham chiếu đến đối tượng marker

  // Khởi tạo bản đồ khi component được mount
  useEffect(() => {
    const map = mapRef.current = new mapboxgl.Map({ // mapRef blabla tui chưa hiểu nên chưa chỉnh code gì nhiều ::)). Minh: gà! tui chỉnh rồi đó
      container: mapContainer.current,              // thẻ div chứa bản đồ
      style: "mapbox://styles/mapbox/satellite-v9", // hoặc satellite-v9
      center: [106.695767, 10.777649],              // tọa độ Dinh Độc Lập, [lng, lat]
      zoom: 15,                                     // mức zoom ban đầu
      maxZoom: 20,                                  // mức zoom tối đa
      minZoom: 0,                                   // mức zoom tối thiểu, để vậy mới thấy được toàn bộ thế giới
    });

    const geocoder = new MapboxGeocoder({ // tìm kiếm địa chỉ
      accessToken: mapboxgl.accessToken,  // token
      mapboxgl: mapboxgl,
      placeholder: "Tìm địa chỉ...",
      language: "vi",
      // countries: "vn",
      marker: true, // tự đặt marker
    });

    mapRef.current.addControl(geocoder); // thêm điều khiển tìm kiếm vào bản đồ

    // Lắng nghe sự kiện chọn địa chỉ
    // Này là lúc search địa chỉ, bấm enter cái nó move qua địa chỉ đó nè
    geocoder.on("result", (e) => {
      const { center, place_name } = e.result;
      console.log("Tọa độ:", center);      // [lng, lat]
      console.log("Địa chỉ:", place_name); // tên địa điểm

      // Có thể lưu vào state / gửi về backend tại đây
    });

    // Còn này là khi click vào nhà nào đó, nó sẽ lấy tọa độ latlng và gửi về cho component cha
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat; // lấy tọa độ click

      if (markerRef.current) markerRef.current.remove(); // xóa marker cũ nếu có
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map); // thêm marker mới

      // Cho gọi ra ngoài component
      onLocationSelected({ lat, lng }); // Để ý cái onLocation này nằm bên App.jsx nè, có nhiệm vụ truyền dữ liệu tọa độ cho resultview
      return () => map.remove(); // xóa bản đồ khi component unmount
    });

    return () => mapRef.current.remove(); // xóa bản đồ khi component unmount
  }, []);


  // Hiển thị bản đồ
  return (
    <div>
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}

