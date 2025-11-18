# MediSense AI - Medical Report Intelligence System

A comprehensive medical report extraction and analysis system that uses AI to extract health data from PDF reports, predict disease risks, and provide professional medical triage advice.

## Features

- **PDF Report Processing**: Advanced OCR and text extraction from medical reports
- **Multi-Disease Prediction**: Support for Heart Disease, Diabetes, Parkinson's, and Anemia
- **AI-Powered Triage**: Professional medical advice using LLM technology
- **Health Scoring**: Comprehensive health assessment with risk breakdown
- **Dr. Intelligence Chatbot**: Interactive medical consultation interface
- **Report History**: Complete patient report management and tracking

## Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Prisma**: Modern database ORM with Neon Postgres
- **JWT Authentication**: Secure token-based authentication
- **LLM Integration**: Gemini and Groq for medical advice
- **OCR**: Tesseract for text extraction from PDFs
- **Machine Learning**: Scikit-learn for disease prediction models

### Frontend
- **React 18**: Modern React with TypeScript
- **Vite**: Fast build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Router**: Client-side routing

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Tesseract OCR (`brew install tesseract` on macOS)

### Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database credentials

# Run database migrations
prisma generate
prisma db push

# Start the API server
make api
```

### Frontend Setup
```bash
cd web
npm install
npm run dev
```

### Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## API Endpoints

### Authentication
- `POST /auth/clerk_sync` - Sync Clerk user authentication

### Report Processing
- `POST /ingest/report` - Upload and process PDF reports
- `GET /features/schema` - Get feature schema for diseases
- `POST /features/complete` - Complete feature extraction

### Prediction & Triage
- `POST /predict/with_features` - Get disease predictions
- `POST /triage` - Get AI-powered medical advice

### History
- `GET /history/reports` - Get user report history
- `GET /health` - System health check

## Environment Variables

### Required
- `DATABASE_URL` - Neon Postgres database connection string
- `JWT_SECRET` - Secret key for JWT token generation

### Optional
- `GEMINI_API_KEY` - Google Gemini API key for LLM
- `GROQ_API_KEY` - Groq API key for alternative LLM
- `ALLOWED_ORIGINS` - CORS allowed origins (default: *)
- `ALLOWED_HOSTS` - Allowed hostnames for security

## Production Deployment

### Using Docker
```bash
# Build and run with Docker
docker build -t medisense-ai .
docker run -p 8000:8000 --env-file .env medisense-ai
```

### Using Vercel (Frontend)
```bash
cd web
vercel deploy
```

### Environment Configuration
Set production environment variables in your deployment platform:
- Database connection string
- API keys for LLM services
- JWT secret for authentication
- CORS and security settings

## Disease Models

### Heart Disease Prediction
Uses 13 clinical features including age, sex, chest pain type, blood pressure, cholesterol, and ECG results.

### Diabetes Prediction
Analyzes glucose levels, BMI, age, and other metabolic indicators.

### Parkinson's Detection
Processes voice recordings and clinical measurements for early detection.

### Anemia Assessment
Evaluates hemoglobin levels, RBC count, and related blood parameters.

## Health Scoring System

The system provides a comprehensive health score (0-100) with:
- **Risk Assessment**: Disease probability analysis
- **Feature Breakdown**: Top contributing factors
- **Personalized Recommendations**: Lifestyle and medical advice
- **Confidence Scoring**: Reliability indicators for predictions

## Security Features

- JWT-based authentication
- Input validation and sanitization
- CORS protection
- Rate limiting capabilities
- Secure file upload handling
- Database connection security

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This system is for educational and informational purposes only. It should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions.