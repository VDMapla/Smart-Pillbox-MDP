import speech_recognition as sr
import pyttsx3
import firebase_admin
from firebase_admin import credentials, db
import sys
import time

# Initialize Firebase Connection
try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred, {
        'databaseURL': 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com/'
    })
    print("Firebase connected successfully!")
except Exception as e:
    print("\n--------------------------------------------------------------")
    print("WARNING: Firebase initialization failed.")
    print("Please make sure 'serviceAccountKey.json' is in this directory.")
    print("And ensure 'databaseURL' is correct in the script.")
    print("--------------------------------------------------------------\n")

# Initialize Text-to-Speech Engine
try:
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    # Set to a clear, slower voice suitable for elderly
    engine.setProperty('rate', 140)
    engine.setProperty('volume', 1.0)
    # Attempt to set female voice if available
    for voice in voices:
        if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
            engine.setProperty('voice', voice.id)
            break
except Exception as e:
    print(f"Failed to initialize TTS engine: {e}")
    sys.exit(1)

def speak(text):
    print(f"\nAssistant: {text}")
    engine.say(text)
    engine.runAndWait()

def listen():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("\n[Listening... Please speak now]")
        # Adjust for ambient noise for better accuracy
        recognizer.adjust_for_ambient_noise(source, duration=1.0)
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=10)
        except sr.WaitTimeoutError:
            return ""
            
    try:
        command = recognizer.recognize_google(audio).lower()
        print(f"User: {command}")
        return command
    except sr.UnknownValueError:
        return ""
    except sr.RequestError:
        speak("Sorry, my speech service is currently down. Please check your internet connection.")
        return ""

def handle_command(command):
    if not command:
        return True

    # Check termination commands
    if any(word in command for word in ["exit", "stop", "goodbye", "quit", "bye"]):
        speak("Goodbye! Have a healthy and wonderful day.")
        return False
        
    try:
        user_ref = db.reference('users/elderly_01')
    except Exception:
        speak("I am currently disconnected from the database. Please check my configuration.")
        return True

    if "next dose" in command or "medicine time" in command or "next pill" in command:
        speak("Your medicine doses are scheduled for 8 AM, 1 PM, and 8 PM daily.")
        
    elif "take my medicine" in command or "taken my medicine" in command or "take my pill" in command or "did i take" in command:
        try:
            logs_ref = user_ref.child('medicationLogs').get()
            if logs_ref:
                latest_key = sorted(logs_ref.keys())[-1]
                last_log = logs_ref[latest_key]
                status = last_log.get("status", "Unknown")
                timestamp = last_log.get("timestamp", "an unknown time")
                
                if status == "Taken":
                    speak(f"Yes, your records show you took your medicine at {timestamp}.")
                elif status == "Missed":
                    speak(f"Your last record shows a missed dose at {timestamp}. Please remember to take your medication.")
                else:
                    speak("I am not sure about your last dose status.")
            else:
                speak("I cannot find any medication records in your history.")
        except Exception:
            speak("I had trouble accessing your medication records.")

    elif "heart rate" in command or "pulse" in command or "my heart" in command:
        try:
            hr_ref = user_ref.child('heartRate').get()
            if hr_ref:
                latest_key = sorted(hr_ref.keys())[-1]
                last_hr = hr_ref[latest_key]
                val = last_hr.get("value", 0)
                speak(f"Your latest recorded heart rate is {val} beats per minute.")
            else:
                speak("I don't have recent heart rate data for you.")
        except Exception:
            speak("I had trouble accessing your heart rate records.")
            
    elif "temperature" in command or "body heat" in command or "how hot" in command:
        try:
            temp_ref = user_ref.child('temperature').get()
            if temp_ref:
                latest_key = sorted(temp_ref.keys())[-1]
                last_t = temp_ref[latest_key]
                val = last_t.get("value", 0)
                speak(f"Your latest recorded body temperature is {val} degrees Celsius.")
            else:
                speak("I don't have recent temperature data available.")
        except Exception:
            speak("I had trouble accessing your temperature records.")
            
    else:
        speak("I am your Smart Pillbox assistant. You can ask me about your next medicine dose, your heart rate, or your temperature.")
        
    return True

if __name__ == "__main__":
    time.sleep(1) # Brief pause before greeting
    speak("Hello! I am your health assistant. What can I help you with today?")
    
    keep_running = True
    while keep_running:
        cmd = listen()
        if cmd:
            keep_running = handle_command(cmd)
