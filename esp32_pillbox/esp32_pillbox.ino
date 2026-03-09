#include <WiFi.h>
#include <FirebaseESP32.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define FIREBASE_HOST "YOUR_FIREBASE_PROJECT_ID.firebaseio.com"
#define FIREBASE_AUTH "YOUR_FIREBASE_DATABASE_SECRET"

#define IR_SENSOR_PIN 33
#define BUZZER_PIN 25
#define LED_PIN 26

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

// Time server
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 0;
const int   daylightOffset_sec = 3600;

String userID = "elderly_01";

// Medicine Schedule (Hours in 24h format)
const int morningDoseHour = 8;
const int noonDoseHour = 13;
const int nightDoseHour = 20;

bool doseTaken = false;
bool alarmActive = false;
unsigned long alarmStartTime = 0;
int currentDoseHour = -1;

void setup() {
  Serial.begin(115200);
  
  pinMode(IR_SENSOR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("Connecting WiFi...");
  display.display();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  display.clearDisplay();
  display.setCursor(0,0);
  display.println("WiFi Connected!");
  display.display();

  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    Serial.println("Failed to obtain time");
    delay(1000);
    return;
  }
  
  int currentHour = timeinfo.tm_hour;
  int currentMin = timeinfo.tm_min;
  
  // Check if it's time for a dose and alarm isn't already active/handled for this hour
  if ((currentHour == morningDoseHour || currentHour == noonDoseHour || currentHour == nightDoseHour) && currentMin == 0 && !alarmActive && currentHour != currentDoseHour) {
    alarmActive = true;
    doseTaken = false;
    currentDoseHour = currentHour;
    alarmStartTime = millis();
    
    // Trigger Alarm
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 1000);
    
    display.clearDisplay();
    display.setCursor(0,0);
    display.setTextSize(2);
    display.println("TAKE PILL!");
    display.display();
  }
  
  if (alarmActive) {
    // Check IR sensor. LOW typically means object detected, HIGH means removed (depending on sensor).
    int irState = digitalRead(IR_SENSOR_PIN);
    
    if (irState == HIGH && !doseTaken) { // Assuming HIGH means pill box opened or pill removed
      doseTaken = true;
      alarmActive = false;
      digitalWrite(LED_PIN, LOW);
      noTone(BUZZER_PIN);
      
      display.clearDisplay();
      display.setCursor(0,0);
      display.setTextSize(1);
      display.println("Pill Taken.");
      display.display();
      
      // Log to Firebase
      String path = "/users/" + userID + "/medicationLogs";
      String timestamp = String(timeinfo.tm_year + 1900) + "-" + String(timeinfo.tm_mon + 1) + "-" + String(timeinfo.tm_mday) + " " + String(timeinfo.tm_hour) + ":" + String(timeinfo.tm_min);
      
      FirebaseJson json;
      json.set("timestamp", timestamp);
      json.set("status", "Taken");
      Firebase.pushJSON(firebaseData, path, json);
    }
    
    // Check for missed dose (10 minutes = 600000 ms)
    if (millis() - alarmStartTime > 600000 && !doseTaken) {
      alarmActive = false;
      digitalWrite(LED_PIN, LOW);
      noTone(BUZZER_PIN);
      
      display.clearDisplay();
      display.setCursor(0,0);
      display.setTextSize(1);
      display.println("Missed Dose!");
      display.display();
      
      // Log missed dose to Database
      String pathLogs = "/users/" + userID + "/medicationLogs";
      String pathAlerts = "/users/" + userID + "/alerts";
      String timestamp = String(timeinfo.tm_year + 1900) + "-" + String(timeinfo.tm_mon + 1) + "-" + String(timeinfo.tm_mday) + " " + String(timeinfo.tm_hour) + ":" + String(timeinfo.tm_min);
      
      FirebaseJson jsonLog;
      jsonLog.set("timestamp", timestamp);
      jsonLog.set("status", "Missed");
      Firebase.pushJSON(firebaseData, pathLogs, jsonLog);
      
      FirebaseJson jsonAlert;
      jsonAlert.set("timestamp", timestamp);
      jsonAlert.set("message", "Missed medication dose.");
      jsonAlert.set("type", "Medication");
      Firebase.pushJSON(firebaseData, pathAlerts, jsonAlert);
    }
  }

  // Reset currentDoseHour when the hour passes so it can trigger tomorrow
  if (currentHour != morningDoseHour && currentHour != noonDoseHour && currentHour != nightDoseHour) {
    currentDoseHour = -1;
  }
  
  delay(1000);
}
