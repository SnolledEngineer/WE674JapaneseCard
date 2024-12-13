const webcamElement = document.getElementById('webcam');
const overlayElement = document.getElementById('overlay');
const resultElement = document.getElementById('result');
const hintElement = document.getElementById('hint');
const restartButton = document.getElementById('restartButton');

let model;
let currentHint = "";

let labels = ["Empty", "A", "I", "U", "E", "O", "KA", "KI", "KU", "KE", "KO"]; // ข้อมูลเดิม
let readings = {
    "Empty": "empty",
    "A": "a",
    "I": "i",
    "U": "u",
    "E": "e",
    "O": "o",
    "KA": "ka",
    "KI": "ki",
    "KU": "ku",
    "KE": "ke",
    "KO": "ko"
}; // ข้อมูลเดิม
labels = labels.filter(label => label !== "Class1" && label !== "Empty");



(async () => {
    // โหลดข้อมูลจาก CSV และรวมเข้ากับข้อมูลปัจจุบัน
    await loadCSV('train_data.csv'); // โหลดข้อมูลเสริมจากไฟล์ CSV
    await setupCamera();
    await loadModel();

    // เริ่มแสดงคำอ่านและตรวจจับ
    showHint();
    startDetection();
})();


// ฟังก์ชันตั้งค่ากล้อง
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: { ideal: 1280 }, // ปรับความกว้างเป็น 1280px
            height: { ideal: 720 }, // ปรับความสูงเป็น 720px
        }
    });
    webcamElement.srcObject = stream;

    return new Promise((resolve) => {
        webcamElement.onloadedmetadata = () => resolve();
    });
}

// โหลดโมเดล
async function loadModel() {
    model = await tf.loadLayersModel('./model.json');
    console.log('Model loaded successfully!');
}

// ฟังก์ชันแสดงคำอ่านสุ่ม
function showHint() {
    // กรองตัวอักษรที่ไม่ต้องการจาก labels เช่น "Class 1" หรือ "Empty"
    const filteredLabels = labels.filter(label => label !== "Class 1" && label !== "Empty");

    // สุ่มตัวเลือกจากรายการที่กรองแล้ว
    const randomIndex = Math.floor(Math.random() * filteredLabels.length);
    currentHint = filteredLabels[randomIndex];
    hintElement.innerHTML = `Hint: Show the card for "${readings[currentHint]}"`;
}

    

// ฟังก์ชันเริ่มตรวจจับหลังจากนับถอยหลัง
async function startDetection() {
    let countdown = 5;

    const countdownInterval = setInterval(() => {
        resultElement.innerHTML = `Starting detection in ${countdown}...`;
        countdown--;

        if (countdown < 0) {
            clearInterval(countdownInterval);
            detect();
        }
    }, 1000);
}

// ฟังก์ชันเริ่มใหม่
function restart() {
    resultElement.innerHTML = "";
    hintElement.innerHTML = "";
    showHint();
    startDetection();
}

// ตั้งค่าปุ่ม Restart
restartButton.addEventListener('click', () => {
    // เพิ่มเอฟเฟกต์การหมุนเมื่อคลิกปุ่ม
    restartButton.classList.add('clicked');
    setTimeout(() => {
        restartButton.classList.remove('clicked');
        restart(); // เรียกฟังก์ชันรีเซ็ต
    }, 500); // หน่วงเวลา 500ms ให้การหมุนสมบูรณ์ก่อนรีเซ็ต
});

// เริ่มต้นระบบ
(async () => {
    await setupCamera();
    await loadModel();

    // เริ่มแสดงคำอ่านและตรวจจับ
    showHint();
    startDetection();
})();

// ฟังก์ชันเคลียร์ Overlay
function clearOverlay() {
    const ctx = overlayElement.getContext('2d');
    ctx.clearRect(0, 0, overlayElement.width, overlayElement.height);
}

// ฟังก์ชันตรวจจับ
async function detect() {
    const videoWidth = webcamElement.videoWidth;
    const videoHeight = webcamElement.videoHeight;

    overlayElement.width = videoWidth;
    overlayElement.height = videoHeight;

    const ctx = overlayElement.getContext('2d');
    ctx.drawImage(webcamElement, 0, 0, videoWidth, videoHeight);

    const inputTensor = tf.browser.fromPixels(overlayElement)
        .resizeNearestNeighbor([224, 224])
        .toFloat()
        .div(tf.scalar(255))
        .expandDims();

    const prediction = await model.predict(inputTensor).data();
    console.log("Raw predictions:", prediction);

    const maxIndex = prediction.indexOf(Math.max(...prediction));
    const detectedLabel = labels[maxIndex];
    const confidence = prediction[maxIndex] * 100;

    console.log(`Detected label: ${detectedLabel}, Confidence: ${confidence.toFixed(2)}%, Max Index: ${maxIndex}`);

    if (confidence > 80 && detectedLabel !== "Class 1" && detectedLabel !== "Empty") {
        if (detectedLabel === currentHint) {
            resultElement.innerHTML = `Correct! You showed "${detectedLabel}" (${confidence.toFixed(2)}%)`;
            resultElement.className = "correct"; // เปลี่ยนสีเป็นเขียว
        } else {
            resultElement.innerHTML = `You showed "${detectedLabel}" (${confidence.toFixed(2)}%). Try again!`;
            resultElement.className = "incorrect"; // เปลี่ยนสีเป็นแดง
        }
    } else {
        resultElement.innerHTML = `No confident detection (${confidence.toFixed(2)}%). Try again!`;
        resultElement.className = ""; // ไม่มีสี
    }
    clearOverlay();
}

// ฟังก์ชันโหลดข้อมูลจาก CSV และเพิ่มในข้อมูลที่มีอยู่
function loadCSV(filePath) {
    return new Promise((resolve, reject) => {
        Papa.parse(filePath, {
            download: true,
            header: true,
            complete: function (results) {
                const data = results.data;

                // เพิ่มข้อมูลใหม่ลงใน labels และ readings
                data.forEach(row => {
                    if (row.character && row.reading) {
                        // ตรวจสอบไม่ให้ซ้ำ
                        if (!labels.includes(row.character)) {
                            labels.push(row.character);
                            readings[row.character] = row.reading;
                        }
                    }
                });
                resolve();
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}

function mapPredictionToLabel(predictions) {
    // ตัวอย่างการแก้ไขลำดับหากพบว่าผลลัพธ์ผิดตำแหน่ง
    const reorderedLabels = ["Empty", "A", "I", "U", "E", "O", "KA", "KI", "KU", "KE", "KO"];
    const maxIndex = predictions.indexOf(Math.max(...predictions));
    return reorderedLabels[maxIndex];
}

