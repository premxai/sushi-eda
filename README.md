# 🍣 Sushi

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Serve Your Raw Data Perfectly** with quality scores, type suggestions, interactive visualizations, and actionable insights — all in a beautiful, modern interface.

## 🍱 Features

### 📁 Multiple Data Formats
- **CSV** — Comma-separated values
- **TSV** — Tab-separated values
- **Excel** — .xlsx and .xls files
- **JSON** — Nested JSON with automatic flattening
- **Parquet** — High-performance columnar format
- **SQLite** — Database files (.db, .sqlite, .sqlite3)

### 🎯 Core Analysis
- **Data Quality Score** — 0-100 score with A-F grade, breakdown by missing data, duplicates, outliers, type consistency, and unique ratios
- **Smart Type Detection** — Auto-detect datetime columns, suggest categorical conversions, identify numeric strings and boolean patterns
- **Interactive Visualizations** — Plotly-powered distribution charts, correlation heatmaps, box plots, and categorical bars with hover insights
- **Outlier Detection** — IQR-based detection with visual indicators and statistics
- **Column Analysis** — Detailed per-column stats: missing %, unique count, mean/median/std/skew, top values

### � Advanced Statistics
- **Hypothesis Testing** — Independent t-test, chi-square test, one-way ANOVA
- **Regression Analysis** — Simple linear regression with R² and RMSE metrics
- **Normality Tests** — Shapiro-Wilk test for distribution analysis
- **Correlation Significance** — Pearson correlation with p-values

### 🚀 Export & Sharing
- **Excel Export** — Multi-sheet workbook with data, summary, correlations, and outliers
- **Markdown Reports** — Comprehensive analysis report in markdown format
- **Chart Export** — Download visualizations as PNG or SVG
- **Dataset Comparison** — Upload two files for side-by-side comparison with schema diff analysis

### ⚡ Performance & UX
- **Smart Row Sampling** — Automatic sampling for datasets >5000 rows to prevent timeouts
- **In-Memory Caching** — MD5-based caching for instant re-analysis of duplicate files
- **Rate Limiting** — 10 requests/minute per IP to prevent abuse
- **File Size Validation** — 100MB upload limit with graceful error handling

### 🎨 UX Polish
- **Loading Skeletons** — Smooth loading states during analysis
- **Tooltips** — Hover over metrics for additional context
- **Keyboard Shortcuts** — Press `?` for help modal
- **Error Boundaries** — Graceful error handling prevents crashes
- **Responsive Design** — Mobile-friendly interface with adaptive layouts

## 📸 Preview

> **Note:** Add screenshots here after deployment

- Dashboard Overview with Quality Score
- Column Analysis with Type Suggestions
- Interactive Correlation Heatmap
- Dataset Comparison View
- PDF Export Preview

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Local Development

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/devwhisperer.git
cd devwhisperer
```

**2. Start Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**3. Start Frontend**
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

**4. Open Browser**
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Docker Compose (Recommended)

```bash
docker-compose up --build
```

Access the app at `http://localhost:3000`

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, pandas, numpy, scipy, scikit-learn, plotly, pyarrow, loguru, slowapi |
| **Frontend** | Next.js 14, TypeScript, React, Tailwind CSS, shadcn/ui |
| **Visualization** | Plotly.js, react-plotly.js |
| **Export** | openpyxl (Excel), markdown |
| **Deployment** | Docker, Render, Vercel |

## 📚 API Documentation

### Endpoints

#### `POST /upload`
Upload and analyze a dataset.

**Rate Limit:** 10 requests/minute

**Request:**
```bash
curl -X POST http://localhost:8000/upload \
  -F "file=@data.csv"
```

**Response:**
```json
{
  "basic_info": { "rows": 1000, "columns": 10, ... },
  "column_analysis": [...],
  "correlation_matrix": {...},
  "outliers": [...],
  "quality_score": { "overall_score": 85, "grade": "B", ... },
  "type_suggestions": {...},
  "preview": [...]
}
```

#### `POST /compare`
Compare two datasets side-by-side.

**Request:**
```bash
curl -X POST http://localhost:8000/compare \
  -F "file1=@data1.csv" \
  -F "file2=@data2.csv"
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "cache_size": 3,
  "current_df_loaded": true
}
```

#### `GET /visualize/{column_name}`
Generate visualization for a specific column.

#### `GET /visualize`
Generate all visualizations for the loaded dataset.

#### `GET /stats/advanced`
Get advanced statistical tests (normality, correlation significance).

#### `POST /stats/regression`
Perform linear regression between two columns.

**Parameters:** `x_col`, `y_col`

#### `POST /stats/ttest`
Perform independent t-test between two columns.

