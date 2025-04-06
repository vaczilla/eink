const BASE_URL = "https://thundering-bony-melody.glitch.me";
require("./cleanup");
const express = require("express");
const fs = require("fs");
const cors = require("cors");
const axios = require("axios").default;
require("dotenv").config();
const path = require("path");
const app = express();
const PORT = 3000;
const { v4: uuidv4 } = require("uuid"); 
const puppeteer = require("puppeteer");
const https = require("https");
global.ReadableStream = require("stream/web").ReadableStream;
const gm = require("gm").subClass({ imageMagick: true });
const cheerio = require("cheerio");
const multer = require("multer");
const uploadDir = path.join(__dirname, 'public'); // Directorul unde salvăm imaginile
const schedule = require('node-schedule');
const cloudinary = require("cloudinary").v2;
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { DateTime } = require("luxon");
const dbFile = path.join(__dirname, "db.json");
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY; // 🔒 Cheia este ascunsă în .env
const TIMEZONE_DB_API_KEY = process.env.TIMEZONE_DB_API_KEY;
const timeZoneApiKey = 'R4OWUVQWNWBS'; // Cheia API pentru TimeZoneDB
const timeZoneUrl = `http://api.timezonedb.com/v2.1/get-time-zone?key=${timeZoneApiKey}&format=json&by=zone&zone=Europe/Bucharest`;
const QRCode = require("qrcode");
const programatorFilePath = 'programator.json';
const dbFilePath = 'db.json'
const LOG_PATH = path.join(__dirname, "log_esp.txt");



// 🟢 Configurăm Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});



// URL-ul paginii de unde extragem datele
const URL = "https://www.meteoblue.com/ro/vreme/s%C4%83pt%C4%83m%C3%A2na/bucure%C8%99ti_rom%C3%A2nia_683506";
const URL2 = "https://www.meteoromania.ro/vremea/starea-vremii-romania/";

const JSON_FILE = "weather.json";

// 🟢 Face fișierele din /gallery și /public accesibile
app.use('/gallery', express.static(path.join(__dirname, 'gallery')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ✅ Golire cache
app.use(express.static("public", {
    setHeaders: (res, path) => {
        if (path.endsWith(".png")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
        }
    }
}));

// ✅ Expune fisierele din folderul /public
app.use(express.static('public'));

// ✅ Verifică dacă cheia API OpenAI este setată
if (!process.env.OPENAI_API_KEY) {
    console.error("⚠️  OPENAI_API_KEY nu este setată în .env!");
    process.exit(1);
}

console.log("Cheia API OpenAI a fost detectată.");

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// ✅ Funcție pentru citirea datelor din `db.json`
const loadData = () => {
    try {
        return JSON.parse(fs.readFileSync("db.json"));
    } catch {
        return { texts: [] };
    }
};

// ✅ Funcție pentru salvarea datelor în `db.json`
const saveData = (data) => {
    fs.writeFileSync("db.json", JSON.stringify(data, null, 2));
};

// ✅ Endpoint pentru salvarea unui text
app.post("/save", (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Textul este necesar" });

    let data = loadData();
    let newText = { id: Date.now().toString(), text }; // 🔥 Adăugăm un ID unic
    data.texts.push(newText);
    saveData(data);

    res.json({ message: "Text salvat cu succes!", text: newText });
});

// ✅ Endpoint pentru afișarea textelor salvate
app.get("/texts", (req, res) => {
    res.json(loadData());
});

// ✅ Endpoint pentru editarea unui text salvat (după ID)
app.put("/update/:id", (req, res) => {
    const { id } = req.params;
    const { newText } = req.body;
    let data = loadData();

    let textIndex = data.texts.findIndex(t => t.id === id);
    if (textIndex === -1) return res.status(404).json({ error: "Textul nu există" });

    data.texts[textIndex].text = newText;
    saveData(data);

    res.json({ message: "Text actualizat cu succes!" });
});

// ✅ Endpoint pentru ștergerea unui text (după ID)
app.delete("/delete/:id", (req, res) => {
    const { id } = req.params;
    let data = loadData();

    let newTexts = data.texts.filter(t => t.id !== id);
    if (newTexts.length === data.texts.length) {
        return res.status(404).json({ error: "Textul nu a fost găsit" });
    }

    saveData({ texts: newTexts });
    res.json({ message: "Text șters cu succes!" });
});


// ✅ Endpoint pentru trimiterea textului la ChatGPT și salvarea răspunsului
app.post("/chatgpt", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Textul este necesar" });

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [{ role: "user", content: text }]
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        let reply = response.data.choices[0].message.content;
        
        // 🔹 Salvăm răspunsul în baza de date, suprascriind ultimul răspuns
        let data = loadData();
        data.lastResponse = reply;  // Suprascriem cu noul răspuns
        saveData(data);

        res.json({ reply });
    } catch (error) {
        console.error("Eroare la interogarea API-ului ChatGPT:", error);
        res.status(500).json({ error: "A apărut o eroare la interogarea ChatGPT" });
    }
});


