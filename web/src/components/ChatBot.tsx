import React, { useState, useRef, useEffect } from 'react'
import { X, MessageCircle, Send, Bot, User } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatBotProps {
  isOpen: boolean
  onClose: () => void
  userData?: {
    task?: string
    features?: Record<string, any>
    prediction?: any
    lifestyle?: any
    symptoms?: any
    extracted_text?: string
    highlights?: string[]
  }
}

export default function ChatBot({ isOpen, onClose, userData }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastReportId, setLastReportId] = useState<string | null>(null)
  const [lastOpenedTime, setLastOpenedTime] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Reset chat when userData changes (new report submitted)
  useEffect(() => {
    if (userData && userData.task && userData.prediction) {
      // Create a unique ID for this report to detect changes
      const currentReportId = `${userData.task}-${JSON.stringify(userData.prediction)}-${userData.prediction_id || ''}`
      
      // Only reset if this is a different report
      if (currentReportId !== lastReportId) {
        console.log('New report detected - resetting floating chatbot conversation')
        setLastReportId(currentReportId)
        
        // Clear chat history for new session
        localStorage.removeItem('dr_intelligence_chat_history_floating')
        
        // Clear current messages immediately for visual feedback
        setMessages([])
        
        // Set new greeting with updated context after a brief delay
        setTimeout(() => {
          const greeting = getContextualGreeting()
          setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: greeting,
            timestamp: new Date()
          }])
        }, 100)
      }
    }
  }, [userData, lastReportId]) // Reset when userData changes

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // If we have new userData (report), don't load old history
      if (userData?.task && userData?.prediction) {
        // New report detected, greeting will be set by the userData effect
        return
      }
      
      // Check for shared chat history first - use separate key for floating chatbot
      const sharedHistory = localStorage.getItem('dr_intelligence_chat_history_floating')
      if (sharedHistory) {
        try {
          const parsedHistory = JSON.parse(sharedHistory)
          if (parsedHistory.length > 0) {
            // Convert timestamps back to Date objects and set messages
            const historyWithDates = parsedHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
            setMessages(historyWithDates)
            return // Don't show greeting if we have history
          }
        } catch (error) {
          console.error('Error loading shared chat history:', error)
        }
      }
      
      // Show initial greeting if no history and no new report
      const greeting = getContextualGreeting()
      setMessages([{
        id: '1',
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      }])
    }
  }, [isOpen, userData]) // Add userData dependency to prevent conflicts

  // Listen for changes in shared chat history - use separate key for floating chatbot
  useEffect(() => {
    if (!isOpen) return
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dr_intelligence_chat_history_floating' && e.newValue) {
        try {
          const parsedHistory = JSON.parse(e.newValue)
          if (parsedHistory.length > 0) {
            const historyWithDates = parsedHistory.map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
            // Only update if the history is different from current messages
            setMessages((currentMessages) => {
              if (currentMessages.length === 0 || 
                  JSON.stringify(currentMessages.map(m => ({id: m.id, content: m.content}))) !== 
                  JSON.stringify(historyWithDates.map((m: any) => ({id: m.id, content: m.content})))) {
                return historyWithDates
              }
              return currentMessages
            })
          }
        } catch (error) {
          console.error('Error syncing shared chat history:', error)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setLastOpenedTime(Date.now())
    }
  }, [isOpen])

  const getContextualGreeting = () => {
    // Always use current userData first, avoid stale localStorage data
    if (userData?.prediction) {
      const { label, health_score, probability } = userData.prediction
      const riskLevel = label === 1 ? 'higher risk' : 'lower risk'
      
      // Build detailed context with actual values
      let detailedContext = ''
      
      if (userData?.features && Object.keys(userData.features).length > 0) {
        const keyMetrics = getKeyMetrics(userData.task, userData.features)
        if (keyMetrics.length > 0) {
          detailedContext = ` Key findings include: ${keyMetrics.join(', ')}.`
        }
      }
      
      return `Hello! I'm Dr. Intelligence, your AI Health Assistant. I've analyzed your medical data and see you have a health score of ${health_score?.toFixed(1)}/100 with ${riskLevel} indicators.${detailedContext} I'm here to provide professional medical guidance. How can I assist you today?`
    }
    
    if (userData?.task) {
      const taskNames: Record<string, string> = {
        'heart': 'cardiovascular health',
        'diabetes': 'diabetes management',
        'parkinsons': 'neurological health',
        'general': 'general health'
      }
      const taskName = taskNames[userData.task] || 'health'
      
      // Build context with actual values for general health too
      let detailedContext = ''
      if (userData?.features && Object.keys(userData.features).length > 0) {
        const keyMetrics = getKeyMetrics(userData.task, userData.features)
        if (keyMetrics.length > 0) {
          detailedContext = ` I can see your ${keyMetrics.join(', ')}.`
        }
      }
      
      return `Hello! I'm Dr. Intelligence, your AI Health Assistant. I see you're interested in ${taskName} analysis.${detailedContext} I can provide medical guidance and answer your health questions. What would you like to discuss?`
    }

    // Only use localStorage as absolute last resort
    const latestResult = (() => {
      try { 
        return JSON.parse(localStorage.getItem('latest_result') || 'null') 
      } catch { 
        return null 
      }
    })()

    if (latestResult?.prediction) {
      const { label, health_score, probability } = latestResult.prediction
      const riskLevel = label === 1 ? 'higher risk' : 'lower risk'
      return `Hello! I'm Dr. Intelligence, your AI Health Assistant. I've analyzed your medical data and see you have a health score of ${health_score?.toFixed(1)}/100 with ${riskLevel} indicators. I'm here to provide professional medical guidance. How can I assist you today?`
    }
    
    return "Hello! I'm Dr. Intelligence, your AI Health Assistant. I provide medical guidance and answer health-related questions. How may I assist you today?"
  }

  const getKeyMetrics = (task: string, features: Record<string, any>): string[] => {
    const metrics: string[] = []
    
    switch (task) {
      case 'heart':
        if (features.chol !== undefined) metrics.push(`cholesterol: ${features.chol} mg/dL`)
        if (features.trestbps !== undefined) metrics.push(`blood pressure: ${features.trestbps} mmHg`)
        if (features.thalach !== undefined) metrics.push(`max heart rate: ${features.thalach} bpm`)
        if (features.age !== undefined) metrics.push(`age: ${features.age} years`)
        break
        
      case 'diabetes':
        if (features.Glucose !== undefined) metrics.push(`glucose: ${features.Glucose} mg/dL`)
        if (features.BMI !== undefined) metrics.push(`BMI: ${features.BMI}`)
        if (features.BloodPressure !== undefined) metrics.push(`blood pressure: ${features.BloodPressure} mmHg`)
        if (features.Age !== undefined) metrics.push(`age: ${features.Age} years`)
        if (features.Pregnancies !== undefined && features.Pregnancies > 0) metrics.push(`pregnancies: ${features.Pregnancies}`)
        break
        
      case 'parkinsons':
        if (features.jitter_percent !== undefined) metrics.push(`voice jitter: ${features.jitter_percent}%`)
        if (features.shimmer !== undefined) metrics.push(`voice shimmer: ${features.shimmer}`)
        if (features.rap !== undefined) metrics.push(`amplitude perturbation: ${features.rap}`)
        if (features.nhr !== undefined) metrics.push(`noise-to-harmonics ratio: ${features.nhr}`)
        break
    }
    
    return metrics
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Prepare context from user data
      const context = prepareContext()
      
      // Use the triage endpoint for professional medical advice
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:8000/triage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          task: userData?.task || 'general',
          features: userData?.features || {},
          model_output: userData?.prediction || null,
          complaint: `${context}\n\nUser Question: ${input.trim()}`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      
      // Format the response to make it more readable and professional
      const formattedContent = formatMedicalResponse(data.triage_summary || 'I apologize, but I couldn\'t generate a response. Please try again.')
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formattedContent,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Sync chat history to localStorage for this floating chatbot instance
      const updatedMessages = [...messages, userMessage, assistantMessage]
      localStorage.setItem('dr_intelligence_chat_history_floating', JSON.stringify(updatedMessages.slice(-10))) // Keep last 10 messages
      
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m experiencing a temporary connection issue. Please try your question again in a moment, or contact support if the problem persists.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const prepareContext = () => {
    let context = ''
    
    // Add current medical data context
    if (userData?.prediction) {
      const { label, health_score, probability, top_contributors } = userData.prediction
      context += `Patient Health Analysis:\n`
      context += `- Health Score: ${health_score?.toFixed(2)}/100\n`
      context += `- Risk Level: ${label === 1 ? 'Higher Risk' : 'Lower Risk'} (${(probability * 100).toFixed(1)}% probability)\n`
      if (top_contributors?.length) {
        context += `- Key Health Indicators: ${top_contributors.join(', ')}\n`
      }
      context += '\n'
    }

    if (userData?.features && Object.keys(userData.features).length > 0) {
      context += 'Extracted Medical Data:\n'
      Object.entries(userData.features).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          context += `- ${formatMedicalKey(key)}: ${value}\n`
        }
      })
      context += '\n'
    }

    if (userData?.highlights && Array.isArray(userData.highlights) && userData.highlights.length > 0) {
      context += 'Highlighted Abnormal Values:\n'
      userData.highlights.forEach((k) => {
        context += `- ${formatMedicalKey(k)} (abnormal)\n`
      })
      context += '\n'
    }

    if (userData?.extracted_text && userData.extracted_text.length > 0) {
      const snippet = userData.extracted_text.slice(0, 400)
      context += 'Report Text Snippet:\n'
      context += snippet + (userData.extracted_text.length > 400 ? '...\n\n' : '\n\n')
    }

    if (userData?.lifestyle) {
      context += 'Lifestyle Information:\n'
      Object.entries(userData.lifestyle).forEach(([key, value]) => {
        context += `- ${formatLifestyleKey(key)}: ${value}\n`
      })
      context += '\n'
    }

    if (userData?.symptoms) {
      const activeSymptoms = Object.entries(userData.symptoms)
        .filter(([_, value]) => value === true)
        .map(([key, _]) => formatSymptomKey(key))
      
      if (activeSymptoms.length > 0) {
        context += 'Reported Symptoms:\n'
        activeSymptoms.forEach(symptom => {
          context += `- ${symptom}\n`
        })
        context += '\n'
      }
    }

    // Enhanced conversation history context with better tracking
    const recentMessages = messages.slice(-8) // Increased to 8 for better context
    if (recentMessages.length > 0) {
      context += 'Recent Conversation History:\n'
      
      // Track topics discussed to avoid repetition
      const discussedTopics = new Set<string>()
      
      recentMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'Patient' : 'Doctor'
        // Extract key topics from user messages to avoid repetition
        if (msg.role === 'user') {
          const content = msg.content.toLowerCase()
          if (content.includes('diet') || content.includes('food') || content.includes('eat')) {
            discussedTopics.add('diet')
          }
          if (content.includes('exercise') || content.includes('workout') || content.includes('activity')) {
            discussedTopics.add('exercise')
          }
          if (content.includes('stress') || content.includes('anxiety') || content.includes('sleep')) {
            discussedTopics.add('lifestyle')
          }
          if (content.includes('medicine') || content.includes('medication') || content.includes('pill')) {
            discussedTopics.add('medication')
          }
        }
        
        const content = msg.content.length > 150 ? msg.content.substring(0, 150) + '...' : msg.content
        context += `${role}: ${content}\n`
      })
      
      context += '\n'
      
      // Add specific context based on conversation flow
      if (messages.length > 2) {
        const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]
        const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]
        
        context += `Conversation Context: This is a follow-up question. `
        
        if (lastUserMessage && lastAssistantMessage) {
          const userQuestion = lastUserMessage.content.toLowerCase()
          
          if (userQuestion.includes('diet') || userQuestion.includes('food')) {
            context += `The patient is asking about dietary recommendations. `
            if (discussedTopics.has('diet')) {
              context += `They've already received general diet advice, so provide specific, new dietary guidance. `
            }
          } else if (userQuestion.includes('exercise') || userQuestion.includes('workout')) {
            context += `The patient is asking about exercise recommendations. `
            if (discussedTopics.has('exercise')) {
              context += `They've already received general exercise advice, so provide specific, new exercise guidance. `
            }
          } else if (userQuestion.includes('why') || userQuestion.includes('reason')) {
            context += `The patient is asking for explanations or reasons. Provide detailed medical reasoning. `
          } else if (userQuestion.includes('when') || userQuestion.includes('how long')) {
            context += `The patient is asking about timing or duration. Provide specific timelines. `
          }
          
          context += `Reference their previous questions and provide new, specific information rather than repeating general advice. `
          context += `Use a natural, conversational tone like a doctor remembering their patient. `
          context += `Build upon previous advice rather than starting over.\n\n`
        }
      }
    }

    return context
  }

  const formatMedicalKey = (key: string) => {
    const labels: Record<string, string> = {
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

  const formatLifestyleKey = (key: string) => {
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

  const formatSymptomKey = (key: string) => {
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

  const formatMedicalResponse = (content: string) => {
    if (!content || content.trim().length === 0) {
      return "I'm reviewing your medical information. Please ask any specific questions about your health."
    }

    // Clean up the content for professional appearance
    let formatted = content
      // Remove all emojis
      .replace(/[📊🔍💡❓⚠️✅❌⭐🎯👨‍⚕️👩‍⚕️🩺💊🏥]/g, "")
      // Remove markdown headers
      .replace(/##/g, "")
      // Remove doctor/AI prefixes
      .replace(/Doctor:\s*|Dr\.\s*\w+:\s*|AI\s+Assistant:\s*/gi, "")
      // Simplify clinical language and make more natural
      .replace(/Clinical\s+Analysis|Based\s+on\s+the\s+analysis|According\s+to\s+the\s+data/gi, "Based on your information")
      .replace(/I\s+recommend|My\s+recommendation/gi, "I recommend")
      .replace(/You\s+should|You\s+must/gi, "I suggest")
      // Remove repetitive template phrases
      .replace(/I\s+can\s+see\s+that\s+your|I\s+notice\s+that\s+your/gi, "Your")
      .replace(/which\s+is\s+quite\s+impressive|which\s+is\s+very\s+good/gi, "")
      .replace(/considering\s+your\s+age\s+of\s+\d+/gi, "")
      // Remove asterisks from section headers
      .replace(/\*Analysis\*/gi, "Analysis")
      .replace(/\*Recommendations\*/gi, "Recommendations")
      .replace(/\*Next Steps\*/gi, "Next Steps")
      .replace(/\*Important\*/gi, "Important")
      .replace(/\*Summary\*/gi, "Summary")
      .replace(/\*Conclusion\*/gi, "Conclusion")
      .trim()

    // Format for readability
    formatted = formatted
      .replace(/^\s*[\-\*•]\s*/gm, "• ") // Standardize bullet points
      .replace(/^\s*\d+\.\s*/gm, "$&") // Keep numbered lists
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 600;">$1</strong>') // Simple bold
      .replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1; font-style: italic;">$1</em>') // Simple italic
      .replace(/\n\s*\n\s*\n/g, "\n\n") // Clean up excessive line breaks
      .replace(/\s{2,}/g, " ") // Remove excessive spaces
      .trim()

    // Make section headers more professional and natural
    formatted = formatted
      .replace(/^Analysis\n/i, "Based on your information:\n")
      .replace(/^Recommendations\n/i, "My recommendations:\n")
      .replace(/^Next Steps\n/i, "Next steps:\n")
      .replace(/^Important\n/i, "Important notes:\n")
      .replace(/^Summary\n/i, "Summary:\n")
      .replace(/^Conclusion\n/i, "Conclusion:\n")

    // Add professional spacing and formatting
    let result = formatted
      .replace(/^(?!<div|<p|<br|<•|\s*$)(.+)$/gm, '<p style="margin: 0 0 8px 0; line-height: 1.6; font-size: 15px;">$1</p>')
      .replace(/^•\s+(.+)$/gm, '<div style="margin: 4px 0 4px 16px;">• $1</div>')
      .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin: 4px 0 4px 20px;">$&</div>')

    // Make responses more concise and natural
    result = result
      .replace(/In\s+addition\s+to\s+the\s+above/gi, "Additionally")
      .replace(/Furthermore\s+to\s+the\s+previous\s+point/gi, "Also")
      .replace(/It\s+is\s+worth\s+noting/gi, "Note:")
      .replace(/I\s+would\s+like\s+to\s+emphasize/gi, "I emphasize")
      // Remove repetitive cholesterol/blood pressure mentions
      .replace(/your\s+cholesterol\s+level\s+is\s+\d+.*?\./gi, "")
      .replace(/your\s+blood\s+pressure\s+is\s+\d+.*?\./gi, "")
      // Make follow-up responses more natural
      .replace(/I\s+can\s+see\s+that\s+your/gi, "Your")
      .replace(/Based\s+on\s+these\s+results/gi, "Based on your results")

    // Add medical disclaimer if not already present
    if (!result.toLowerCase().includes("consult") && !result.toLowerCase().includes("professional")) {
      result += '<div style="margin-top: 12px; font-size: 0.8em; color: #94a3b8; font-style: italic;">Note: Consult a healthcare professional for personalized medical advice.</div>'
    }

    return result
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Add CSS for pulse animation and chatbot styling
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .chatbot-content {
        line-height: 1.6 !important;
        font-size: 15px !important;
      }
      
      .chatbot-content p {
        margin: 0 0 8px 0 !important;
        line-height: 1.6 !important;
        font-size: 15px !important;
      }
      
      .chatbot-content p:last-child {
        margin-bottom: 0 !important;
      }
      
      .chatbot-content br {
        display: block !important;
        margin: 8px 0 !important;
        content: "" !important;
      }
      
      .chatbot-content strong {
        font-weight: 600 !important;
        color: #ffffff !important;
      }
      
      .chatbot-content em {
        color: #cbd5e1 !important;
        font-style: italic !important;
      }
      
      .chatbot-content div {
        margin-bottom: 8px !important;
      }
      
      .chatbot-content div:last-child {
        margin-bottom: 0 !important;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 100,
      right: 20,
      width: 420,
      height: 650,
      backgroundColor: '#0f172a',
      borderRadius: 20,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px',
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: '#ffffff',
        borderRadius: '16px 16px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <Bot size={20} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 17, color: '#ffffff', letterSpacing: '0.5px' }}>Dr. Intelligence</div>
            <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 400 }}>AI Medical Assistant</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: '#0f172a'
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: message.role === 'user' ? '#3b82f6' : '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              {message.role === 'user' ? (
                <User size={18} color="#ffffff" />
              ) : (
                <Bot size={18} color="#ffffff" />
              )}
            </div>
            
            {/* Message Bubble */}
            <div style={{
              maxWidth: '80%',
              padding: message.role === 'user' ? '16px 20px' : '20px 24px',
              borderRadius: message.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
              backgroundColor: message.role === 'user' ? '#3b82f6' : '#1e40af',
              color: '#ffffff',
              fontSize: 15,
              lineHeight: 1.8,
              boxShadow: message.role === 'user' 
                ? '0 6px 16px rgba(59, 130, 246, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)' 
                : '0 6px 16px rgba(30, 64, 175, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)',
              position: 'relative',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
              transform: 'translateY(0)',
              animation: message.role === 'assistant' ? 'fadeInUp 0.4s ease-out' : 'none'
            }}>
              <div style={{
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: '1.8',
                letterSpacing: '0.3px'
              }}>
                <div 
                  className="chatbot-content" 
                  dangerouslySetInnerHTML={{ __html: message.content }} 
                  style={{
                    display: 'block',
                    lineHeight: '1.8'
                  }}
                />
              </div>
              
              {/* Timestamp */}
              <div style={{
                fontSize: 11,
                opacity: 0.8,
                marginTop: 12,
                textAlign: message.role === 'user' ? 'right' : 'left',
                fontWeight: 400,
                letterSpacing: '0.5px',
                color: message.role === 'user' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)',
                fontFamily: 'Inter, sans-serif'
              }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginLeft: 48 // Align with assistant messages
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Bot size={18} color="#ffffff" />
            </div>
            <div style={{
              padding: '16px 20px',
              borderRadius: '20px 20px 20px 6px',
              backgroundColor: '#1e40af',
              color: '#ffffff',
              fontSize: 15,
              lineHeight: 1.6,
              boxShadow: '0 6px 16px rgba(30, 64, 175, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  animation: 'pulse 1.5s infinite'
                }} />
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  animation: 'pulse 1.5s infinite 0.2s'
                }} />
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  animation: 'pulse 1.5s infinite 0.4s'
                }} />
              </div>
              <span style={{ fontSize: 14, opacity: 0.9 }}>Dr. Intelligence is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-end',
        backgroundColor: '#1e293b'
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Dr. Intelligence about your health..."
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            minHeight: 48,
            maxHeight: 120,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            transition: 'all 0.2s ease',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#334155'}
          rows={1}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: (!input.trim() || isLoading) ? 0.6 : 1,
            transition: 'all 0.2s ease',
            minWidth: 48,
            minHeight: 48,
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!(!input.trim() || isLoading)) {
              e.currentTarget.style.backgroundColor = '#2563eb'
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}