**Parameters:** `col1`, `col2`

#### `GET /export/excel`
Export current dataset and analysis to Excel workbook.

#### `GET /export/markdown`
Export analysis report as markdown file.

## 🌍 Environment Variables

### Backend
No environment variables required for basic operation. Logging is configured in `main.py`.

### Frontend

Create `.env.local` from `.env.example`:

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Clerk Authentication (Get from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Optional Clerk redirects (defaults provided)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Optional
NODE_ENV=development
```

For production:
```bash
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NODE_ENV=production
```

**⚠️ Important:** You must create a free Clerk account at https://clerk.com to get authentication keys. The app requires authentication to function.

## 🚢 Deployment

### Backend Deployment

#### Option 1: Railway
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Deploy:
```bash
cd backend
railway init
railway up
```
4. Set environment variables in Railway dashboard if needed

#### Option 2: Render
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use `render.yaml` configuration (already included)
4. Render will auto-deploy on git push

### Frontend Deployment

#### Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy:
```bash
cd frontend
vercel --prod
```
3. Set environment variables in Vercel dashboard (Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = your backend URL
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = from Clerk dashboard
   - `CLERK_SECRET_KEY` = from Clerk dashboard

#### Alternative: Docker
```bash
docker build -t devwhisperer-frontend ./frontend
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=https://api.example.com devwhisperer-frontend
```

### Full Stack with Docker Compose
```bash
# Update docker-compose.yml with your production URLs
docker-compose up -d
```

## 🧪 Testing

### Run Test Suite
```bash
./scripts/test-all.sh
```

This will verify:
- ✅ Backend health endpoint
- ✅ File upload functionality
- ✅ Frontend accessibility

### Manual Testing with Sample Data
```bash
# Upload sample dataset
curl -X POST http://localhost:8000/upload \
  -F "file=@sample_data/sales_data.csv"

# Compare two datasets
curl -X POST http://localhost:8000/compare \
  -F "file1=@sample_data/sales_data.csv" \
  -F "file2=@sample_data/customer_data.csv"
```

### Test Features
1. **Quality Score**: Upload `sample_data/sales_data.csv` and check Overview section
2. **Type Detection**: Check for datetime/categorical suggestions in the API response
3. **PDF Export**: Click "Export PDF" button in dashboard header
4. **Dataset Comparison**: Navigate to `/compare` and upload two files
5. **Keyboard Shortcuts**: Press `?` key to see shortcuts modal
6. **Caching**: Upload the same file twice - second upload should be instant

## 📁 Project Structure

```
DevWhisperer/
├── backend/
│   ├── main.py              # FastAPI app with rate limiting & logging
│   ├── analyzer.py          # EDA analysis engine
│   ├── visualizer.py        # Plotly chart generation
│   ├── quality_score.py     # Data quality scoring
│   ├── type_detector.py     # Smart type detection
│   ├── Dockerfile           # Backend container
│   ├── requirements.txt     # Python dependencies
│   ├── railway.json         # Railway deployment config
│   └── render.yaml          # Render deployment config
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Main dashboard
│   │   │   ├── compare/page.tsx   # Comparison page
│   │   │   ├── layout.tsx         # Root layout with SEO
│   │   │   └── globals.css        # Tailwind + shadcn styles
│   │   ├── components/
│   │   │   ├── dashboard/         # Dashboard sections
│   │   │   ├── visualizations/    # Plotly chart components
│   │   │   ├── ui/                # shadcn/ui primitives
│   │   │   ├── ExportButton.tsx   # PDF export
│   │   │   ├── ErrorBoundary.tsx  # Error handling
│   │   │   ├── KeyboardShortcuts.tsx
│   │   │   └── LoadingSkeleton.tsx
│   │   └── lib/
│   │       ├── api.ts       # API client
│   │       ├── types.ts     # TypeScript interfaces
│   │       └── utils.ts     # Utilities
│   ├── Dockerfile           # Frontend container
│   ├── .env.example         # Environment template
│   └── vercel.json          # Vercel deployment config
├── sample_data/
│   ├── sales_data.csv       # Sample sales dataset
│   └── customer_data.csv    # Sample customer dataset
├── scripts/
│   ├── deploy-backend.sh    # Backend deployment script
│   ├── deploy-frontend.sh   # Frontend deployment script
│   └── test-all.sh          # Test all features
├── docker-compose.yml       # Full stack orchestration
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Visualizations powered by [Plotly](https://plotly.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Email: support@devwhisperer.dev
- Documentation: [https://docs.devwhisperer.dev](https://docs.devwhisperer.dev)

---

**Made with ❤️ by the DevWhisperer Team**
