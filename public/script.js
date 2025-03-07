document.addEventListener("DOMContentLoaded", () => {
    loadTexts();
    loadLastResponse();
});

// ✅ Salvează textul introdus în baza de date și afișează notificări toast
function saveText() {
    let textInput = document.getElementById("textInput").value;
    if (!textInput.trim()) return;

    fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput })
    })
    .then(response => response.json())
    .then(() => {
        document.getElementById("textInput").value = "";
        loadTexts();
        
        // ✅ Notificare toast pentru succes
        showToast("Text salvat cu succes!", "bg-success");
    })
    .catch(error => {
        console.error("Eroare la salvarea textului:", error);
        
        // ❌ Notificare toast pentru eroare
        showToast("Eroare la salvare!", "bg-danger");
    });
}




let selectedTextId = null; // ID-ul textului selectat

// ✅ Încarcă lista de texte salvate și înlocuiește etichetele cu datele meteo
function loadTexts() {
    fetch("/api/xml")
        .then(response => response.json())
        .then(weatherData => {
            return fetch("/texts")
                .then(response => response.json())
                .then(data => ({ weatherData, texts: data.texts }));
        })
        .then(({ weatherData, texts }) => {
            let textList = document.getElementById("textList");
            textList.innerHTML = "";

            texts.forEach(({ id, text }) => {
                let updatedText = text
                    .replace(/#minTemp/g, weatherData.minTemp)
                    .replace(/#maxTemp/g, weatherData.maxTemp)
                    .replace(/#prognoza/g, weatherData.prognoza);

                let li = document.createElement("li");
                li.className = "list-group-item d-flex align-items-start gap-2 selectable-text";
                li.id = `text-${id}`;
                li.dataset.id = id; // Salvăm ID-ul textului

                // ✅ Div pentru conținut text și butoane
                let textContainer = document.createElement("div");
                textContainer.className = "flex-grow-1";

                let textSpan = document.createElement("p");
                textSpan.textContent = updatedText;
                textSpan.className = "mb-2";

                let buttonGroup = document.createElement("div");
                buttonGroup.className = "d-flex gap-2 flex-wrap";

                // Butoane existente
                let editButton = document.createElement("button");
                editButton.textContent = "Editează";
                editButton.className = "btn btn-sm btn-outline-dark";
                editButton.onclick = () => editText(id, text);

                let deleteButton = document.createElement("button");
                deleteButton.textContent = "Șterge";
                deleteButton.className = "btn btn-sm btn-outline-dark";
                deleteButton.onclick = () => deleteText(id);

                let sendToChatGPTButton = document.createElement("button");
                sendToChatGPTButton.textContent = "ChatGPT";
                sendToChatGPTButton.className = "btn btn-sm btn-outline-dark";
                sendToChatGPTButton.onclick = () => sendToChatGPT(id);

                let sendToDalleButton = document.createElement("button");
                sendToDalleButton.textContent = "DALL·E";
                sendToDalleButton.className = "btn btn-sm btn-outline-dark";
                sendToDalleButton.onclick = () => sendToDalle(id);

                // Adaugă butoanele în grup
                buttonGroup.appendChild(editButton);
                buttonGroup.appendChild(deleteButton);
                buttonGroup.appendChild(sendToChatGPTButton);
                buttonGroup.appendChild(sendToDalleButton);

                textContainer.appendChild(textSpan);
                textContainer.appendChild(buttonGroup);
                li.appendChild(textContainer);

                // ✅ Adaugă event listener pentru selecție
                li.onclick = () => selectText(id, li);

                textList.appendChild(li);
            });
        })
        .catch(error => console.error("Eroare la încărcarea textelor sau a datelor meteo:", error));
}

// ✅ Funcție pentru a selecta un text
function selectText(id, element) {
    document.querySelectorAll(".selectable-text").forEach(el => el.classList.remove("selected-text"));

    if (selectedTextId === id) {
        selectedTextId = null; // Deselectează
    } else {
        selectedTextId = id;
        element.classList.add("selected-text"); // Evidențiază selecția
    }
}

// ✅ Preia zilele selectate (checkbox-uri)
function getSelectedDays() {
    let selectedDays = [];
    document.querySelectorAll(".day-checkbox:checked").forEach(checkbox => {
        selectedDays.push(checkbox.value);
    });
    return selectedDays;
}

// ✅ Preia ora selectată (input type="time")
function getSelectedTime() {
    let timeInput = document.getElementById("scheduleTime");
    return timeInput ? timeInput.value : null;
}


// ✅ Funcția de salvare a programărilor
function saveSchedule() {
    if (selectedTextId && selectedImageUrl) {
        alert("Poți selecta fie un text, fie un link al imaginii, nu amândouă!");
        return;
    }

    let scheduleData = {
        days: getSelectedDays(),
        time: getSelectedTime()
    };

    if (selectedTextId) {
        scheduleData.textId = selectedTextId;
    }

    if (selectedImageUrl) {
        scheduleData.imageUrl = selectedImageUrl;
    }

    if (scheduleData.days.length === 0) {
        alert("Te rog să selectezi cel puțin o zi!");
        return;
    }

    if (!scheduleData.time) {
        alert("Te rog să selectezi o oră!");
        return;
    }

    if (!scheduleData.textId && !scheduleData.imageUrl) {
        alert("Te rog să selectezi fie un text, fie o imagine!");
        return;
    }

    fetch("/save-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData)
    })
    .then(response => response.json())
    .then(data => {
        showToast("Programare salvată cu succes!", "bg-success"); // 🟢 Notificare toast 
        loadSchedules();

        // 🔽 RESETARE FORMULAR DUPĂ SALVARE 🔽

        // 1️⃣ Deselectează textul selectat
        selectedTextId = null;
        document.querySelectorAll(".selectable-text").forEach(el => el.classList.remove("selected-text"));

        // 2️⃣ Debifează toate zilele selectate
        document.querySelectorAll(".day-checkbox:checked").forEach(checkbox => {
            checkbox.checked = false;
        });

        // 3️⃣ Resetează input-ul pentru oră
        document.getElementById("scheduleTime").value = "";

        // 4️⃣ Elimină imaginea selectată
        selectedImageUrl = ""; 
        const selectedImage = document.getElementById("selected-image");
        if (selectedImage) {
            selectedImage.remove();
        }
    })
    .catch(error => console.error("Eroare la salvare:", error));
}






// ✅ trimite direct la DALL-E - butonul din casetele cu text
function sendToDalle(id) {
    let textElement = document.querySelector(`#text-${id} p`);
    if (!textElement) return;

    let originalText = textElement.textContent;
    let loader = document.getElementById("imageLoader");
    let imageContainer = document.getElementById("generatedImageContainer");

    // Afișează loader-ul și golește containerul imaginii
    loader.classList.remove("d-none");
    imageContainer.innerHTML = "";

    // 1️⃣ Trimite textul la backend pentru traducere
    fetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: originalText })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.translatedText) {
            throw new Error("Eroare la traducere.");
        }

        // 📌 Afișează în consolă mesajul tradus
        console.log("🔹 Text tradus:", data.translatedText);

        // 2️⃣ Trimite textul tradus la DALL·E pentru generarea imaginii
        return fetch("/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: data.translatedText })
        });
    })
    .then(response => response.json())
    .then(data => {
        if (data.imageUrl) {
            let img = document.createElement("img");
            img.src = data.imageUrl;
            img.className = "img-fluid mt-3 rounded shadow";
            imageContainer.appendChild(img);
        } else {
            alert("Eroare la generarea imaginii.");
        }
    })
    .catch(error => {
        console.error("Eroare:", error);
        alert("A apărut o eroare. Verifică consola pentru detalii.");
    })
    .finally(() => {
        // 3️⃣ Ascunde loader-ul indiferent de rezultat
        loader.classList.add("d-none");
    });
}


