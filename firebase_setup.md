# Smart Pillbox & Wearable Band Project Setup

This document provides a complete guide for setting up the hardware and cloud connection for the Smart Pillbox and Wearable Band System.

## 1. Firebase Database Structure

We are using Firebase Realtime Database. Below is the JSON structure (schema) for an example user:

```json
{
  "users": {
    "elderly_01": {
      "medicationLogs": {
        "log1_id": {
          "status": "Taken",
          "timestamp": "2024-10-15 08:05"
        },
        "log2_id": {
          "status": "Missed",
          "timestamp": "2024-10-15 13:10"
        }
      },
      "heartRate": {
        "hr1_id": {
          "timestamp": "2024-10-15 08:15:30",
          "value": 72.5
        }
      },
      "temperature": {
        "temp1_id": {
          "timestamp": "2024-10-15 08:15:30",
          "value": 36.6
        }
      },
      "alerts": {
        "alert1_id": {
          "message": "Missed medication dose.",
          "timestamp": "2024-10-15 13:10",
          "type": "Medication"
        },
        "alert2_id": {
          "message": "High Heart Rate!",
          "timestamp": "2024-10-15 14:00:30",
          "type": "Vitals_Abnormal"
        }
      }
    }
  }
}
```

### Firebase Setup Instructions:
1. Go to Firebase Console and create a new project.
2. Navigate to "Realtime Database" and click "Create Database".
3. Start in **Test Mode** or configure Rules to allow read/write access.
4. Copy your Realtime Database URL (e.g., `https://your-project.firebaseio.com/`).
5. Go to Project Settings -> Service Accounts -> Database Secrets and generate a secret token.
6. Paste the URL and Token into the config constants (`FIREBASE_HOST` and `FIREBASE_AUTH`) in both the Arduino files and the Python Assistant script.

---

## 2. Hardware Pin Connections

### Module 1: Smart Pillbox (ESP32)

| Component | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| IR Sensor OUT | GPIO 33 | Detects if pill is removed |
| LED Anode (+) | GPIO 26 | Visual alert (via 220ohm resistor) |
| Buzzer (+) | GPIO 25 | Audible alert |
| OLED SDA | GPIO 21 | I2C Data Line |
| OLED SCL | GPIO 22 | I2C Clock Line |
| VCC/GND | 3.3V / GND | Power all sensors from ESP32 |

*(Ensure OLED is powered by 3.3V to match logic levels)*

### Module 2: Wearable Band (ESP32)

| Component | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| MAX30100 SDA | GPIO 21 | I2C Data |
| MAX30100 SCL | GPIO 22 | I2C Clock |
| DS18B20 Data | GPIO 4 | OneWire Temp Sensor (use 4.7k pull-up resistor to 3.3V) |
| VCC/GND | 3.3V / GND | Power sensors |

---

## 3. How to Run Each Component

### A. Uploading Firmware (Arduino IDE)
1. Install the Arduino IDE.
2. Add ESP32 board support via Boards Manager.
3. Install required libraries using the Library Manager: 
    * `Firebase ESP32 Client`
    * `Adafruit SSD1306`
    * `Adafruit GFX Library`
    * `MAX30100lib`
    * `DallasTemperature`, `OneWire`
4. Update your WiFi credentials and Firebase secrets in the code.
5. Connect your ESP32 boards via USB and click Upload.

### B. Running React Dashboard
1. Ensure Node.js is installed.
2. Open terminal in the `react_dashboard` folder.
3. Run `npm install` to install dependencies.
4. Update your `firebaseConfig` details inside `src/firebase.js`.
5. Run `npm run dev` to start the dashboard locally.

### C. Running Python Voice Assistant
1. Ensure Python 3.8+ is installed.
2. Install pip dependencies: `pip install SpeechRecognition pyttsx3 firebase-admin pyaudio`
3. Download your Firebase Admin SDK service account JSON file from Firebase Console.
4. Place it in the `voice_assistant` folder and rename it to `serviceAccountKey.json`.
5. Run the python script: `python assistant.py`.
