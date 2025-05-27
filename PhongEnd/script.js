
require([
    "esri/config",
    "esri/Map",
    "esri/views/MapView",
    "esri/widgets/Search",
    "esri/layers/GraphicsLayer",
    "esri/widgets/Sketch",
    "esri/Graphic"
], function (esriConfig, Map, MapView, Search, GraphicsLayer, Sketch, Graphic) {
    esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurPZ-HBZOUE5l2YkFpVQCD202nXLSVhGEjQsJy2S7Av-zjM6GIpC4zF0icGYRZXhjvmMjAtky2xAsMJosLE1psQg6DCbdQEF4peKzp3QQ1xQqcj_CqU6H5LNw5I-kdCH4P5S_IsKcRd8m1fTAr0VusR6DrtxB1KGy7DC6Q2niAlemV03Y2NprTFst9rSPkfJ2LRgbtDFNKfSzfznDmt8UObs.AT1_q156qTbG";

    const graphicsLayer = new GraphicsLayer();
    const map = new Map({
        basemap: "arcgis/imagery", // hoặc "satellite" nếu imagery lỗi
        layers: [graphicsLayer] // Thêm GraphicsLayer vào bản đồ
    });

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [106.6601, 10.7626],
        zoom: 18,
        constraints: {
            maxZoom: 21,
            minZoom: 15
        },
        // popup: null
    });

    view.when(() => {
        const search = new Search({
            view: view,
            includeDefaultSources: true,
            popupEnabled: true,
            goToOverride: (view, goToParams) => {
                return view.goTo(goToParams.target); // ✅ bắt buộc map phải di chuyển
            }
        });

        view.ui.add(search, "top-right");
    });

    const sketch = new Sketch({
        layer: graphicsLayer,
        view: view,
        availableCreateTools: ["polygon"],
        creationMode: "single"
    });

    view.ui.add(sketch, "top-right");

    sketch.on("create", function (event) {
        if (event.state === "complete") {
            const polygon = event.graphic.geometry;
            const coords = polygon.rings[0].map(pt => ({
                lng: pt[0],
                lat: pt[1]
            }));

            console.log("Tọa độ polygon:", coords);

            // Gửi về backend
            // Gửi polygon về backend
            fetch("http://localhost:8001/api/polygon", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ coordinates: coords })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.image) {
                        document.getElementById("resultBox").style.display = "block";
                        document.getElementById("staticMap").src = `data:image/png;base64,${data.image}`;
                        document.getElementById("toggleBtn").addEventListener("click", () => {
                            document.getElementById("resultBox").style.display = "none";
                            document.getElementById("toggleBtn").style.display = "none";
                            document.getElementById("reopenBtn").style.display = "flex";
                        });

                        document.getElementById("reopenBtn").addEventListener("click", () => {
                            document.getElementById("resultBox").style.display = "block";
                            document.getElementById("toggleBtn").style.display = "flex";
                            document.getElementById("reopenBtn").style.display = "none";
                        });



                    } else {
                        alert("Không lấy được ảnh!");
                    }
                })
                .catch(err => console.error("Lỗi khi gửi polygon:", err));
        }
    });

});