// ✅ Editează un text existent
function editText(id, currentText) {
    let textElement = document.getElementById(`text-${id}`);

    // Creează un textarea în loc de prompt
    let textarea = document.createElement("textarea");
    textarea.className = "form-control";
    textarea.value = currentText;
    textarea.rows = 8; // Poți ajusta dimensiunea
    textElement.replaceWith(textarea);

    // Salvează modificările când textarea pierde focusul
    textarea.addEventListener("blur", () => {
        let newText = textarea.value.trim();
        if (newText && newText !== currentText) {
            fetch(`/update/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newText })
            })
            .then(response => response.json())
            .then(() => {
                loadTexts(); // Reîncarcă lista
            })
            .catch(error => console.error("Eroare la editare:", error));
        } else {
            textElement.textContent = currentText; // Revine la textul inițial
            textarea.replaceWith(textElement);
        }
    });

    textarea.focus();
}


// ✅ Șterge un text
function deleteText(id) {
    if (!confirm("Sigur vrei să ștergi acest text?")) return;

    fetch(`/delete/${id}`, { method: "DELETE" })
        .then(response => response.json())
        .then(() => {
            loadTexts(); // Reîncarcă lista după ștergere
        })
        .catch(error => console.error("Eroare la ștergerea textului:", error));
}


// ✅ DALL-E Genereaza imagine, butonul de sus
async function sendPromptToDalle() {
    let text = document.getElementById("textInput").value.trim();
    if (!text) {
        alert("Introduceți un text pentru a genera imaginea!");
        return;
    }

    const loader = document.getElementById("imageLoader");
    const imageContainer = document.getElementById("generatedImageContainer");
    loader.classList.remove("d-none"); // Afișează loaderul
    imageContainer.innerHTML = ""; // Golește containerul

    try {
        // 1️⃣ Obține datele meteo de la API-ul `/api/xml`
        const weatherResponse = await fetch("/api/xml");
        const weatherData = await weatherResponse.json();

        // Înlocuiește etichetele cu datele meteo actualizate
        let updatedText = text
            .replace(/#minTemp/g, weatherData.minTemp)
            .replace(/#maxTemp/g, weatherData.maxTemp)
            .replace(/#prognoza/g, weatherData.prognoza);

        console.log("🔹 Text inițial:", text);
        console.log("🔹 Text după înlocuirea etichetelor:", updatedText);

        // 2️⃣ Traduce textul în engleză folosind API-ul `/translate`
        const translateResponse = await fetch("/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: updatedText, targetLang: "en" })
        });

        const translateData = await translateResponse.json();
        if (!translateResponse.ok || !translateData.translatedText) {
            throw new Error("Eroare la traducere.");
        }

        console.log("🔹 Text tradus:", translateData.translatedText);

        // 3️⃣ Trimite textul tradus către DALL-E
        const dalleResponse = await fetch("/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: translateData.translatedText })
        });

        const dalleData = await dalleResponse.json();
        if (!dalleResponse.ok || !dalleData.imageUrl) {
            throw new Error("A apărut o eroare la generarea imaginii.");
        }

        loader.classList.add("d-none"); // Ascunde loaderul
        await loadImageWithRetry(dalleData.imageUrl, imageContainer, 10, 1000); // 10 încercări, pauză de 1s
    } catch (error) {
        console.error("Eroare:", error);
        loader.classList.add("d-none");
        alert("A apărut o eroare. Încearcă din nou.");
    }
}


// ✅ Trimite textul răspunsului de la ChatGPT către DALL-E
function generateImage() {
    let textDescription = document.getElementById("chatGPTResponse").textContent.trim();
    
    if (!textDescription || textDescription === "Răspunsul va apărea aici...") {
        alert("Nu există un răspuns de la ChatGPT pentru a genera imaginea.");
        return;
    }

    let loader = document.getElementById("imageLoader");
    let imageContainer = document.getElementById("generatedImageContainer");

    // Afișează loader-ul și golește containerul imaginii
    loader.classList.remove("d-none");
    imageContainer.innerHTML = "";
  
          // 1️⃣ Trimite textul la backend pentru traducere
    fetch("/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textDescription })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.translatedText) {
            throw new Error("Eroare la traducere.");
        }

        // 📌 Afișează în consolă mesajul tradus
        console.log("🔹 Text tradus:", data.translatedText);

        // 2️⃣ Trimite textul tradus la DALL·E pentru generarea imaginii
        return fetch("/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: data.translatedText }) 
        });
    })
    .then(response => response.json())
    .then(data => {
        if (data.imageUrl) {
            let imageElement = document.createElement("img");
            imageElement.src = data.imageUrl;
            imageElement.alt = "Imagine generată de DALL-E";
            imageElement.className = "img-fluid mt-3 rounded shadow";

            imageContainer.appendChild(imageElement);
        } else {
            alert("Eroare la generarea imaginii.");
        }
    })
    .catch(error => {
        console.error("Eroare:", error);
        alert("A apărut o eroare. Verifică consola pentru detalii.");
    })
    .finally(() => {
        // 3️⃣ Ascunde loader-ul indiferent de rezultat
        loader.classList.add("d-none");
    });
}


// ✅ Funcție de reîncercare a încărcării imaginii
async function loadImageWithRetry(imageUrl, container, retries, delay) {
    for (let i = 1; i <= retries; i++) {
        try {
            const img = new Image();
            img.src = imageUrl;
            img.alt = "Imagine generată";
            img.className = "img-fluid mt-3 rounded shadow";

            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject();
            });

            container.appendChild(img);
            return;
        } catch (error) {
            console.warn(`Încercare ${i} eșuată. Se reîncearcă...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    alert("Imaginea nu a putut fi încărcată. Reîmprospătați pagina.");
}

// ✅ Încarcă ultimul răspuns salvat din baza de date
function loadLastResponse() {
    fetch("/last-response")
        .then(response => response.json())
        .then(data => {
            document.getElementById("chatGPTResponse").textContent = data.response;
        })
        .catch(error => console.error("Eroare la încărcarea ultimului răspuns:", error));
}

// ✅ Încarcă răspunsul când pagina este încărcată
document.addEventListener("DOMContentLoaded", loadLastResponse);

// ✅ Trimite textul la ChatGPT și actualizează răspunsul în pagină + salvează în baza de date
function sendToChatGPT(id) {
    let textElement = document.getElementById(`text-${id}`).querySelector("p");
    let text = textElement.textContent;

    if (!text.trim()) {
        alert("Nu există text de trimis la ChatGPT.");
        return;
    }

    fetch("/chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    })
    .then(response => response.json())
    .then(data => {
        if (data.reply) {
            // Actualizează răspunsul în zona HTML dorită
            document.getElementById("chatGPTResponse").textContent = data.reply;
        } else {
            alert("Eroare la interogarea ChatGPT.");
        }
    })
    .catch(error => console.error("Eroare la trimiterea către ChatGPT:", error));
}


// ✅ Trimite textul din fereastra de sus la ChatGPT și salvează răspunsul
function sendTextToChatGPT() {
    let textInput = document.getElementById("textInput"); // ID-ul inputului unde utilizatorul introduce textul
    let text = textInput.value.trim();

    if (!text) {
        alert("Introdu un text înainte de a trimite la ChatGPT.");
        return;
    }

    fetch("/chatgpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    })
    .then(response => response.json())
    .then(data => {
        if (data.reply) {
            document.getElementById("chatGPTResponse").textContent = data.reply; // Afișează răspunsul în HTML

// ✅ Salvează răspunsul în baza de date
            fetch("/save-response", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ response: data.reply })
            })
            .catch(error => console.error("Eroare la salvarea răspunsului:", error));
        } else {
            alert("Eroare la interogarea ChatGPT.");
        }
    })
    .catch(error => console.error("Eroare la trimiterea către ChatGPT:", error));
}

// ✅ Funcție a butonului de salvare a textului primit de la ChatGPT cu notificări toast
function saveResponse() {
    let textContent = document.getElementById("chatGPTResponse").textContent.trim();

    if (!textContent || textContent === "Răspunsul va apărea aici...") {
        showToast("Nu există un răspuns de salvat.", "bg-warning");
        return;
    }

    fetch("/save-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textContent })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            showToast("Text salvat cu succes!", "bg-success");
            loadTexts(); // 🔹 Încarcă automat textele după salvare
        } else {
            showToast("Eroare la salvarea textului.", "bg-danger");
        }
    })
    .catch(error => {
        console.error("Eroare la trimiterea textului:", error);
        showToast("Eroare la trimiterea textului.", "bg-danger");
    });
}



// ✅ Functie a butonului de stergere a textului primit de la Chat GPT

function deleteResponse() {
    if (!confirm("Sigur vrei să ștergi acest răspuns?")) return;

    fetch("/delete-response", { method: "DELETE" })
    .then(response => response.json())
    .then(data => {
        document.getElementById("chatGPTResponse").textContent = "Răspunsul va apărea aici...";
        showToast("Răspuns șters cu succes!", "bg-success");
    })
    .catch(error => console.error("Eroare la ștergerea răspunsului:", error));
}



// ✅ Functie pentru butonul de upload fotografie
document.getElementById("imageUpload").addEventListener("change", function () {
        if (!this.files.length) return;

        const formData = new FormData();
        formData.append("image", this.files[0]);

        fetch("/upload-image", {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById("generatedImage").src = "/generated-image.png?t=" + new Date().getTime();
            }
        })
        .catch(error => console.error("Eroare:", error));
    });

// ✅ Functie pentru butonul de trimitere imagine in dashboard
document.getElementById("sendToDashboard").addEventListener("click", () => {
    fetch("/send-to-dashboard", {
        method: "POST",
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast("Imaginea a fost trimisă cu succes!", "bg-success");
        } else {
            showToast("Eroare: " + data.message, "bg-danger");
        }
    })
    .catch(error => {
        console.error("Eroare:", error);
        showToast("Eroare la trimiterea imaginii!", "bg-danger");
    });
});

// ✅ Functie meniu
function toggleDropdown(event) {
    event.stopPropagation(); // Previne închiderea instantă a meniului
    document.getElementById("dropdownMenu").classList.toggle("show");
}


  window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
      var dropdowns = document.getElementsByClassName("dropdown-content");
      for (var i = 0; i < dropdowns.length; i++) {
        var openDropdown = dropdowns[i];
        if (openDropdown.classList.contains('show')) {
          openDropdown.classList.remove('show');
          }
      }
    }
  }


// ✅ Butonul Toggle
document.addEventListener("DOMContentLoaded", () => {
    fetch("/get-dalle-mode")
        .then(response => response.json())
        .then(data => {
            const toggle = document.getElementById("toggleModel");

            // Setăm starea butonului conform bazei de date
            if (data.dallemode === "dall-e-2") {
                toggle.checked = true;
                // Notificare eliminată: alert("Model selectat: DALL·E 2");
            } else {
                toggle.checked = false;
                // Notificare eliminată: alert("Model selectat: DALL·E 3");
            }
        })
        .catch(error => console.error("Eroare la citirea modelului:", error));
});


function updateDalleMode() {
    const toggle = document.getElementById("toggleModel");
    const newMode = toggle.checked ? "dall-e-2" : "dall-e-3";

    fetch("/set-dalle-mode", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ dallemode: newMode })
    })
    .then(() => {
        showToast("Model actualizat la: " + newMode.toUpperCase(), 'bg-success');
    })
    .catch(error => {
        console.error("Eroare la actualizarea modelului:", error);
        showToast("Eroare la actualizarea modelului!", 'bg-danger');
    });
}



// ✅ Butonul Salveaza (in galerie)
document.getElementById("saveImageBtn").addEventListener("click", () => {
    fetch("/save-image", { method: "POST" })
        .then(response => response.json())
        .then(data => {
            showToast("Feedback: " + data.message, "bg-success");
        })
        .catch(error => {
            console.error("Eroare la salvare:", error);
            showToast("Eroare la salvare!", "bg-danger");
        });
});

document.getElementById("upload-btn").addEventListener("click", async function() {
    document.getElementById("gallery-overlay").classList.remove("hidden");
    await loadGallery();
});

document.getElementById("close-overlay").addEventListener("click", function() {
    document.getElementById("gallery-overlay").classList.add("hidden");
});



// ✅ Butonul deschidere galerie Cloudinary
document.getElementById("upload-btn").addEventListener("click", async function() {
    document.getElementById("gallery-overlay").classList.remove("hidden");
    await loadGallery();
});

