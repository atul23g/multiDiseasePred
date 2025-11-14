import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ingestReport, predictWithFeatures, Task } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import HealthScoreChart from '../components/HealthScoreChart'

// Helper functions for user-friendly labels
function getUserFriendlyLabel(key: string): string {
  const labels: Record<string, string> = {
    // Heart disease
    'age': 'Age',
    'trestbps': 'Resting Blood Pressure',
    'chol': 'Cholesterol Level',
    'fbs': 'Fasting Blood Sugar',
    'restecg': 'Resting ECG Results',
    'thalach': 'Maximum Heart Rate',
    'exang': 'Exercise-Induced Angina',
    'oldpeak': 'ST Depression',
    'slope': 'ST Slope',
    'ca': 'Major Vessels',
    'thal': 'Thalassemia Type',
    
    // Diabetes
    'Pregnancies': 'Number of Pregnancies',
    'Glucose': 'Blood Glucose Level',
    'BloodPressure': 'Blood Pressure',
    'SkinThickness': 'Skin Fold Thickness',
    'Insulin': 'Insulin Level',
    'BMI': 'Body Mass Index',
    'DiabetesPedigreeFunction': 'Family Diabetes History',
    'Age': 'Age',
    
    // Parkinsons
    'fo': 'Fundamental Frequency',
    'fhi': 'Highest Frequency',
    'flo': 'Lowest Frequency',
    'jitter_percent': 'Voice Jitter (%)',
    'jitter_abs': 'Voice Jitter (Absolute)',
    'rap': 'Relative Amplitude Perturbation',
    'ppq': 'Period Perturbation Quotient',
    'ddp': 'Degree of Deviation',
    'shimmer': 'Voice Shimmer',
    'shimmer_db': 'Shimmer in Decibels',
    'apq3': 'Amplitude Perturbation Quotient 3',
    'apq5': 'Amplitude Perturbation Quotient 5',
    'apq': 'General Amplitude Perturbation',
    'dda': 'Degree of Deviation Amplitude',
    'nhr': 'Noise-to-Harmonics Ratio',
    'hnr': 'Harmonics-to-Noise Ratio',
    'rpde': 'Recurrence Period Density Entropy',
    'dfa': 'Detrended Fluctuation Analysis',
    'spread1': 'Spread 1',
    'spread2': 'Spread 2',
    'd2': 'Correlation Dimension',
    'ppe': 'Pitch Period Entropy',
    
    // General medical terms
    'blood_pressure': 'Blood Pressure',
    'heart_rate': 'Heart Rate',
    'temperature': 'Body Temperature',
    'glucose': 'Blood Glucose',
    'cholesterol': 'Cholesterol',
    'hemoglobin': 'Hemoglobin',
    'wbc': 'White Blood Cells',
    'platelets': 'Platelet Count',
    'weight': 'Weight',
    'height': 'Height'
  }
  
  return labels[key] || key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

function formatDisplayValue(key: string, value: any, task: string): string {
  // Handle chest pain type
  if (key === 'cp' && task === 'heart') {
    const cpTypes: Record<number, string> = {
      0: 'Typical Angina',
      1: 'Atypical Angina', 
      2: 'Non-Anginal Pain',
      3: 'Asymptomatic'
    }
    return cpTypes[Number(value)] || String(value)
  }
  
  // Handle fasting blood sugar
  if (key === 'fbs' && task === 'heart') {
    return value === 1 ? '> 120 mg/dL' : value === 0 ? '<= 120 mg/dL' : String(value)
  }
  
  // Handle exercise induced angina
  if (key === 'exang' && task === 'heart') {
    return value === 1 ? 'Yes' : value === 0 ? 'No' : String(value)
  }
  
  // Handle thalassemia type
  if (key === 'thal' && task === 'heart') {
    const thalTypes: Record<number, string> = {
      0: 'Normal',
      1: 'Fixed Defect',
      2: 'Reversible Defect'
    }
    return thalTypes[Number(value)] || String(value)
  }
  
  return String(value)
}

function getUserFriendlySymptom(key: string): string {
  const symptoms: Record<string, string> = {
    'chest_pain': 'Chest Pain or Discomfort',
    'shortness_of_breath': 'Shortness of Breath',
    'fatigue': 'Fatigue or Tiredness',
    'dizziness': 'Dizziness or Lightheadedness',
    'sweating': 'Excessive Sweating',
    'pain_during_exercise': 'Pain During Exercise',
    'swelling_legs': 'Swelling in Legs'
  }
  
  return symptoms[key] || key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

export default function Upload() {
  const navigate = useNavigate()
  const [task, setTask] = useState<Task>('heart')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [missing, setMissing] = useState<string[]>([])
  const [extractedMeta, setExtractedMeta] = useState<Record<string, { value: any; unit?: string|null; confidence?: number; source?: string }>>({})
  // AI Doctor moved to its own page (Triage). Here we just show a CTA.
  // Lifestyle & Symptoms
  const [lifestyle, setLifestyle] = useState({
    smoking: 'no',
    alcohol: 'no',
    exercise: 'medium',
    diet: 'balanced',
    stress_level: 'medium',
    sleep_hours: 7,
  })
  const [symptoms, setSymptoms] = useState({
    chest_pain: false,
    shortness_of_breath: false,
    fatigue: false,
    dizziness: false,
    sweating: false,
    pain_during_exercise: false,
    swelling_legs: false,
  })
  const [advice, setAdvice] = useState<{summary:string; followups:string[]; model_name:string} | null>(null)

  const haveIngest = useMemo(() => !!reportId, [reportId])
  const havePred = useMemo(() => !!result?.pred, [result])

  // Simple validation: require missing fields to be filled; numeric check for known numeric fields per task
  const numericFieldsByTask: Record<Task, Set<string>> = {
    heart: new Set(['age','trestbps','chol','thalach','oldpeak','ca']),
    diabetes: new Set(['Pregnancies','Glucose','BloodPressure','SkinThickness','Insulin','BMI','DiabetesPedigreeFunction','Age']),
    parkinsons: new Set(['fo','fhi','flo','jitter_percent','jitter_abs','rap','ppq','ddp','shimmer','shimmer_db','apq3','apq5','apq','dda','nhr','hnr','rpde','dfa','spread1','spread2','d2','ppe']),
    general: new Set<string>(),
  }
  const invalidMissing = useMemo(() => {
    if (!haveIngest) return [] as string[]
    const nums = numericFieldsByTask[task]
    const bad: string[] = []
    for (const k of missing) {
      // Skip age validation since it's hidden
      if (k === 'age' || k === 'Age') continue
      const v = (features as any)[k]
      if (v === '' || v === null || v === undefined) { bad.push(k); continue }
      if (nums.has(k)) {
        const n = Number(v)
        if (!Number.isFinite(n)) bad.push(k)
      }
    }
    return bad
  }, [haveIngest, missing, features, task])
  const canAnalyze = haveIngest && invalidMissing.length === 0 && task !== 'general'

  // Confidence grouping from extractedMeta - now including high confidence fields for confirmation
  const groups = useMemo(() => {
    const high: string[] = []
    const medium: string[] = []
    const low: string[] = []
    Object.keys(extractedMeta || {}).forEach(k => {
      if (missing.includes(k)) return
      // Hide age from display
      if (k === 'age' || k === 'Age') return
      const c = extractedMeta[k]?.confidence
      if (typeof c !== 'number') return
      if (c >= 0.95) high.push(k)
      else if (c >= 0.90) medium.push(k)
      else low.push(k)
    })
    return { high, medium, low }
  }, [extractedMeta, missing])

  // Include all extracted fields for confirmation (high confidence fields are now optional confirmation)
  const optionalConfirmationKeys = useMemo(() => {
    const allKeys = [...groups.high, ...groups.medium]
    // Filter out age and gender from optional confirmation
    return allKeys.filter(k => k !== 'age' && k !== 'Age' && k !== 'sex')
  }, [groups.high, groups.medium])

  // Treat low-confidence fields and missing fields as required inputs
  const requiredKeys = useMemo(() => {
    const set = new Set<string>([...missing, ...groups.low])
    // Filter out age and gender from required keys
    const filtered = Array.from(set).filter(k => k !== 'age' && k !== 'Age' && k !== 'sex')
    return filtered
  }, [missing, groups.low])

  // No direct chat here anymore

  const onSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const token = await getAccessToken()
      const ingest = await ingestReport(task, file, token)
      setReportId(ingest.report_id)
      // initialize features with extracted + placeholders for missing
      const f: Record<string, any> = { ...(ingest.extracted || {}) }
      ;(ingest.missing_fields || []).forEach((k: string) => {
        if (!(k in f)) f[k] = ''
      })
      setFeatures(f)
      setMissing(ingest.missing_fields || [])
      setExtractedMeta(ingest.extracted_meta || {})
      // In general mode, stash context immediately for Triage
      if (task === 'general') {
        localStorage.setItem('latest_result', JSON.stringify({
          task,
          features: f,
          prediction: null,
          prediction_id: null,
          lifestyle,
          symptoms,
        }))
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const onAnalyze = async () => {
    if (!haveIngest) return
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      const pred = await predictWithFeatures(task, features, reportId || undefined, token)
      setResult({ pred })
      // stash for triage page
      localStorage.setItem('latest_result', JSON.stringify({
        task,
        features,
        prediction: {
          label: pred.label,
          probability: pred.probability,
          health_score: pred.health_score,
        },
        prediction_id: pred.prediction_id,
        lifestyle,
        symptoms,
      }))
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Analyze failed')
    } finally {
      setLoading(false)
    }
  }

  const onGetAdvice = () => {
    if (!havePred) return
    // Pass current report data to triage page in the same structure as localStorage
    const reportData = {
      task,
      features,
      prediction: result?.pred ? {
        label: result.pred.label,
        probability: result.pred.probability,
        health_score: result.pred.health_score,
      } : null,
      prediction_id: result?.pred?.prediction_id,
      lifestyle,
      symptoms,
    }
    navigate('/triage', { state: { reportData } })
  }

  return (
    <>
      <div className="card" style={{marginBottom:24}}>
        <div style={{fontSize:32, fontWeight:800, lineHeight:1.2, marginBottom:8}}>
          🤖 AI Health Assistant
        </div>
        <div style={{color:'var(--text-secondary)', marginBottom:16, fontSize:16}}>
          Get personalized health insights and advice from our AI assistant. Ask questions about your health in plain language.
        </div>
        <div style={{marginTop:16}}>
          <button className="btn btn-success" onClick={()=>navigate('/triage', { state: { reportData: result } })}>
            <span style={{marginRight:8}}>💬</span>
            Start Health Consultation
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24}}>
          <h2 style={{margin:0, fontSize:28, fontWeight:700}}>📋 Upload Medical Report</h2>
          {/* Enhanced 3-step indicator */}
          {(
            () => {
              const step = !haveIngest ? 1 : !havePred ? 2 : 3
              const dot = (active:boolean, label:string) => (
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <div style={{width:12, height:12, borderRadius:999, background: active ? 'var(--secondary)' : 'var(--border)', transition:'all 0.3s ease'}}/>
                  <span style={{fontSize:14, color:active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight:active ? 600 : 400}}>{label}</span>
                </div>
              )
              return (
                <div style={{display:'flex', alignItems:'center', gap:16}}>
                  {dot(step>=1, 'Upload')}
                  <div style={{width:32, height:2, background:'var(--border)', borderRadius:1}}/>
                  {dot(step>=2, 'Review Data')}
                  <div style={{width:32, height:2, background:'var(--border)', borderRadius:1}}/>
                  {dot(step>=3, 'Get Results')}
                </div>
              )
            }
          )()}
        </div>
        
        <div className="row" style={{marginBottom:24}}>
          <div className="col">
            <label style={{fontWeight:600, marginBottom:8, display:'block'}}>Health Focus Area</label>
            <select className="input" value={task} onChange={e => setTask(e.target.value as Task)}>
              <option value="general">🩺 General Health Assessment</option>
              <option value="heart">❤️ Heart Health & Cardiovascular</option>
              <option value="diabetes">🍯 Diabetes & Blood Sugar</option>
              <option value="parkinsons">🧠 Neurological Health</option>
            </select>
            <div style={{marginTop:8, fontSize:14, color:'var(--text-muted)'}}>
              {task === 'general' && 'Comprehensive health analysis across all areas'}
              {task === 'heart' && 'Focus on heart disease risk and cardiovascular health'}
              {task === 'diabetes' && 'Diabetes risk assessment and blood sugar analysis'}
              {task === 'parkinsons' && 'Neurological condition assessment'}
            </div>
          </div>
          <div className="col">
            <label style={{fontWeight:600, marginBottom:8, display:'block'}}>Medical Report (PDF)</label>
            <input
              className="input"
              type="file"
              accept=".pdf,application/pdf"
              onChange={e => {
                const f = e.target.files?.[0] || null
                if (f && f.type && f.type !== 'application/pdf') {
                  setError('Please upload a PDF file (.pdf)')
                  setFile(null)
                  return
                }
                setFile(f)
              }}
            />
            <div style={{marginTop:8, fontSize:14, color:'var(--text-muted)'}}>
              Upload your lab reports, blood tests, or medical documents
            </div>
          </div>
        </div>
        
        <div style={{marginTop:16}}>
          <button className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={!file || loading} onClick={onSubmit}>
            {loading ? (
              <span><span className="loading-spinner"></span>Uploading & Analyzing...</span>
            ) : (
              <span>📤 Upload & Analyze Report</span>
            )}
          </button>
        </div>
        
        {error && <div className="alert alert-error" style={{marginTop:16}}>⚠️ {error}</div>}
        
        {/* Extracted values summary and confidence-driven review */}
        {haveIngest && (
          <div style={{marginTop:24}}>
            {task === 'general' && (
              <div className="alert alert-info" style={{marginBottom:16}}>
                ℹ️ General Health Mode: We've extracted all available health data from your report. 
                Click "Get Health Advice" to receive personalized guidance from our AI assistant.
              </div>
            )}
            

            
            {task !== 'general' && !!optionalConfirmationKeys.length && (
              <div style={{marginTop:24}}>
                <div style={{fontWeight:700, fontSize:18, marginBottom:12, color:'var(--text-primary)'}}>
                  🔍 Optional Confirmation Needed
                </div>
                <div className="row" style={{marginTop:12}}>
                  {optionalConfirmationKeys.sort().map(k => {
                    const meta = extractedMeta[k] || {}
                    return (
                      <div className="col" key={k}>
                        <label style={{fontWeight:600, marginBottom:4, display:'block'}}>
                          {getUserFriendlyLabel(k)}
                          {meta.confidence && (
                            <span style={{fontSize:12, color:'var(--text-muted)', marginLeft:4}}>
                              ({(meta.confidence * 100).toFixed(0)}% confidence)
                            </span>
                          )}
                        </label>
                        <input 
                          className="input" 
                          type="text" 
                          value={features[k] ?? ''} 
                          onChange={e=>setFeatures(p=>({...p,[k]:e.target.value}))} 
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {task !== 'general' && !!requiredKeys.length && (
              <div style={{marginTop:24}}>
                <div style={{fontWeight:700, fontSize:18, marginBottom:12, color:'var(--text-primary)'}}>
                  ⚠️ Required Information Missing
                </div>
                <div className="row" style={{marginTop:12}}>
                  {requiredKeys.map((k) => (
                    <div className="col" key={k}>
                      <label style={{fontWeight:600, marginBottom:4, display:'block'}}>
                        {getUserFriendlyLabel(k)} *
                      </label>
                      <input
                        className="input"
                        type="text"
                        value={features[k] ?? ''}
                        onChange={e => setFeatures(prev => ({ ...prev, [k]: e.target.value }))}
                        style={invalidMissing.includes(k) ? { borderColor: 'var(--error)' } : undefined}
                      />
                    </div>
                  ))}
                </div>
                {invalidMissing.length > 0 && (
                  <div className="alert alert-error" style={{marginTop:16}}>
                    ⚠️ Please provide valid values for: {invalidMissing.map(k => getUserFriendlyLabel(k)).join(', ')}.
                  </div>
                )}
              </div>
            )}
            
            {/* Lifestyle & Symptoms */}
            <div style={{marginTop:32}}>
              <details open>
                <summary style={{fontSize:18, fontWeight:700, cursor:'pointer', marginBottom:16}}>
                  🌟 Lifestyle Factors (Improves AI Recommendations)
                </summary>
                <div className="row" style={{marginTop:16}}>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Smoking Status</label>
                    <select className="input" value={lifestyle.smoking} onChange={e=>setLifestyle(s=>({...s, smoking:e.target.value}))}>
                      <option value="no">🚭 Non-smoker</option>
                      <option value="yes">🚬 Smoker</option>
                    </select>
                  </div>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Alcohol Consumption</label>
                    <select className="input" value={lifestyle.alcohol} onChange={e=>setLifestyle(s=>({...s, alcohol:e.target.value}))}>
                      <option value="no">🥤 No alcohol</option>
                      <option value="yes">🍷 Occasional/Regular</option>
                    </select>
                  </div>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Exercise Level</label>
                    <select className="input" value={lifestyle.exercise} onChange={e=>setLifestyle(s=>({...s, exercise:e.target.value}))}>
                      <option value="low">🚶‍♂️ Low (Rarely exercise)</option>
                      <option value="medium">🏃‍♂️ Medium (2-3x per week)</option>
                      <option value="high">💪 High (4+ times per week)</option>
                    </select>
                  </div>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Diet Type</label>
                    <select className="input" value={lifestyle.diet} onChange={e=>setLifestyle(s=>({...s, diet:e.target.value}))}>
                      <option value="balanced">⚖️ Balanced diet</option>
                      <option value="veg">🥗 Vegetarian</option>
                      <option value="non-veg">🍖 Non-vegetarian</option>
                      <option value="high-fat">🧈 High-fat diet</option>
                      <option value="junk">🍔 Mostly processed foods</option>
                    </select>
                  </div>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Stress Level</label>
                    <select className="input" value={lifestyle.stress_level} onChange={e=>setLifestyle(s=>({...s, stress_level:e.target.value}))}>
                      <option value="low">😌 Low stress</option>
                      <option value="medium">😐 Moderate stress</option>
                      <option value="high">😰 High stress</option>
                    </select>
                  </div>
                  <div className="col">
                    <label style={{fontWeight:600, marginBottom:4, display:'block'}}>Sleep Duration</label>
                    <input className="input" type="number" min={0} max={24} value={lifestyle.sleep_hours} onChange={e=>setLifestyle(s=>({...s, sleep_hours:Number(e.target.value||0)}))}/>
                    <div style={{fontSize:12, color:'var(--text-muted)', marginTop:4}}>Hours per night</div>
                  </div>
                </div>
              </details>
              
              <details style={{marginTop:16}}>
                <summary style={{fontSize:18, fontWeight:700, cursor:'pointer', marginBottom:16}}>
                  🩺 Current Symptoms
                </summary>
                <div className="row" style={{marginTop:16}}>
                  {Object.keys(symptoms).map((k)=> (
                    <div className="col" key={k}>
                      <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer'}}>
                        <input type="checkbox" checked={(symptoms as any)[k]} onChange={e=>setSymptoms(prev=>({...prev,[k]:e.target.checked}))}/>
                        <span>{getUserFriendlySymptom(k)}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </details>
              
              <div style={{marginTop:24}}>
                {task === 'general' ? (
                  <button className="btn btn-success" onClick={()=>navigate('/triage', { state: { reportData: result } })}>
                    <span style={{marginRight:8}}>💡</span>
                    Get Personalized Health Advice
                  </button>
                ) : (
                  <button className={`btn btn-primary ${loading ? 'btn-loading' : ''}`} disabled={!canAnalyze || loading} onClick={onAnalyze}>
                    {loading ? (
                      <span><span className="loading-spinner"></span>Analyzing your health data...</span>
                    ) : (
                      <span>🔬 Get Health Analysis</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {result && result.pred && (
        <>
          <HealthScoreChart 
            task={task}
            features={features}
            prediction={result.pred}
          />
          
          <div className="card" style={{marginTop:24}}>
            <div style={{marginTop:24}}>
              <button className="btn btn-success" onClick={onGetAdvice} disabled={loading}>
                {loading ? (
                  <span>🔄 Opening AI Health Assistant...</span>
                ) : (
                  <span>💬 Get Personalized Health Advice</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