// ✅ Endpoint pentru obținerea ultimului răspuns salvat
app.get("/last-response", (req, res) => {
    let data = loadData();
    res.json({ response: data.lastResponse || "Niciun răspuns salvat încă." });
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Endpoint pentru generarea imaginii
app.post("/generate-image", async (req, res) => {
    const dbData = readDatabase();
    const dalleModel = dbData.dallemode || "dall-e-3";
    const prompt = req.body.prompt;

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/images/generations",
            {
                model: dalleModel,
                prompt: prompt,
                n: 1,
                size: "1024x1024",
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const imageUrl = response.data.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: "stream" });

        // Salvăm imaginea local pentru afișarea principală
        const mainImagePath = path.join(__dirname, "public", "generated-image.png");
        const writerMain = fs.createWriteStream(mainImagePath);
        imageResponse.data.pipe(writerMain);

        writerMain.on("finish", async () => {
            try {
                // Încărcăm imaginea pe Cloudinary
                const uploadResponse = await cloudinary.uploader.upload(mainImagePath, {
                    folder: "gallery"
                });

                console.log(`Imagine generată cu ${dalleModel} și încărcată pe Cloudinary!`);

                res.json({
                    dalleModel,
                    imageUrl: `/generated-image.png`,
                    galleryImageUrl: uploadResponse.secure_url // Link-ul Cloudinary
                });
            } catch (uploadError) {
                console.error("Eroare la încărcarea imaginii pe Cloudinary:", uploadError);
                res.status(500).json({ error: "Eroare la încărcarea imaginii pe Cloudinary." });
            }
        });

        writerMain.on("error", (err) => {
            console.error("Eroare la salvarea imaginii principale:", err);
            res.status(500).json({ error: "Eroare la salvarea imaginii." });
        });

    } catch (error) {
        console.error("Eroare la generarea imaginii:", error.response?.data || error.message);
        res.status(500).json({ error: "Eroare la generarea imaginii." });
    }
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Endpoint pentru salvarea ultimului răspuns din caseta de text de sus
app.post("/save-response", (req, res) => {
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: "Răspunsul este necesar" });

    let data = loadData();
    data.lastResponse = response; // Rescrie ultimul răspuns
    saveData(data);

    res.json({ message: "Răspuns salvat cu succes!" });
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Endpoint pentru salvarea unui răspuns cu ID unic
app.post("/save-text", (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Textul este necesar" });

    // Încarcă baza de date
    let dataPath = path.join(__dirname, "db.json");
    let data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    // Asigură-te că există array-ul 'texts'
    if (!data.texts) {
        data.texts = [];
    }

    // Adaugă noul text cu un ID unic
    const newText = {
        id: Date.now().toString(), // Sau uuidv4() dacă preferi UUID
        text: text
    };

    data.texts.push(newText);

    // Salvează datele înapoi în JSON
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");

    res.json({ message: "Text salvat cu succes!", savedText: newText });
});

// ✅ Endpoint pentru ștergerea ultimului răspuns
app.delete("/delete-response", (req, res) => {
    let data = loadData();
    
    if (!data.lastResponse) {
        return res.status(404).json({ error: "Nu există un răspuns salvat." });
    }

    // Ștergem răspunsul
    data.lastResponse = "";
    saveData(data);

    res.json({ message: "Răspunsul a fost șters cu succes." });
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Endpoint pentru listarea imaginilor din galerie
app.get("/gallery", async (req, res) => {
    try {
        const result = await cloudinary.api.resources({
            type: "upload",
            prefix: "gallery/", // Listăm doar imaginile din folderul "gallery"
            max_results: 100,
            order: "desc" // Sortare descendentă (Cloudinary nu acceptă direct această opțiune, așa că sortăm manual)
        });

        // Sortăm manual imaginile în funcție de `created_at`, de la cea mai recentă la cea mai veche
        const images = result.resources
            .map(img => ({
                public_id: img.public_id,
                url: img.secure_url,
                created_at: img.created_at
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(images);
    } catch (error) {
        console.error("Eroare la listarea imaginilor:", error);
        res.status(500).json({ error: "Eroare la obținerea imaginilor din Cloudinary." });
    }
});


// ✅ Endpoint pentru ștergerea unei imagini
app.delete("/delete-image/:publicId", async (req, res) => {
    const publicId = req.params.publicId; // Ex: "gallery/image-123456"
    
    try {
        await cloudinary.uploader.destroy(publicId);
        res.json({ success: true });
    } catch (error) {
        console.error("Eroare la ștergerea imaginii:", error);
        res.status(500).json({ error: "Eroare la ștergerea imaginii din Cloudinary." });
    }
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Endpoint pentru utilizarea imaginii
app.post("/use-image/:publicId", async (req, res) => {
    const publicId = req.params.publicId;
    const localImagePath = path.join(__dirname, "public/kindle-image.png");

    try {
        // 🔹 Obținem detaliile imaginii din Cloudinary
        const result = await cloudinary.api.resource(publicId);
        const imageUrl = result.secure_url;

        // 🔹 Descărcăm imaginea
        const response = await axios({
            url: imageUrl,
            method: "GET",
            responseType: "stream"
        });

        // 🔹 Salvăm imaginea local
        const writer = fs.createWriteStream(localImagePath);
        response.data.pipe(writer);

        writer.on("finish", () => {
            res.json({ success: true, imageUrl, localPath: "/kindle-image.png" });
        });

        writer.on("error", (error) => {
            console.error("Eroare la salvarea imaginii:", error);
            res.status(500).json({ success: false, error: "Eroare la salvarea imaginii." });
        });

    } catch (error) {
        console.error("Eroare la utilizarea imaginii:", error);
        res.status(500).json({ success: false, error: "Imaginea nu există sau a apărut o eroare." });
    }
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// 🟢 API pentru capturarea screenshot-ului și conversia în grayscale

const intervalMinutes = 2; // Modifică valoarea pentru a schimba frecvența

async function captureAndProcessScreenshot() {
    const pngPath = path.join(__dirname, "public", "screenshot.png");
    const grayscalePath = path.join(__dirname, "public", "screenshot-grayscale.png");

    try {
        console.log("📸 Capturăm screenshot...");

        // 1. Capturare screenshot cu Puppeteer
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled", "--disable-gpu", ],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 600, height: 800 });
        await page.goto(`${BASE_URL}/dashboard.html`, { waitUntil: "networkidle2" });

        // Așteptăm x secunde suplimentare pentru a ne asigura că pagina este complet încărcată
        await page.waitForFunction(() => {
        const temp = document.getElementById('weatherTemperature');
        return temp && temp.textContent.trim() !== '';
        }, { timeout: 15000 }); // Așteaptă max 15 secunde
    

        await page.screenshot({ path: pngPath, fullPage: true });
        await browser.close();

        console.log("🖼️ Screenshot salvat, convertim la grayscale...");

        // 2. Conversie în greyscale 8-bit folosind gm
        gm(pngPath)
            .gamma(1.0)  
            .modulate(100, 0)  
            .contrast(-1)  
            .type("Grayscale")  
            .bitdepth(8)  
            .define("png:color-type=0")  
            .write(grayscalePath, (err) => {
                if (err) {
                    console.error("❌ Eroare la procesarea imaginii:", err);
                } else {
                    console.log("✅ Imagine salvată ca 8-bit grayscale!");
                }
            });
    } catch (error) {
        console.error("❌ Eroare la capturare:", error);
    }
}

// 🔄 Rulează la fiecare interval setat
setInterval(captureAndProcessScreenshot, intervalMinutes * 60 * 1000);

// API manual pentru declanșare instantanee
app.get("/screenshot", async (req, res) => {
    await captureAndProcessScreenshot();
    res.json({ success: true, message: "Screenshot generat manual!" });
});





//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ Funcția care face request și parsează datele pentru Meteoblue
function scrapeWeatherData() {
    https.get(URL, (res) => {
        let html = "";

        // Construim HTML-ul din răspuns
        res.on("data", (chunk) => {
            html += chunk;
        });

        res.on("end", () => {
            const $ = cheerio.load(html);

            // ✅ Extragem datele principale
            const svgIcon = $(".current-picto img").attr("src") || "N/A";
            const temperature = $(".current-temp").text().trim().replace("°C", "") || "N/A";
            const windSpeed = $(".current-description span:first-child").text().trim() || "N/A";
            const updateTime = $(".current-description span:last-child").text().trim() || "N/A";
            const dayIcon = $(".weather-pictogram-wrapper.day img").attr("src") || "N/A";

            // ✅ Extrage doar prima valoare pentru maxTemp, minTemp, precipitation și sunHours
            const extractFirstValue = (text) => text.trim().split(/\s+/)[0] || "N/A";

            const maxTemp = extractFirstValue($(".tab-temp-max").text()).replace("°C", "");
            const minTemp = extractFirstValue($(".tab-temp-min").text()).replace("°C", "");
            const precipitation = extractFirstValue($(".tab-precip").text());
            const sunHours = extractFirstValue($(".tab-sun").text());

            // ✅ Extragem cele 8 valori procentuale pentru probabilitatea de precipitații
            const precipitationProbabilities = [];
            $(".precip-prob").each((index, element) => {
                if (index < 8) {
                    const prob = $(element).text().trim();
                    precipitationProbabilities.push(prob);
                }
            });

            // ✅ Structura finală a datelor
            const data = {
                timestamp: new Date().toISOString(),
                temperature: temperature ? `${temperature}°C` : "N/A",
                svgIcon,
                windSpeed,
                updateTime,
                dayIcon,
                maxTemp: maxTemp !== "N/A" ? `${maxTemp}°C` : "N/A",
                minTemp: minTemp !== "N/A" ? `${minTemp}°C` : "N/A",
                precipitation,
                sunHours,
                precipitationProbabilities // 🆕 Adăugăm array-ul de valori procentuale
            };

            // ✅ Salvăm datele într-un fișier JSON
            fs.writeFileSync("weather.json", JSON.stringify({ weather: [data] }, null, 2));

            //console.log("Date meteo salvate:", data);
        });
    }).on("error", (err) => {
        console.error("Eroare la extragerea datelor:", err.message);
    });
}

// ✅ Apelăm funcția
scrapeWeatherData();


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Funcția care face request și parsează datele pentru Meteoromania

function scrapeBaneasaWeather() {
    https.get(URL2, (res) => {
        let html = "";

        res.on("data", (chunk) => {
            html += chunk;
        });

        res.on("end", () => {
            const $ = cheerio.load(html);
            const section = $("#bucuresti-baneasa");
            
            if (!section.length) {
                console.error("Sectiunea Bucuresti Baneasa nu a fost gasita!");
                return;
            }

            const updateTime = section.find(".subtitle").text().trim() || "N/A";
            const iconUrl = section.find(".icon img").attr("src") || "N/A";

            const textContent = section.find(".text").html();
            if (!textContent) {
                console.error("Nu s-au găsit date meteo în secțiunea Bucuresti Baneasa!");
                return;
            }
            
            const lines = textContent.split("<br>").map(line => line.replace(/<[^>]*>/g, '').trim());
            
            const extractValue = (label) => {
                const line = lines.find(l => l.startsWith(label));
                return line ? line.split(":")[1].trim() : "N/A";
            };

            let temperature = extractValue("Temperatură").replace("°C", "").trim();
            const wind = extractValue("Vânt");
            const cloudiness = extractValue("Nebulozitate");
            const pressure = extractValue("Presiune");
            const humidity = extractValue("Umezeală relativă");
            const phenomenon = extractValue("Fenomen");

            const windMatch = wind.match(/(\d+\.\d+\s*m\/s),\s*directia\s*:\s*(\S+)/);
            const windFormatted = windMatch ? `${windMatch[1]}, directia: ${windMatch[2]}` : wind.replace(", directia", "").trim();

            const baneasaData = {
                timestamp: new Date().toISOString(),
                updateTime,
                iconUrl,
                phenomenon,
                temperature: temperature !== "N/A" ? `${temperature}` : "N/A",
                wind: windFormatted,
                cloudiness,
                pressure,
                humidity
            };

          
          
            let jsonData = {};
            if (fs.existsSync(JSON_FILE)) {
                jsonData = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
            }

            jsonData["baneasa"] = baneasaData;
            fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2));
            //console.log("Date meteo pentru Băneasa salvate:", baneasaData);
        });
    }).on("error", (err) => {
        console.error("Eroare la extragerea datelor pentru Băneasa:", err.message);
    });
}



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Functie de actualizare manuala a datelor METEO
function updateWeatherData() {
    scrapeWeatherData();
    scrapeBaneasaWeather();
    scrapeXMLWeather(); // 
}

setInterval(updateWeatherData, 10 * 60 * 1000); // Rulează o dată pe oră

updateWeatherData();

app.get("/update", (req, res) => {
    updateWeatherData();
    res.send("🔄 Actualizarea a fost declanșată!");
});

app.get("/api/weather", (req, res) => {
    fs.readFile(JSON_FILE, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Eroare la citirea fișierului" });
        const jsonData = JSON.parse(data);
        res.json(jsonData.weather || {});
    });
});

app.get("/api/baneasa", (req, res) => {
    fs.readFile(JSON_FILE, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Eroare la citirea fișierului" });
        const jsonData = JSON.parse(data);
        res.json(jsonData.baneasa || {});
    });
});

app.get("/api/xml", (req, res) => {
    fs.readFile(JSON_FILE, "utf8", (err, data) => {
        if (err) return res.status(500).json({ error: "Eroare la citirea fișierului" });
        const jsonData = JSON.parse(data);
        res.json(jsonData.xml || {});
    });
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Cumul de functii pentru butonul de upload

app.use(cors()); // Pentru a permite request-uri din frontend

// Configurare Multer pentru a salva fișierul în directorul `public/`
const storage = multer.diskStorage({
    destination: "public/",
    filename: (req, file, cb) => {
        cb(null, "generated-image.png"); // Rescrie fișierul cu acest nume
    }
});

const upload = multer({ storage });

// Endpoint pentru încărcarea imaginii
app.post("/upload-image", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Nicio imagine încărcată!" });
    }
    res.json({ success: true, message: "Imagine încărcată cu succes!" });
});

// Servirea imaginilor din `public/`
app.use(express.static("public"));



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




// ✅ Endpoint pentru a trimite imaginea în dashboard (fără salvare în galerie)
app.post("/send-to-dashboard", (req, res) => {
    const sourcePath = path.join(__dirname, "public", "generated-image.png");
    const destinationPath = path.join(__dirname, "public", "kindle-image.png");

    // Copierea imaginii în kindle-image.png
    fs.copyFile(sourcePath, destinationPath, (err) => {
        if (err) {
            console.error("Eroare la copierea kindle-image.png:", err);
            return res.status(500).json({ success: false, message: "Eroare la trimitere!" });
        }

        res.json({ success: true, message: "Imagine trimisă în dashboard!" });
    });
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Endpoint pentru butonul toggle

const dbPath = path.join(__dirname, "db.json");

// Funcție pentru citirea bazei de date
function readDatabase() {
    if (!fs.existsSync(dbPath)) {
        return { dallemode: "dall-e-3" }; // Valoare implicită
    }
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

// Endpoint pentru citirea modului
app.get("/get-dalle-mode", (req, res) => {
    const dbData = readDatabase();
    res.json({ dallemode: dbData.dallemode || "dall-e-3" });
});

// Endpoint pentru actualizarea modului
app.post("/set-dalle-mode", (req, res) => {
    const { dallemode } = req.body;
    if (!dallemode) return res.status(400).json({ error: "Valoare invalidă" });

    const dbData = readDatabase();
    dbData.dallemode = dallemode;

    fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), "utf8");
    res.json({ success: true, dallemode });
});


// ✅ Endpoint pentru a salva imaginea în /gallery/
app.post("/save-image", async (req, res) => {
    const sourcePath = path.join(__dirname, "public", "generated-image.png");

    try {
        if (!fs.existsSync(sourcePath)) {
            return res.status(404).json({ success: false, message: "Imaginea nu a fost găsită!" });
        }

        // Încărcăm imaginea pe Cloudinary
        const result = await cloudinary.uploader.upload(sourcePath, {
            folder: "gallery" // Folderul unde se salvează imaginile pe Cloudinary
        });

        // Ștergem imaginea locală după încărcare (opțional)
        // fs.unlinkSync(sourcePath);

        res.json({ success: true, message: "Imagine salvată!", imageUrl: result.secure_url });
    } catch (error) {
        console.error("Eroare la încărcare pe Cloudinary:", error);
        res.status(500).json({ success: false, message: "Eroare la încărcare!" });
    }
});



//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Endpoint pentru extragere date XML
async function scrapeXMLWeather() {
  try {
    console.log("🔄 Începem extragerea prognozei din XML...");

    // Descărcăm fișierul XML
    const response = await axios.get("https://www.meteoromania.ro/anm/prognoza-orase-xml.php");
    const xmlData = response.data;

    // Căutăm secțiunea <localitate nume="Bucuresti"> ... </localitate>
    const localitateMatch = xmlData.match(/<localitate\s+[^>]*nume="Bucuresti"[^>]*>([\s\S]*?)<\/localitate>/i);
    if (!localitateMatch) throw new Error("❌ București nu a fost găsit în XML.");
    const localitateContent = localitateMatch[1];

    // Extragem prima secțiune <prognoza>...</prognoza>
    const prognozaMatch = localitateContent.match(/<prognoza[^>]*>([\s\S]*?)<\/prognoza>/i);
    if (!prognozaMatch) throw new Error("❌ Nu s-a găsit prognoza pentru București.");
    const prognozaContent = prognozaMatch[1];

    // Extragem temperatura minimă
    const tempMinMatch = prognozaContent.match(/<temp_min[^>]*>([\s\S]*?)<\/temp_min>/i);
    if (!tempMinMatch) throw new Error("❌ Nu s-a găsit temperatura minimă.");
    const tempMin = tempMinMatch[1].trim();

    // Extragem temperatura maximă
    const tempMaxMatch = prognozaContent.match(/<temp_max[^>]*>([\s\S]*?)<\/temp_max>/i);
    if (!tempMaxMatch) throw new Error("❌ Nu s-a găsit temperatura maximă.");
    const tempMax = tempMaxMatch[1].trim();

    // Extragem descrierea fenomenului
    const fenomenMatch = prognozaContent.match(/<fenomen_descriere[^>]*>([\s\S]*?)<\/fenomen_descriere>/i);
    if (!fenomenMatch) throw new Error("❌ Nu s-a găsit descrierea fenomenului.");
    const fenomen = fenomenMatch[1].trim();

    console.log(`🌡️ București: ${tempMin}°C - ${tempMax}°C, ${fenomen}`);

    // Citim datele existente din weather.json
    let weatherData = {};
    if (fs.existsSync(JSON_FILE)) {
      console.log("📂 Fișierul weather.json există. Îl citim...");
      try {
        const fileContent = fs.readFileSync(JSON_FILE, "utf8");
        weatherData = JSON.parse(fileContent);
      } catch (parseError) {
        console.error("❌ Eroare la parsarea JSON-ului existent! Se va rescrie fișierul.", parseError);
        weatherData = {}; // Resetăm dacă JSON-ul este corupt
      }
    } else {
      console.log("📄 Fișierul weather.json nu există. Se va crea unul nou...");
      weatherData = {};
    }

    // Verificăm structura inițială a bazei de date
    //console.log("📊 Structura actuală a bazei de date:", JSON.stringify(weatherData, null, 2));

    // Actualizăm secțiunea "xml" cu noile date
    weatherData.xml = {
      timestamp: new Date().toISOString(),
      minTemp: `${tempMin}°C`,
      maxTemp: `${tempMax}°C`,
      prognoza: fenomen
    };

    // Verificăm structura finală a bazei de date înainte de salvare
    //console.log("📊 Structura finală a bazei de date înainte de salvare:", JSON.stringify(weatherData, null, 2));

    // Salvăm datele în weather.json
    fs.writeFileSync(JSON_FILE, JSON.stringify(weatherData, null, 2), "utf8");
    //console.log("✅ Datele au fost actualizate în weather.json!");

  } catch (error) {
    console.error("❌ Eroare la extragerea datelor din XML:", error);
  }
}

// Apelăm funcția pentru test
scrapeXMLWeather();


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


const BATTERY_FILE = "battery.json";
const MAX_REPORTS = 6000;

// ✅ Endpoint pentru a primi datele bateriei de la Kindle
app.get("/updateBattery", (req, res) => {
    const batteryLevel = req.query.batteryLevel;
    const isCharging = req.query.isCharging === "1" ? true : false;

    if (!batteryLevel) {
        return res.status(400).json({ error: "Missing batteryLevel parameter" });
    }

    // Citim datele existente
    let batteryData = [];
    if (fs.existsSync(BATTERY_FILE)) {
        batteryData = JSON.parse(fs.readFileSync(BATTERY_FILE, "utf8"));
    }

    // Adăugăm noua raportare
    const newEntry = {
        timestamp: new Date().toISOString(),
        batteryLevel: Number(batteryLevel),
        isCharging
    };
    batteryData.push(newEntry);

    // Limităm la ultimele XX de intrări
    if (batteryData.length > MAX_REPORTS) {
        batteryData = batteryData.slice(-MAX_REPORTS);
    }

    // Salvăm actualizările în fișier
    fs.writeFileSync(BATTERY_FILE, JSON.stringify(batteryData, null, 2));

    console.log("Received battery update:", newEntry);
    res.json({ message: "Battery status updated successfully", data: newEntry });
});

// ✅ Endpoint pentru a obține datele bateriei
app.get("/battery", (req, res) => {
    if (fs.existsSync(BATTERY_FILE)) {
        const batteryData = JSON.parse(fs.readFileSync(BATTERY_FILE, "utf8"));
        res.json(batteryData);
    } else {
        res.json({ error: "No battery data available" });
    }
});

// ✅ Endpoint pentru a obține ultima intrare din baza de date
app.get("/battery/latest", (req, res) => {
    if (fs.existsSync(BATTERY_FILE)) {
        const batteryData = JSON.parse(fs.readFileSync(BATTERY_FILE, "utf8"));
        if (batteryData.length > 0) {
            res.json(batteryData[batteryData.length - 1]); // Returnează ultima intrare
        } else {
            res.json({ error: "No battery data available" });
        }
    } else {
        res.json({ error: "No battery data available" });
    }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


const VOLTAGE_FILE = "esp.json";
const MAX_ENTRIES = 6000;

// ✅ Endpoint pentru a primi datele de tensiune de la ESP32
app.get("/updateVoltage", (req, res) => {
    const voltage = req.query.voltage;

    if (!voltage) {
        return res.status(400).json({ error: "Missing voltage parameter" });
    }

    // Citim datele existente
    let voltageData = [];
    if (fs.existsSync(VOLTAGE_FILE)) {
        voltageData = JSON.parse(fs.readFileSync(VOLTAGE_FILE, "utf8"));
    }

    // Adăugăm noua înregistrare
    const newEntry = {
        timestamp: new Date().toISOString(),
        voltage: Number(voltage)
    };
    voltageData.push(newEntry);

    // Limităm la ultimele MAX_ENTRIES înregistrări
    if (voltageData.length > MAX_ENTRIES) {
        voltageData = voltageData.slice(-MAX_ENTRIES);
    }

    // Salvăm datele actualizate în fișier
    fs.writeFileSync(VOLTAGE_FILE, JSON.stringify(voltageData, null, 2));

    console.log("[SERVER] Received voltage update:", newEntry);
    res.json({ message: "Voltage status updated successfully", data: newEntry });
});

// ✅ Endpoint pentru a obține toate datele de tensiune
app.get("/voltage", (req, res) => {
    if (fs.existsSync(VOLTAGE_FILE)) {
        const voltageData = JSON.parse(fs.readFileSync(VOLTAGE_FILE, "utf8"));
        res.json(voltageData);
    } else {
        res.json({ error: "No voltage data available" });
    }
});

// ✅ Endpoint pentru a obține cea mai recentă valoare a tensiunii
app.get("/voltage/latest", (req, res) => {
    if (fs.existsSync(VOLTAGE_FILE)) {
        const voltageData = JSON.parse(fs.readFileSync(VOLTAGE_FILE, "utf8"));
        if (voltageData.length > 0) {
            res.json(voltageData[voltageData.length - 1]); // Returnează ultima înregistrare
        } else {
            res.json({ error: "No voltage data available" });
        }
    } else {
        res.json({ error: "No voltage data available" });
    }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Google Translate API
app.post("/translate", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: "Textul este necesar pentru traducere." });
        }

        const googleTranslateURL = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;

        const response = await fetch(googleTranslateURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q: text,
                source: "ro",
                target: "en",
                format: "text"
            })
        });

        const data = await response.json();

        if (!response.ok || !data.data || !data.data.translations || data.data.translations.length === 0) {
            throw new Error("Eroare la traducerea textului.");
        }

        res.json({ translatedText: data.data.translations[0].translatedText });

    } catch (error) {
        console.error("❌ Eroare la traducere:", error);
        res.status(500).json({ error: error.message });
    }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Funcție de scriere în baza de date informații legate de programare
app.post('/save-schedule', (req, res) => {
    const scheduleData = req.body;

    // Asigură-te că adăugăm cheia `executed` cu valoarea implicită false
    scheduleData.executed = false;

    // Verifică dacă fișierul 'programator.json' există și îl creează dacă nu există
    if (!fs.existsSync(programatorFilePath)) {
        // Dacă fișierul nu există, îl creăm cu un array gol
        fs.writeFileSync(programatorFilePath, JSON.stringify([], null, 2), 'utf8');
        console.log("✅ Fișierul programator.json nu exista, a fost creat.");
    }

    // Citirea datelor existente din programator.json
    fs.readFile(programatorFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("❌ Eroare la citirea programator.json:", err);
            return res.status(500).json({ message: "Eroare la citirea fișierului de programare" });
        }

        let programator;
        try {
            programator = JSON.parse(data);
        } catch (parseErr) {
            console.error("❌ Eroare la parsarea programator.json:", parseErr);
            return res.status(500).json({ message: "Eroare la parsarea fișierului de programare" });
        }

        // Dacă nu există încă o listă de programări, o inițializăm
        if (!programator) {
            programator = [];
        }

        // Adăugăm noua programare la lista existentă
        programator.push(scheduleData);

        // Scrierea datelor actualizate în programator.json
        fs.writeFile(programatorFilePath, JSON.stringify(programator, null, 2), 'utf8', (err) => {
            if (err) {
                console.error("❌ Eroare la salvarea datelor în programator.json:", err);
                return res.status(500).json({ message: "Eroare la salvarea fișierului de programare" });
            }

            console.log("✅ Programare salvată cu succes!");
            res.status(200).json({ message: "Programare salvată cu succes!" });
        });
    });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ Funcție pentru traducerea textului
async function translateText(text) {
    try {
        console.log("📤 Trimitere la Google Translate:", text); // Logăm textul care se trimite

        const googleTranslateURL = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
        const response = await fetch(googleTranslateURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q: text,
                source: "ro",
                target: "en",
                format: "text"
            })
        });

        const data = await response.json();

        console.log("📥 Răspuns de la Google Translate:", data); // Logăm răspunsul primit de la Google Translate

        return data?.data?.translations?.[0]?.translatedText || "";
    } catch (error) {
        console.error("❌ Eroare la traducere:", error);
        return "";
    }
}


// ✅ Funcție pentru a trimite textul tradus la DALL-E și a salva imaginea
async function sendToDalle(text) {
    console.log("📤 Trimitere la DALL-E:", text);

    try {
        // Apelul către API-ul DALL-E pentru generarea imaginii
        const response = await axios.post(
            "https://api.openai.com/v1/images/generations",
            {
                model: "dall-e-3", // Sau un alt model dacă este cazul
                prompt: text,
                n: 1,
                size: "1024x1024", // Dimensiunea imaginii
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const imageUrl = response.data.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: "stream" });

        // Salvăm imaginea generată local
        const mainImagePath = path.join(__dirname, "public", "generated-image.png");
        const writerMain = fs.createWriteStream(mainImagePath);
        imageResponse.data.pipe(writerMain);

        writerMain.on("finish", async () => {
            try {
                // După salvarea imaginii locale, o încărcăm pe Cloudinary
                const uploadResponse = await cloudinary.uploader.upload(mainImagePath, {
                    folder: "gallery" // Opțional: specifici folderul din Cloudinary
                });

                console.log(`Imagine generată și încărcată pe Cloudinary!`);

                // Răspuns cu URL-ul imaginii Cloudinary
                return uploadResponse.secure_url; // URL-ul imaginii încărcate pe Cloudinary
            } catch (uploadError) {
                console.error("Eroare la încărcarea imaginii pe Cloudinary:", uploadError);
                return null;
            }
        });

        writerMain.on("error", (err) => {
            console.error("Eroare la salvarea imaginii principale:", err);
            return null;
        });

    } catch (error) {
        console.error("Eroare la trimiterea textului către DALL-E:", error.response?.data || error.message);
        return null;
    }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// ✅ Funcție pentru a verifica și executa programatorul
async function getBucharestTime() {
    try {
        console.log("🕒 Obținem ora actuală din București...");
        const response = await fetch(timeZoneUrl);
        const data = await response.json();
        const currentTime = data.formatted.split(' ')[1].slice(0, 5); // HH:MM
        console.log(`✅ Ora curentă în București: ${currentTime}`);
        return currentTime;
    } catch (error) {
        console.error("❌ Eroare la obținerea orei din București:", error);
        return null;
    }
}

// ✅ Funcție pentru a obține datele meteo din API
async function getWeatherData() {
    try {
        console.log("🌦️ Obținem datele meteo...");
        const response = await fetch(`${BASE_URL}/api/xml`);
        const weatherData = await response.json();
        console.log("✅ Date meteo obținute:", weatherData);
        return weatherData;
    } catch (error) {
        console.error("❌ Eroare la obținerea datelor meteo:", error);
        return null;
    }
}

// ✅ Funcție pentru a înlocui etichetele meteo în text
function replaceWeatherTags(text, weatherData) {
    return text
        .replace(/#minTemp/g, weatherData.minTemp || "N/A")
        .replace(/#maxTemp/g, weatherData.maxTemp || "N/A")
        .replace(/#prognoza/g, weatherData.prognoza || "N/A");
}

async function executeScheduledTasks() {
    console.log("🔄 Verificăm programările...");
    const currentTime = await getBucharestTime();
    if (!currentTime) return;

    fs.readFile(programatorFilePath, 'utf8', async (err, data) => {
        if (err) {
            console.error("❌ Eroare la citirea programator.json:", err);
            return;
        }

        let schedules;
        try {
            schedules = JSON.parse(data);
            console.log("📂 Programări citite din programator.json", schedules);
        } catch (parseErr) {
            console.error("❌ Eroare la parsarea programator.json:", parseErr);
            return;
        }

        fs.readFile(dbFilePath, 'utf8', async (err, dbData) => {
            if (err) {
                console.error("❌ Eroare la citirea db.json:", err);
                return;
            }

            let db;
            try {
                db = JSON.parse(dbData);
                console.log("📂 Baza de date citită din db.json", db);
            } catch (parseErr) {
                console.error("❌ Eroare la parsarea db.json:", parseErr);
                return;
            }

            for (const schedule of schedules) {
                if (!schedule.executed && schedule.time === currentTime) {
                    // Verificăm dacă există textId sau imageUrl
                    if (schedule.textId) {
                        console.log(`🔍 Căutăm textId: ${schedule.textId} în db.json`);
                        const textEntry = db.texts.find(entry => entry.id === schedule.textId);
                        
                        if (textEntry && textEntry.text) {
                            console.log(`📌 Text găsit pentru textId ${schedule.textId}: ${textEntry.text}`);
                            const translatedText = await translateText(textEntry.text);
                            console.log(`🌍 Traducere: ${translatedText}`);

                            // ✅ Apelăm funcția sendToDalle pentru generarea imaginii
                            await sendToDalleProgram(translatedText);

                            schedule.executed = true;
                        } else {
                            console.warn(`⚠️ Nu s-a găsit text pentru textId: ${schedule.textId}`);
                        }
                    }

                    // Verificăm dacă avem imageUrl în loc de textId
                    if (schedule.imageUrl) {
                        console.log(`🔍 Descărcăm imaginea de la ${schedule.imageUrl}`);

                        try {
                            const response = await axios.get(schedule.imageUrl, { responseType: 'arraybuffer' });
                            const imageBuffer = response.data;
                            const imagePath = 'public/kindle-image.png';

                            fs.writeFile(imagePath, imageBuffer, (err) => {
                                if (err) {
                                    console.error("❌ Eroare la salvarea imaginii:", err);
                                } else {
                                    console.log("✅ Imaginea a fost descărcată și salvată ca kindle-image.png");
                                }
                            });
                        } catch (downloadErr) {
                            console.error("❌ Eroare la descărcarea imaginii:", downloadErr);
                        }

                        schedule.executed = true;
                    }
                }
            }

            fs.writeFile(programatorFilePath, JSON.stringify(schedules, null, 2), 'utf8', err => {
                if (err) {
                    console.error("❌ Eroare la actualizarea programator.json:", err);
                } else {
                    console.log("✅ Programator.json actualizat cu programările executate.");
                }
            });
        });
    });
}

setInterval(executeScheduledTasks, 60000); // Rulează funcția la fiecare minut


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ Funcție pentru a trimite textul tradus la DALL-E și a salva imaginea
async function sendToDalleProgram(text) {
    console.log("📤 Trimitere la DALL-E:", text);

    try {
        // Apelul către API-ul DALL-E pentru generarea imaginii
        const response = await axios.post(
            "https://api.openai.com/v1/images/generations",
            {
                model: "dall-e-3", // Sau un alt model dacă este cazul
                prompt: text,
                n: 1,
                size: "1024x1024", // Dimensiunea imaginii
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const imageUrl = response.data.data[0].url;
        const imageResponse = await axios.get(imageUrl, { responseType: "stream" });

        // Salvăm imaginea generată local
        const mainImagePath = path.join(__dirname, "public", "kindle-image.png");
        const writerMain = fs.createWriteStream(mainImagePath);
        imageResponse.data.pipe(writerMain);

        writerMain.on("finish", async () => {
            try {
                // După salvarea imaginii locale, o încărcăm pe Cloudinary
                const uploadResponse = await cloudinary.uploader.upload(mainImagePath, {
                    folder: "gallery" // Opțional: specifici folderul din Cloudinary
                });

                console.log(`Imagine generată și încărcată pe Cloudinary!`);

                // Răspuns cu URL-ul imaginii Cloudinary
                return uploadResponse.secure_url; // URL-ul imaginii încărcate pe Cloudinary
            } catch (uploadError) {
                console.error("Eroare la încărcarea imaginii pe Cloudinary:", uploadError);
                return null;
            }
        });

        writerMain.on("error", (err) => {
            console.error("Eroare la salvarea imaginii principale:", err);
            return null;
        });

    } catch (error) {
        console.error("Eroare la trimiterea textului către DALL-E:", error.response?.data || error.message);
        return null;
    }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Funcție pentru afisarea programarilor in pagina HTML
app.post('/delete-schedule', (req, res) => {
    const { index } = req.body;
    fs.readFile('programator.json', 'utf8', (err, data) => {
        if (err) return res.status(500).send('Eroare la citirea fișierului.');

        let schedules = JSON.parse(data);
        schedules.splice(index, 1); // Șterge programarea la indexul dat

        fs.writeFile('programator.json', JSON.stringify(schedules, null, 2), 'utf8', (err) => {
            if (err) return res.status(500).send('Eroare la salvarea fișierului.');
            res.send('Programare ștearsă cu succes.');
        });
    });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Endpoint pentru a obține programările
app.get('/api/programator', (req, res) => {
    const programatorFilePath = path.join(__dirname, 'programator.json');

    fs.readFile(programatorFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("❌ Eroare la citirea programator.json:", err);
            return res.status(500).json({ error: "Nu am putut citi fișierul programator.json" });
        }

        try {
            const schedules = JSON.parse(data);
            res.json(schedules); // Returnează programările ca răspuns JSON
        } catch (parseErr) {
            console.error("❌ Eroare la parsarea programator.json:", parseErr);
            res.status(500).json({ error: "Eroare la parsarea fișierului JSON" });
        }
    });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Stergere programare
app.delete('/api/programator/:index', (req, res) => {
    const programatorFilePath = path.join(__dirname, 'programator.json');
    const { index } = req.params;  // Folosim indexul programării

    fs.readFile(programatorFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("❌ Eroare la citirea programator.json:", err);
            return res.status(500).json({ error: "Nu am putut citi fișierul programator.json" });
        }

        try {
            const schedules = JSON.parse(data);
            const updatedSchedules = schedules.filter((_, i) => i !== parseInt(index));  // Filtrăm folosind indexul

            fs.writeFile(programatorFilePath, JSON.stringify(updatedSchedules, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error("❌ Eroare la actualizarea programator.json:", err);
                    return res.status(500).json({ error: "Eroare la salvarea fișierului programator.json" });
                }

                res.json({ message: 'Programarea a fost ștearsă cu succes.' });
            });
        } catch (parseErr) {
            console.error("❌ Eroare la parsarea programator.json:", parseErr);
            res.status(500).json({ error: "Eroare la parsarea fișierului JSON" });
        }
    });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ Funcția de salvare QR code
const multerStorage = multer.diskStorage({
    destination: path.join(__dirname, "public"),
    filename: (req, file, cb) => {
        cb(null, "qr.png");
    }
});
const qrUpload = multer({ storage: multerStorage });

// Servirea fișierelor statice din /public
app.use(express.static(path.join(__dirname, "public")));

// ✅ Endpoint pentru upload QR cod
app.post("/upload", qrUpload.single("qrImage"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Eroare la încărcare" });
    }
    res.json({ success: true, message: "Imaginea a fost încărcată cu succes", path: "/qr.png" });
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


// ✅ Functie de stergere cod QR local
app.post("/deleteQR", (req, res) => {
    const qrPath = "public/qr.png";

    if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Fișierul nu există." });
    }
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Endpoint pentru generarea și salvarea unui QR Code
app.post("/generateQR", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, message: "Lipsă URL!" });
    }

    const filePath = path.join(__dirname, "public", "qr.png");

    try {
        await QRCode.toFile(filePath, url, { width: 300 });
        res.json({ success: true, message: "Cod QR generat cu succes!", path: "/qr.png" });
    } catch (error) {
        console.error("Eroare la generare QR:", error);
        res.status(500).json({ success: false, message: "Eroare la generare QR!" });
    }
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ✅ Middleware ca să poți primi plain text
app.use("/log", express.text());

app.post("/log", (req, res) => {
  const content = req.body;

  if (!content || content.trim() === "") {
    return res.status(400).send("No content received.");
  }

  // Adăugăm timestamp
  const logEntry = `[${new Date().toISOString()}]\n${content}\n\n`;

  fs.appendFile(LOG_PATH, logEntry, (err) => {
    if (err) {
      console.error("Eroare la salvarea logului:", err);
      return res.status(500).send("Eroare la scriere.");
    }
    res.status(200).send("Log salvat cu succes!");
  });
});


// ✅ Middleware ca accesez xontinutul prin API
app.get("/log", (req, res) => {
  fs.readFile(LOG_PATH, "utf-8", (err, data) => {
    if (err) return res.status(500).send("Eroare la citirea logului.");
    res.set("Content-Type", "text/plain");
    res.send(data);
  });
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 🔸 Middleware pentru a parsa corpul JSON al cererilor
app.use(express.json());

// 🔹 Servește fișierele statice (ex: HTML, JS, CSS)
app.use(express.static("public"));

// 🔸 Calea către fișierul de config
const configPath = path.join(__dirname, "config.json");

// 🔹 API: Returnează conținutul config.json
app.get("/config", (req, res) => {
  fs.readFile(configPath, "utf8", (err, data) => {
    if (err) {
      console.error("Eroare la citirea config.json:", err);
      return res.status(500).json({ error: "Eroare la citirea fișierului" });
    }

    try {
      const config = JSON.parse(data);
      res.json(config);
    } catch (parseErr) {
      console.error("Eroare la parsarea JSON:", parseErr);
      res.status(500).json({ error: "Config invalid" });
    }
  });
});

// 🔹 API: Primește configurarea și o salvează în config.json
app.post("/config", (req, res) => {
  const newConfig = req.body;

  // 💡 Opțional: poți valida datele aici dacă vrei

  fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), (err) => {
    if (err) {
      console.error("Eroare la scrierea config.json:", err);
      return res.status(500).json({ error: "Eroare la salvare" });
    }
    res.json({ message: "Config salvat cu succes" });
  });
});


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 🚀 Pornim serverul
app.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});