document.getElementById("close-overlay").addEventListener("click", function() {
    document.getElementById("gallery-overlay").classList.add("hidden");
});

async function loadGallery() {
    try {
        const response = await fetch("/gallery");
        if (!response.ok) {
            throw new Error("Failed to load gallery images.");
        }
        const images = await response.json();
        const gallery = document.getElementById("gallery");
        gallery.innerHTML = "";

        images.forEach((image) => {
            const imgContainer = document.createElement("div");
            imgContainer.classList.add("image-container");

            const img = document.createElement("img");
            img.src = image.url;
            img.classList.add("gallery-image");
            img.addEventListener("click", function() {
                selectImage(image.url);
            });

            imgContainer.appendChild(img);
            gallery.appendChild(imgContainer);
        });
    } catch (error) {
        console.error("Error loading gallery:", error);
    }
}

function selectImage(url) {
    console.log("Selected image URL:", url);
    selectedImageUrl = url;  // Salvează URL-ul imaginii în variabila locală
    document.getElementById("gallery-overlay").classList.add("hidden");

    // Verifică dacă elementul există deja, altfel creează-l
    let selectedImage = document.getElementById("selected-image");

    if (!selectedImage) {
        selectedImage = document.createElement("img");
        selectedImage.id = "selected-image";
        selectedImage.alt = "Selected Image";
        selectedImage.classList.add("selected-image-style"); // Stilizare CSS
        document.getElementById("image-container").appendChild(selectedImage);
    }

    selectedImage.src = url;
    selectedImage.classList.remove("hidden");
}

