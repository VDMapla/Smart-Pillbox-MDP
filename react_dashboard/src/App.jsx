import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set } from "firebase/database";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ==========================================
// 🧪 DEMO MODE TOGGLE
// ==========================================
// I have set this to true so you can see the UI IMMEDIATELY without hardware or Firebase!
// Change this to 'false' later when you literally plug in the ESP32.
const DEMO_MODE = true; 

const generateMockData = () => {
  const now = Date.now();
  const hr = {};
  const temp = {};
  for(let i=15; i>=0; i--) {
     const t = new Date(now - i * 30000).toISOString();
     hr[`hr_${i}`] = { value: Math.floor(Math.random() * (85 - 65 + 1) + 65), timestamp: t };
     temp[`temp_${i}`] = { value: (Math.random() * (37.2 - 36.1) + 36.1).toFixed(1), timestamp: t };
  }
  return {
    medicationLogs: {
      log1: { status: "Taken", timestamp: new Date(now - 86400000).toISOString() },
      log2: { status: "Missed", timestamp: new Date(now - 43200000).toISOString() },
      log3: { status: "Taken", timestamp: new Date(now - 3600000).toISOString() },
    },
    heartRate: hr,
    temperature: temp,
    alerts: {
      a1: { message: "Missed morning medication.", type: "Medication", timestamp: new Date(now - 43200000).toISOString() },
      a2: { message: "High Heart Rate Detected (115 BPM)", type: "Vitals_Abnormal", timestamp: new Date(now - 86400000 * 2).toISOString() }
    }
  };
};

