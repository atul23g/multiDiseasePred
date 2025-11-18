import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Heart, Activity, Brain, User, FileText, TrendingUp, AlertCircle } from 'lucide-react'
import { getAccessToken } from '../lib/auth'
import { getHistoryReports, predictWithFeatures, Task } from '../lib/api'

interface HealthData {
  task: string
  features: Record<string, any>
  prediction: {
    label: number
    probability: number
    health_score: number
  } | null
  lifestyle: Record<string, any>
  symptoms: Record<string, boolean>
  timestamp?: string
}

interface Report {
  id: string
  task: string
  createdAt: string
  prediction?: {
    label: number
    probability: number
    health_score: number
  }
  features: Record<string, any>
}

export default function History() {
  const navigate = useNavigate()
  const [latest, setLatest] = useState<HealthData | null>(null)
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHealthData()
    loadReports()
  }, [])

  const loadHealthData = () => {
    try {
      const stored = localStorage.getItem('latest_result')
      if (stored) {
        const data = JSON.parse(stored)
        setLatest(data)
      }
    } catch (error) {
      console.error('Error loading health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      const token = await getAccessToken()
      const rows = await getHistoryReports(token)
      setReports(rows || [])
    } catch (error) {
      console.error('Error loading reports:', error)
    }
  }

  const getTaskIcon = (task: string) => {
    switch (task) {
      case 'heart': return <Heart className="w-5 h-5 text-red-500" />
      case 'diabetes': return <Activity className="w-5 h-5 text-blue-500" />
      case 'parkinsons': return <Brain className="w-5 h-5 text-purple-500" />
      default: return <User className="w-5 h-5 text-gray-500" />
    }
  }

  const getTaskLabel = (task: string) => {
    switch (task) {
      case 'heart': return 'Heart Health'
      case 'diabetes': return 'Diabetes Assessment'
      case 'parkinsons': return 'Neurological Health'
      case 'general': return 'General Health'
      default: return task.charAt(0).toUpperCase() + task.slice(1)
    }
  }

  const formatFeatureLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'age': 'Age',
      'sex': 'Gender',
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
      'Pregnancies': 'Number of Pregnancies',
      'Glucose': 'Blood Glucose Level',
      'BloodPressure': 'Blood Pressure',
      'SkinThickness': 'Skin Fold Thickness',
      'Insulin': 'Insulin Level',
      'BMI': 'Body Mass Index',
      'DiabetesPedigreeFunction': 'Family Diabetes History',
      'Age': 'Age'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatLifestyleLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'smoking': 'Smoking Status',
      'alcohol': 'Alcohol Consumption',
      'exercise': 'Exercise Level',
      'diet': 'Diet Type',
      'stress_level': 'Stress Level',
      'sleep_hours': 'Sleep Duration'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const formatSymptomLabel = (key: string): string => {
    const labels: Record<string, string> = {
      'chest_pain': 'Chest Pain or Discomfort',
      'shortness_of_breath': 'Shortness of Breath',
      'fatigue': 'Fatigue or Tiredness',
      'dizziness': 'Dizziness or Lightheadedness',
      'sweating': 'Excessive Sweating',
      'pain_during_exercise': 'Pain During Exercise',
      'swelling_legs': 'Swelling in Legs'
    }
    return labels[key] || key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getRiskLevel = (label: number, probability: number) => {
    if (label === 1) {
      return { text: 'Higher Risk', color: 'text-red-600 bg-red-50', icon: <AlertCircle className="w-4 h-4" /> }
    }
    return { text: 'Lower Risk', color: 'text-green-600 bg-green-50', icon: <TrendingUp className="w-4 h-4" /> }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading health history...</span>
          </div>
        </div>
      </div>
    )
  }

  const clinicalEntries = latest?.features
    ? Object.entries(latest.features).filter(([_, value]) => value !== null && value !== undefined && value !== '')
    : []

  const lifestyleEntries = latest?.lifestyle
    ? Object.entries(latest.lifestyle).filter(([_, value]) => value !== null && value !== undefined && value !== '')
    : []

  const activeSymptoms = latest?.symptoms
    ? Object.entries(latest.symptoms).filter(([_, value]) => value === true)
    : []

  const clinicalHighlights = clinicalEntries.slice(0, 4)
  const lifestyleHighlights = lifestyleEntries.slice(0, 3)
  const hasSymptoms = activeSymptoms.length > 0

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Health History</h1>
        <p className="page-subtitle">
          Review your previous health assessments, keep tabs on key vitals, and stay informed with curated lifestyle insights.
        </p>
      </div>

      {!latest && (
        <div className="card">
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Health History Yet</h3>
            <p className="text-gray-600 mb-6">Start your health journey by uploading a medical report or entering your health data manually.</p>
            <div className="btn-group">
              <button 
                onClick={() => navigate('/upload')}
                className="btn btn-primary"
              >
                Upload Report
              </button>
              <button 
                onClick={() => navigate('/manual')}
                className="btn btn-secondary"
              >
                Enter Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {latest && (
        <div className="max-w-2xl mx-auto">
          <div className="card assessment-card rounded-2xl p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                {getTaskIcon(latest.task)}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{getTaskLabel(latest.task)}</h2>
              <p className="text-gray-500">Latest Assessment</p>
            </div>

            {latest.prediction && (
              <div className="text-center mb-6">
                <div className="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                  <p className="text-sm text-gray-600 mb-2">Health Score</p>
                  <div className="text-5xl font-bold text-blue-600 mb-2">{latest.prediction.health_score?.toFixed(1)}</div>
                  <p className="text-sm text-gray-500">out of 100</p>
                </div>
              </div>
            )}

            <div className="btn-group">
              <button
                onClick={() => navigate('/triage')}
                className="btn btn-primary"
              >
                Consult Dr. Intelligence
              </button>
              <button
                onClick={async () => {
                  // Analyze the latest assessment
                  try {
                    const token = await getAccessToken()
                    const features = latest.features || {}
                    const task = (latest.task || 'general') as Task
                    if (task !== 'general' && latest.prediction) {
                      // Already has prediction, just navigate to triage with existing data
                      navigate('/triage', { state: { reportData: latest } })
                    } else if (task !== 'general') {
                      // Get new prediction
                      const pred = await predictWithFeatures(task, features, latest.prediction_id, token)
                      const updatedLatest = {
                        ...latest,
                        prediction: { label: pred.label, probability: pred.probability, health_score: pred.health_score },
                        prediction_id: pred.prediction_id
                      }
                      localStorage.setItem('latest_result', JSON.stringify(updatedLatest))
                      navigate('/triage', { state: { reportData: updatedLatest } })
                    } else {
                      // General mode - navigate directly
                      navigate('/triage', { state: { reportData: latest } })
                    }
                  } catch (error) {
                    console.error('Error analyzing latest assessment:', error)
                    // Fallback: just navigate to triage with existing data
                    navigate('/triage', { state: { reportData: latest } })
                  }
                }}
                className="btn btn-secondary"
              >
                Analyze
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        </div>
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="report-item flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getTaskIcon(r.task)}
                <div>
                  <div className="font-medium text-gray-900">{r.rawFilename || 'Report'}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="btn-group" style={{gap:'0.5rem'}}>
                <button
                  className="btn btn-secondary"
                  onClick={()=>{
                    navigate('/upload', { state: { report: r } })
                  }}
                >
                  Analyze
                </button>
                <button
                  className="btn btn-primary"
                  onClick={()=>{
                    const latest = {
                      task: r.task,
                      features: r.extracted || {},
                      prediction: null,
                      prediction_id: null,
                      lifestyle: {},
                      symptoms: {},
                      extracted_text: r.rawOCR?.text || '',
                      highlights: Object.entries(r.extractedMeta||{}).filter(([_,v]: any)=>v?.out_of_range).map(([k]: any)=>k)
                    }
                    localStorage.setItem('latest_result', JSON.stringify(latest))
                    navigate('/triage', { state: { reportData: latest } })
                  }}
                >
                  Consult
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-sm text-gray-500">No reports yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}