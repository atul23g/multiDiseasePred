import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { predictWithFeatures, Task, getFeatureSchema } from '../lib/api'
import { getAccessToken } from '../lib/auth'
import HealthScoreChart from '../components/HealthScoreChart'

export default function Manual() {
  const navigate = useNavigate()
  const [task, setTask] = useState<Task>('heart')
  const [schema, setSchema] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken()
        const res = await getFeatureSchema(task, token)
        setSchema(res.schema || {})
        setFeatures({})
      } catch (e) {
        // ignore
      }
    })()
  }, [task])

  const onPredict = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAccessToken()
      const pred = await predictWithFeatures(task, features, undefined, token)
      setResult(pred)
      localStorage.setItem('latest_result', JSON.stringify({
        task,
        features,
        prediction: {
          label: pred.label,
          probability: pred.probability,
          health_score: pred.health_score,
        },
        prediction_id: pred.prediction_id,
      }))
    } catch (e: any) {
      setError(e?.response?.data?.detail || e.message || 'Prediction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="card" style={{marginBottom:24}}>
        <div style={{fontSize:32, fontWeight:800, lineHeight:1.2, marginBottom:8}}>
          🤖 AI Health Assistant
        </div>
        <div style={{color:'var(--text-secondary)', marginBottom:16, fontSize:16}}>
          Get personalized medical guidance. Use this after you fill values or anytime.
        </div>
        <div style={{marginTop:16}}>
          <button className="btn btn-success" onClick={()=>navigate('/triage', { state: { reportData: {
            task,
            features,
            prediction: result ? {
              label: result.label,
              probability: result.probability,
              health_score: result.health_score,
            } : null,
            prediction_id: result?.prediction_id,
          } } })}>
            <span style={{marginRight:8}}>💬</span>
            Start Health Consultation
          </button>
        </div>
      </div>

      <div className="card">
      <h2>Manual Input</h2>
      <div className="row">
        <div className="col">
          <label>Task</label>
          <select className="input" value={task} onChange={e => setTask(e.target.value as Task)}>
            <option value="heart">heart</option>
            <option value="diabetes">diabetes</option>
            <option value="parkinsons">parkinsons</option>
          </select>
        </div>
      </div>
      <div style={{marginTop:12}} className="row">
        {Object.keys(schema).map((k) => (
          <div className="col" key={k}>
            <label>{k}</label>
            <input className="input" type="text" value={features[k] ?? ''}
              onChange={e => setFeatures(prev => ({...prev, [k]: e.target.value}))} />
          </div>
        ))}
      </div>
      <div style={{marginTop:12}}>
        <button className="btn" onClick={onPredict} disabled={loading}>{loading ? 'Predicting...' : 'Predict'}</button>
      </div>
      {error && <div className="alert" style={{marginTop:12}}>{error}</div>}
      {result && (
        <>
          <HealthScoreChart 
            task={task}
            features={features}
            prediction={result}
          />
          <div style={{marginTop:16}}>
            <button className="btn btn-success" onClick={()=>navigate('/triage', { state: { reportData: {
              task,
              features,
              prediction: result ? {
                label: result.label,
                probability: result.probability,
                health_score: result.health_score,
              } : null,
              prediction_id: result?.prediction_id,
            } } })}>
              <span style={{marginRight:8}}>💬</span>
              Get Personalized Health Advice
            </button>
          </div>
        </>
      )}
      </div>
    </>
  )
}