function App() {
  const [data, setData] = useState({ medicationLogs: {}, heartRate: {}, temperature: {}, alerts: {} });
  const [loading, setLoading] = useState(true);
  const [alarmTime, setAlarmTime] = useState('');
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) {
      setTimeout(() => {
        setData(generateMockData());
        setLoading(false);
      }, 500); // UI Loading simulation
      
      const interval = setInterval(() => {
         setData(prev => {
            const newData = { ...prev };
            const now = new Date().toISOString();
            const newHrKey = `live_hr_${Date.now()}`;
            newData.heartRate[newHrKey] = { value: Math.floor(Math.random() * (85 - 65 + 1) + 65), timestamp: now };
            const newTempKey = `live_temp_${Date.now()}`;
            newData.temperature[newTempKey] = { value: (Math.random() * (37.2 - 36.1) + 36.1).toFixed(1), timestamp: now };
            return newData;
         });
      }, 3000); // add new simulated live data point every 3 seconds
      
      return () => clearInterval(interval);
    }

    // REAL HARDWARE LOGIC
    try {
      const userRef = ref(db, 'users/elderly_01');
      const unsubscribe = onValue(userRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setData(val);
          if (val.alarmTime) setAlarmTime(val.alarmTime);
          if (val.isAlarmActive !== undefined) setIsAlarmActive(val.isAlarmActive);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase not configured", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeCheckInterval = setInterval(() => {
      if (isAlarmActive && alarmTime) {
        const now = new Date();
        const currentHours = now.getHours().toString().padStart(2, '0');
        const currentMinutes = now.getMinutes().toString().padStart(2, '0');
        const currentTimeString = `${currentHours}:${currentMinutes}`;
        
        if (currentTimeString === alarmTime) {
          alert(`🔔 MEDICATION TIME! It is ${currentTimeString}. Please take your medicine.`);
          handleStopAlarm();
        }
      }
    }, 1000 * 30); // Check every 30 seconds

    return () => clearInterval(timeCheckInterval);
  }, [isAlarmActive, alarmTime]);

  const handleSetAlarm = () => {
    if (!alarmTime) return;
    setIsAlarmActive(true);
    if (!DEMO_MODE) {
      set(ref(db, 'users/elderly_01/alarmTime'), alarmTime);
      set(ref(db, 'users/elderly_01/isAlarmActive'), true);
    }
  };

  const handleStopAlarm = () => {
    setIsAlarmActive(false);
    if (!DEMO_MODE) {
      set(ref(db, 'users/elderly_01/isAlarmActive'), false);
    }
  };

  if (loading) return <div className="loader"></div>;

  const logsArray = Object.values(data.medicationLogs || {});
  const totalLogs = logsArray.length;
  const takenLogs = logsArray.filter(log => log.status === "Taken").length;
  const adherence = totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : 100;

  const hrArray = Object.values(data.heartRate || {}).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latestHR = hrArray.length > 0 ? hrArray[hrArray.length - 1].value : "--";

  const tempArray = Object.values(data.temperature || {}).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latestTemp = tempArray.length > 0 ? tempArray[tempArray.length - 1].value : "--";

  const alertsArray = Object.values(data.alerts || {}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const hrChartData = {
    labels: hrArray.slice(-15).map(hr => new Date(hr.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})),
    datasets: [{
      label: 'Heart Rate (BPM)', data: hrArray.slice(-15).map(hr => hr.value),
      borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.2)', fill: true, tension: 0.4, pointBackgroundColor: '#e74c3c', borderWidth: 3
    }]
  };

  const tempChartData = {
    labels: tempArray.slice(-15).map(t => new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})),
    datasets: [{
      label: 'Temperature (°C)', data: tempArray.slice(-15).map(t => t.value),
      borderColor: '#4a90e2', backgroundColor: 'rgba(74, 144, 226, 0.2)', fill: true, tension: 0.4, pointBackgroundColor: '#4a90e2', borderWidth: 3
    }]
  };

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { y: { ticks: { font: { size: 14 } } }, x: { ticks: { font: { size: 10 } }, grid: { display: false } } }
  };

  return (
    <div className="dashboard-container">
      {DEMO_MODE && (
        <div style={{ background: '#f39c12', color: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '25px', textAlign: 'center', fontWeight: '600', boxShadow: '0 4px 15px rgba(243, 156, 18, 0.3)', border: '1px solid #e67e22', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          🧪 DEMO MODE ACTIVE: Showing simulated patient data! Live charts are auto-updating.<br/>
          <span style={{fontSize: '0.9rem', fontWeight: '400', opacity: 0.9}}>(Change 'DEMO_MODE=false' in App.jsx when you are ready to connect the hardware)</span>
        </div>
      )}
      <header className="header">
        <h1>Caregiver Health Dashboard</h1>
        <p>Real-time monitoring for the Smart Pillbox & Wearable Band System</p>
      </header>
      <div className="grid">
        <div className="card stat-card">
          <h2>💊 Medication Adherence</h2>
          <div className="stat-value">{adherence}%</div>
          <div className="stat-sub">{takenLogs} out of {totalLogs} tracked doses successfully taken</div>
        </div>
        <div className="card stat-card alarm-card">
          <h2>⏰ Set Medication Alarm</h2>
          <div className="alarm-controls" style={{marginTop: '15px', display: 'flex', gap: '10px', alignItems: 'center'}}>
            <input 
              type="time" 
              value={alarmTime} 
              onChange={(e) => setAlarmTime(e.target.value)} 
              style={{padding: '8px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem'}}
            />
            <button 
              onClick={handleSetAlarm}
              style={{padding: '8px 15px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'}}
            >
              Set
            </button>
            <button 
              onClick={handleStopAlarm}
              disabled={!isAlarmActive}
              style={{padding: '8px 15px', background: isAlarmActive ? '#e74c3c' : '#ccc', color: 'white', border: 'none', borderRadius: '5px', cursor: isAlarmActive ? 'pointer' : 'not-allowed', fontWeight: 'bold'}}
            >
              Stop
            </button>
          </div>
          <div className="stat-sub" style={{marginTop: '10px'}}>
            Status: {isAlarmActive ? <span style={{color: '#2ecc71', fontWeight: 'bold'}}>Active ({alarmTime})</span> : <span style={{color: '#7f8c8d'}}>Inactive</span>}
          </div>
        </div>
        <div className="card stat-card">
          <h2>❤️ Latest Heart Rate</h2>
          <div className="stat-value">{latestHR} <span className="unit">BPM</span></div>
          <div className="stat-sub">Normal Range: 60 - 100 BPM</div>
        </div>
        <div className="card stat-card">
          <h2>🌡️ Body Temperature</h2>
          <div className="stat-value">{latestTemp} <span className="unit">°C</span></div>
          <div className="stat-sub">Normal Range: 36.5 - 37.5 °C</div>
        </div>
      </div>
      <div className="grid charts-grid">
        <div className="card chart-container">
          <h2 className="chart-title">Heart Rate History (Live)</h2>
          <div className="chart-wrapper"><Line data={hrChartData} options={chartOptions} /></div>
        </div>
        <div className="card chart-container">
          <h2 className="chart-title">Temperature History (Live)</h2>
          <div className="chart-wrapper"><Line data={tempChartData} options={chartOptions} /></div>
        </div>
      </div>
      <div className="card alerts-container">
        <h2>⚠️ Recent Alert Notifications</h2>
        {alertsArray.length === 0 ? (
          <p style={{marginTop: '10px', fontSize: '1.2rem', color: '#7f8c8d'}}>No alerts recorded in the system.</p>
        ) : (
          <ul className="alert-list">
            {alertsArray.slice(0, 10).map((alert, index) => (
              <li key={index} className={`alert-item ${alert.type === 'Medication' ? 'medication' : 'vitals'}`}>
                <div className="alert-content">
                  <span className="alert-text">{alert.message}</span>
                  <span className="alert-type"> | Alert Type: {alert.type}</span>
                </div>
                <div className="alert-time">{new Date(alert.timestamp).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
