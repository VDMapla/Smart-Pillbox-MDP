import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set, push, remove } from "firebase/database";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ==========================================
// 🧪 DEMO MODE TOGGLE
// ==========================================
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
      log4: { status: "Taken", timestamp: new Date(now - 1200000).toISOString() },
    },
    heartRate: hr,
    temperature: temp,
    alerts: {
      a1: { message: "Missed morning medication.", type: "Medication", timestamp: new Date(now - 43200000).toISOString() },
      a2: { message: "High Heart Rate Detected (115 BPM)", type: "Vitals_Abnormal", timestamp: new Date(now - 86400000 * 2).toISOString() }
    },
    alarms: {
      morning: { time: '08:00', active: true },
      evening: { time: '14:00', active: false },
      night: { time: '20:00', active: true }
    },
    medicines: {
      m1: { name: 'Aspirin', dosage: '100mg', frequency: 'Morning' },
      m2: { name: 'Metformin', dosage: '500mg', frequency: 'Evening' },
      m3: { name: 'Atorvastatin', dosage: '20mg', frequency: 'Night' }
    }
  };
};

function App() {
  const [data, setData] = useState({ 
    medicationLogs: {}, heartRate: {}, temperature: {}, alerts: {}, 
    alarms: { morning: {time:'', active:false}, evening: {time:'', active:false}, night: {time:'', active:false} }, 
    medicines: {} 
  });
  const [loading, setLoading] = useState(true);
  
  // Local active state for 3 alarms to handle user inputs
  const [localAlarms, setLocalAlarms] = useState({
     morning: { time: '', active: false },
     evening: { time: '', active: false },
     night: { time: '', active: false }
  });

  // Local state for new medicine form
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFreq, setNewMedFreq] = useState('Morning');

  useEffect(() => {
    if (DEMO_MODE) {
      setTimeout(() => {
        const mock = generateMockData();
        setData(mock);
        if (mock.alarms) setLocalAlarms(mock.alarms);
        setLoading(false);
      }, 500);
      
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
      }, 3000);
      return () => clearInterval(interval);
    }

    try {
      const userRef = ref(db, 'users/elderly_01');
      const unsubscribe = onValue(userRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          setData(val);
          if (val.alarms) setLocalAlarms(val.alarms);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase not configured", e);
      setLoading(false);
    }
  }, []);

  // Time Monitor
  useEffect(() => {
    const timeCheckInterval = setInterval(() => {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;
      
      const periods = ['morning', 'evening', 'night'];
      periods.forEach(p => {
        if (localAlarms[p]?.active && localAlarms[p]?.time === currentTimeString) {
          alert(`🔔 MEDICATION TIME! It is ${currentTimeString} (${p} dose). Please take your medicine.`);
          handleToggleAlarm(p, false); // Turn off after ringing to prevent spam
        }
      });
    }, 1000 * 30); // Check every 30 seconds

    return () => clearInterval(timeCheckInterval);
  }, [localAlarms]);

  const handleTimeChange = (period, value) => {
    setLocalAlarms(prev => ({ ...prev, [period]: { ...prev[period], time: value } }));
  };

  const handleToggleAlarm = (period, forceState = null) => {
    const newState = forceState !== null ? forceState : !localAlarms[period].active;
    const updatedAlarms = { ...localAlarms, [period]: { ...localAlarms[period], active: newState } };
    setLocalAlarms(updatedAlarms);
    
    if (!DEMO_MODE) {
      set(ref(db, `users/elderly_01/alarms/${period}`), updatedAlarms[period]);
    } else {
        // Sync local demo state
        setData(prev => ({ ...prev, alarms: updatedAlarms }));
    }
  };

  const handleAddMedicine = (e) => {
    e.preventDefault();
    if (!newMedName || !newMedDosage) return;
    
    const newMed = { name: newMedName, dosage: newMedDosage, frequency: newMedFreq };
    
    if (!DEMO_MODE) {
      const medsRef = ref(db, 'users/elderly_01/medicines');
      push(medsRef, newMed);
    } else {
      setData(prev => ({
        ...prev,
        medicines: { ...prev.medicines, [`m_${Date.now()}`]: newMed }
      }));
    }
    
    setNewMedName('');
    setNewMedDosage('');
    setNewMedFreq('Morning');
  };

  const handleRemoveMedicine = (key) => {
    if (!DEMO_MODE) {
      remove(ref(db, `users/elderly_01/medicines/${key}`));
    } else {
      setData(prev => {
        const newMeds = { ...prev.medicines };
        delete newMeds[key];
        return { ...prev, medicines: newMeds };
      });
    }
  };

  if (loading) return <div className="loader-container"><div className="loader"></div></div>;

  const logsArray = Object.values(data.medicationLogs || {});
  const totalLogs = logsArray.length;
  const takenLogs = logsArray.filter(log => log.status === "Taken").length;
  const adherence = totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : 100;

  const hrArray = Object.values(data.heartRate || {}).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latestHR = hrArray.length > 0 ? hrArray[hrArray.length - 1].value : "--";

  const tempArray = Object.values(data.temperature || {}).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latestTemp = tempArray.length > 0 ? tempArray[tempArray.length - 1].value : "--";

  const alertsArray = Object.values(data.alerts || {}).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const medicinesArray = Object.entries(data.medicines || {});

  const hrChartData = {
    labels: hrArray.slice(-15).map(hr => new Date(hr.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})),
    datasets: [{
      label: 'Heart Rate (BPM)', data: hrArray.slice(-15).map(hr => hr.value),
      borderColor: '#ff4757', backgroundColor: 'rgba(255, 71, 87, 0.2)', fill: true, tension: 0.4, pointBackgroundColor: '#ff4757', borderWidth: 3
    }]
  };

  const tempChartData = {
    labels: tempArray.slice(-15).map(t => new Date(t.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})),
    datasets: [{
      label: 'Temperature (°C)', data: tempArray.slice(-15).map(t => t.value),
      borderColor: '#1e90ff', backgroundColor: 'rgba(30, 144, 255, 0.2)', fill: true, tension: 0.4, pointBackgroundColor: '#1e90ff', borderWidth: 3
    }]
  };

  const chartOptions = { 
    responsive: true, maintainAspectRatio: false, 
    plugins: { legend: { display: false } },
    scales: { 
      y: { ticks: { color: '#bdc3c7' }, grid: { color: 'rgba(255,255,255,0.05)' } }, 
      x: { ticks: { color: '#bdc3c7', font: { size: 10 } }, grid: { display: false } } 
    }
  };

  return (
    <div className="dashboard-layout">
      {DEMO_MODE && (
        <div className="demo-banner">
          🧪 DEMO MODE ACTIVE: Showing simulated patient data! Live charts are auto-updating.<br/>
          <span>(Change 'DEMO_MODE=false' in App.jsx when you are ready to connect hardware)</span>
        </div>
      )}
      
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">💊</div>
          <h2>VitalSync</h2>
        </div>
        
        <div className="adherence-widget">
           <h3>Adherence Score</h3>
           <div className="progress-ring-container">
             <svg className="progress-ring" viewBox="0 0 100 100">
               <circle className="progress-ring-bg" cx="50" cy="50" r="45"></circle>
               <circle className="progress-ring-fill" cx="50" cy="50" r="45" style={{ strokeDashoffset: 283 - (283 * adherence) / 100, stroke: adherence >= 80 ? '#2ed573' : adherence >= 50 ? '#ffa502' : '#ff4757' }}></circle>
             </svg>
             <div className="progress-text">
               <span className="percent">{adherence}%</span>
             </div>
           </div>
           <p className="adherence-sub">{takenLogs} of {totalLogs} doses taken</p>
        </div>

        <div className="medicine-history">
          <h3>Current Medicines</h3>
          <form onSubmit={handleAddMedicine} className="add-med-form">
            <input type="text" placeholder="Medicine Name" value={newMedName} onChange={e=>setNewMedName(e.target.value)} required/>
            <div className="med-row">
              <input type="text" placeholder="Dosage (e.g. 100mg)" value={newMedDosage} onChange={e=>setNewMedDosage(e.target.value)} required/>
              <select value={newMedFreq} onChange={e=>setNewMedFreq(e.target.value)}>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <button type="submit" className="add-btn">+ Add Med</button>
          </form>
          
          <ul className="med-list">
            {medicinesArray.length === 0 ? <li className="empty-meds">No medicines added yet.</li> : medicinesArray.map(([key, med]) => (
              <li key={key} className="med-item">
                <div className="med-info">
                  <span className="med-name">{med.name}</span>
                  <span className="med-details">{med.dosage} • {med.frequency}</span>
                </div>
                <button onClick={() => handleRemoveMedicine(key)} className="del-btn">✕</button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="main-content">
        <header className="header">
          <div>
            <h1>Patient Dashboard</h1>
            <p>Real-time vitals and smart pillbox monitor</p>
          </div>
          <div className="user-profile">
            <div className="avatar">E01</div>
            <span>Elderly_01</span>
          </div>
        </header>
        
        <div className="top-cards">
          <div className="glass-card stat-card vitals-hr">
            <div className="stat-icon">❤️</div>
            <div className="stat-info">
              <h3>Heart Rate</h3>
              <div className="stat-val">{latestHR} <span>BPM</span></div>
              <p>Normal Range: 60 - 100</p>
            </div>
          </div>
          <div className="glass-card stat-card vitals-temp">
            <div className="stat-icon">🌡️</div>
            <div className="stat-info">
              <h3>Temperature</h3>
              <div className="stat-val">{latestTemp} <span>°C</span></div>
              <p>Normal Range: 36.5 - 37.5</p>
            </div>
          </div>

          <div className="glass-card alarms-card">
            <h3>⏰ Medication Alarms</h3>
            <div className="alarms-grid">
              {['morning', 'evening', 'night'].map(period => (
                <div key={period} className={`alarm-row ${localAlarms[period]?.active ? 'active' : ''}`}>
                  <span className="period-label">{period.charAt(0).toUpperCase() + period.slice(1)}</span>
                  <input type="time" value={localAlarms[period]?.time || ''} onChange={(e) => handleTimeChange(period, e.target.value)} />
                  <button onClick={() => handleToggleAlarm(period)} className={`toggle-btn ${localAlarms[period]?.active ? 'on' : 'off'}`}>
                    {localAlarms[period]?.active ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="glass-card chart-container">
            <h3>Heart Rate Trends</h3>
            <div className="chart-wrapper"><Line data={hrChartData} options={chartOptions} /></div>
          </div>
          <div className="glass-card chart-container">
            <h3>Temperature Trends</h3>
            <div className="chart-wrapper"><Line data={tempChartData} options={chartOptions} /></div>
          </div>
        </div>

        <div className="glass-card alerts-container">
          <h3>⚠️ Recent Notifications & Alerts</h3>
          {alertsArray.length === 0 ? (
            <p className="empty-alerts">System is clear. No recent alerts.</p>
          ) : (
            <ul className="alert-list">
              {alertsArray.slice(0, 5).map((alert, idx) => (
                <li key={idx} className={`alert-item ${alert.type === 'Medication' ? 'medication' : 'vitals'}`}>
                  <div className="alert-icon">{alert.type === 'Medication' ? '💊' : '🚨'}</div>
                  <div className="alert-content">
                    <span className="alert-text">{alert.message}</span>
                    <span className="alert-time">{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
