#include <WiFi.h>
#include <FirebaseESP32.h>
#include <Wire.h>
#include "MAX30100_PulseOximeter.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST "YOUR_FIREBASE_PROJECT_ID.firebaseio.com"
#define FIREBASE_AUTH "YOUR_FIREBASE_DATABASE_SECRET"

// DS18B20 connected to GPIO 4
#define ONE_WIRE_BUS 4

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);

PulseOximeter pox;
uint32_t tsLastReport = 0;
#define REPORTING_PERIOD_MS 30000 // Send data every 30 seconds

FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

String userID = "elderly_01";

// Time server for timestamps
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 3600;

void onBeatDetected() {
    Serial.println("Beat!");
}

void setup() {
    Serial.begin(115200);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected.");
    
    configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

    config.host = FIREBASE_HOST;
    config.signer.tokens.legacy_token = FIREBASE_AUTH;
    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    tempSensor.begin();

    Serial.print("Initializing pulse oximeter..");
    if (!pox.begin()) {
        Serial.println("FAILED");
        for(;;);
    } else {
        Serial.println("SUCCESS");
    }
    pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
    pox.setOnBeatDetectedCallback(onBeatDetected);
}

void loop() {
    pox.update();

    if (millis() - tsLastReport > REPORTING_PERIOD_MS) {
        float hearRate = pox.getHeartRate();
        float spo2 = pox.getSpO2();
        
        tempSensor.requestTemperatures();
        float tempC = tempSensor.getTempCByIndex(0);

        Serial.print("Heart rate:");
        Serial.print(hearRate);
        Serial.print("bpm / SpO2:");
        Serial.print(spo2);
        Serial.print("% / Temp:");
        Serial.print(tempC);
        Serial.println("C");

        // Get Timestamp
        struct tm timeinfo;
        String timestamp = "Unknown";
        if(getLocalTime(&timeinfo)){
            timestamp = String(timeinfo.tm_year + 1900) + "-" + String(timeinfo.tm_mon + 1) + "-" + String(timeinfo.tm_mday) + " " + String(timeinfo.tm_hour) + ":" + String(timeinfo.tm_min) + ":" + String(timeinfo.tm_sec);
        }

        // Upload to Firebase
        String pathHR = "/users/" + userID + "/heartRate";
        String pathTemp = "/users/" + userID + "/temperature";
        
        FirebaseJson jsonHR;
        jsonHR.set("timestamp", timestamp);
        jsonHR.set("value", hearRate);
        Firebase.pushJSON(firebaseData, pathHR, jsonHR);

        FirebaseJson jsonTemp;
        jsonTemp.set("timestamp", timestamp);
        jsonTemp.set("value", tempC);
        Firebase.pushJSON(firebaseData, pathTemp, jsonTemp);

        // Check for abnormal alerts
        if ((hearRate > 0 && hearRate < 50) || hearRate > 120 || tempC > 38.0) {
            String pathAlerts = "/users/" + userID + "/alerts";
            FirebaseJson jsonAlert;
            jsonAlert.set("timestamp", timestamp);
            
            String msg = "";
            if (hearRate > 0 && hearRate < 50) msg += "Low Heart Rate! ";
            if (hearRate > 120) msg += "High Heart Rate! ";
            if (tempC > 38.0) msg += "High Temperature! ";
            
            jsonAlert.set("message", msg);
            jsonAlert.set("type", "Vitals_Abnormal");
            Firebase.pushJSON(firebaseData, pathAlerts, jsonAlert);
            
            Serial.println("ALERT TRIGGERED: " + msg);
        }

        tsLastReport = millis();
    }
}