let selectedImageUrl = "";  // Variabilă pentru stocarea URL-ului imaginii



// ✅ Funcția pentru citirea și listarea programărilor
async function loadSchedules() {
    try {
        const response = await fetch('/api/programator'); // Cererea către backend
        const schedules = await response.json();
        
        const schedulesList = document.getElementById('schedules-list');
        schedulesList.innerHTML = ''; // Curățăm lista existentă

        if (schedules.length === 0) {
        const noSchedulesMessage = document.createElement('div');
            noSchedulesMessage.textContent = "Nu aveți programări";
            noSchedulesMessage.classList.add('schedule-item', 'no-schedules'); // Adaugăm stilurile existente
            schedulesList.appendChild(noSchedulesMessage);
        return;
        }


        const dayAbbreviations = {
            "Luni": "Lu", "Marți": "Ma", "Miercuri": "Mi",
            "Joi": "Jo", "Vineri": "Vi", "Sâmbătă": "Sâ", "Duminică": "Du"
        };

        schedules.forEach((schedule, index) => {
            const scheduleItem = document.createElement('div');
            scheduleItem.classList.add('schedule-item');

            // Afișăm tipul de programare: text sau imagine
            const typeIcon = document.createElement('i');  
            if (schedule.imageUrl) {
                typeIcon.className = 'fa fa-image'; 
            } else if (schedule.textId) {
                typeIcon.className = 'fa fa-file-alt';
            }

            // Transformăm zilele în formatul corect
            let day;
            if (schedule.days.length === 7) {
                day = "Săptămână";
            } else if (schedule.days.length === 1) {
                day = schedule.days[0]; // Numele complet al zilei
            } else {
                day = schedule.days.map(d => dayAbbreviations[d] || d).join(", "); // Prescurtări
            }
            
            const time = schedule.time;

            // Statusul de executare
            const executedIcon = document.createElement('i');  
            executedIcon.className = schedule.executed ? 'fa fa-check-circle' : 'fa fa-times-circle';

            // Buton de ștergere
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Șterge';
            deleteButton.addEventListener('click', function() {
                deleteSchedule(index);
            });

            // Formatarea indexului
            const formattedIndex = `P ${String(index + 1).padStart(2, '0')}`;

            // Afișăm informațiile
            scheduleItem.innerHTML = `
                <span>${formattedIndex}</span> 
                <i class="${typeIcon.className}" aria-hidden="true"></i>
                <span>${day} - ${time}</span> 
                <i class="${executedIcon.className}" aria-hidden="true"></i>
            `;
            scheduleItem.appendChild(deleteButton);
            schedulesList.appendChild(scheduleItem);
        });
    } catch (error) {
        console.error('Eroare la încărcarea programărilor:', error);
    }
}





// ✅ Funcția de ștergere a programării cu notificare toast
async function deleteSchedule(index) {
    try {
        const response = await fetch(`/api/programator/${index}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            showToast('Programarea a fost ștearsă!', "bg-success"); // 🟢 Notificare de succes
            loadSchedules(); // Reîncarcă lista
        } else {
            showToast('Eroare la ștergerea programării!', "bg-success"); // 🔴 Notificare de eroare
        }
    } catch (error) {
        console.error('Eroare la ștergerea programării:', error);
        showToast('Eroare la ștergere! Verifică consola.', "bg-success");
    }
}


        // Apelează funcția pentru a încărca programările la încărcarea paginii
        window.onload = loadSchedules;





// ✅ Notificari Toast
function showToast(message, bgClass = 'bg-success') {
  const toastContainer = document.getElementById('toastContainer');
  
  // Creăm elementul toast
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-white ${bgClass} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  // Conținutul toast-ului
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  // Adăugăm toast-ul în container
  toastContainer.appendChild(toastEl);
  
  // Inițializăm și afișăm toast-ul (delay: 3000ms)
  const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
  toast.show();
  
  // După ce toast-ul dispare, îl eliminăm din DOM
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

