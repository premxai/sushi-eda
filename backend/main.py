import io
import json
from typing import Optional, Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from loguru import logger

from analyzer import EDAAnalyzer
from visualizer import Visualizer
from advanced_stats import AdvancedStatistics

# Configure logging
logger.add("logs/app.log", rotation="500 MB", retention="10 days", level="INFO")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Sushi EDA API", version="1.0.0")

# CORS must be added first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In-memory store for the last uploaded DataFrame (single-user dev tool)
_current_df: Optional[pd.DataFrame] = None

# Simple in-memory cache for analysis results (file hash -> report)
_analysis_cache: dict[str, Any] = {}

def get_file_hash(contents: bytes) -> str:
    """Generate hash for file contents for caching."""
    import hashlib
    return hashlib.md5(contents).hexdigest()


def read_upload(file: UploadFile) -> pd.DataFrame:
    """Parse an uploaded file into a pandas DataFrame."""
    contents = file.file.read()
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "csv":
        return pd.read_csv(io.BytesIO(contents))
    elif ext == "tsv":
        return pd.read_csv(io.BytesIO(contents), sep="\t")
    elif ext in ("xls", "xlsx"):
        return pd.read_excel(io.BytesIO(contents), engine="openpyxl")
    elif ext == "parquet":
        return pd.read_parquet(io.BytesIO(contents))
    elif ext in ("db", "sqlite", "sqlite3"):
        # For SQLite, we need to save to a temp file
        import tempfile
        import sqlite3
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            conn = sqlite3.connect(tmp_path)
            # Get list of tables
            tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table'", conn)
            if len(tables) == 0:
                raise HTTPException(status_code=400, detail="No tables found in SQLite database")
            
            # Use the first table (or we could let user select)
            table_name = tables.iloc[0]['name']
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            conn.close()
            
            # Clean up temp file
            import os
            os.unlink(tmp_path)
            
            return df
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read SQLite database: {str(e)}")
    elif ext == "json":
        data = json.loads(contents.decode('utf-8'))
        if isinstance(data, list):
            df = pd.json_normalize(data, max_level=1) if data else pd.DataFrame()
        elif isinstance(data, dict):
            df = pd.json_normalize([data], max_level=1)
        else:
            raise HTTPException(status_code=400, detail="JSON must be an array or object")
        
        # Convert any remaining dict/list columns to strings to avoid unhashable type errors
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
        
        return df
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Accepted: csv, tsv, xlsx, xls, parquet, sqlite, json",
        )


@app.post("/upload")
@limiter.limit("10/minute")
async def upload_file(request: Request, file: UploadFile = File(...)):
    global _current_df
    
    logger.info(f"File upload request: {file.filename}")
    
    try:
        # Read file contents for hashing
        contents = file.file.read()
        file_hash = get_file_hash(contents)
        
        # Check cache
        if file_hash in _analysis_cache:
            logger.info(f"Cache hit for file: {file.filename}")
            _current_df = _analysis_cache[file_hash]["df"]
            return _analysis_cache[file_hash]["report"]
        
        # Reset file pointer for parsing
        file.file.seek(0)
        
        # Parse file
        df = read_upload(file)
        logger.info(f"Successfully parsed file: {file.filename}, shape: {df.shape}")
        
        # Limit rows for large datasets to prevent timeout
        if len(df) > 5000:
            logger.warning(f"Large dataset detected ({len(df)} rows), sampling to 5000 rows")
            df = df.sample(n=5000, random_state=42)
        
        _current_df = df

        # Run analysis
        logger.info(f"Starting analysis for {file.filename}")
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()
        logger.info(f"Analysis complete for {file.filename}")

        # Include a data preview (first 50 rows)
        preview = df.head(50).fillna("").to_dict(orient="records")
        report["preview"] = preview
        
        # Cache the result
        _analysis_cache[file_hash] = {"df": df, "report": report}
        logger.info(f"Cached result for {file.filename} with hash {file_hash[:8]}")

        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    """Upload + full analysis + all Plotly visualizations in one response."""
    global _current_df
    try:
        df = read_upload(file)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    _current_df = df

    analyzer = EDAAnalyzer(df)
    report = analyzer.generate_full_report()
    preview = df.head(50).fillna("").to_dict(orient="records")
    report["preview"] = preview

    viz = Visualizer(df)
    visualizations = viz.generate_all_visualizations()

    return {"analysis": report, "visualizations": visualizations}


@app.get("/visualize/{column_name}")
async def visualize_column(column_name: str, chart_type: str = "auto"):
    """On-demand chart generation for a single column."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    if column_name not in _current_df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    viz = Visualizer(_current_df)
    is_numeric = pd.api.types.is_numeric_dtype(_current_df[column_name])

    if chart_type == "auto":
        chart_type = "distribution" if is_numeric else "categorical_bar"

    if chart_type == "distribution":
        return viz.create_distribution_plot(column_name)
    elif chart_type == "box_plot":
        return viz.create_box_plot(column_name)
    elif chart_type == "categorical_bar":
        return viz.create_categorical_bar(column_name)
    else:
        raise HTTPException(status_code=400,
                            detail=f"Unknown chart_type '{chart_type}'. Use: distribution, box_plot, categorical_bar")


@app.get("/visualize")
async def visualize_all():
    """Generate all visualizations for the currently loaded dataset."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    viz = Visualizer(_current_df)
    return viz.generate_all_visualizations()


@app.post("/compare")
async def compare_datasets(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """Compare two datasets side-by-side."""
    try:
        df1 = read_upload(file1)
        df2 = read_upload(file2)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse files: {str(e)}")

    analyzer1 = EDAAnalyzer(df1)
    analyzer2 = EDAAnalyzer(df2)
    
    report1 = analyzer1.generate_full_report()
    report2 = analyzer2.generate_full_report()
    
    preview1 = df1.head(50).fillna("").to_dict(orient="records")
    preview2 = df2.head(50).fillna("").to_dict(orient="records")
    
    report1["preview"] = preview1
    report2["preview"] = preview2
    
    # Generate comparison insights
    comparison = {
        "schema_diff": {
            "file1_only": list(set(df1.columns) - set(df2.columns)),
            "file2_only": list(set(df2.columns) - set(df1.columns)),
            "common": list(set(df1.columns) & set(df2.columns)),
        },
        "row_count_diff": int(df1.shape[0]) - int(df2.shape[0]),
        "column_count_diff": int(df1.shape[1]) - int(df2.shape[1]),
    }
    
    return {
        "file1": {"name": file1.filename, "report": report1},
        "file2": {"name": file2.filename, "report": report2},
        "comparison": comparison,
    }


@app.get("/stats/advanced")
async def get_advanced_stats():
    """Get advanced statistical tests for the current dataset."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.generate_all_tests()


@app.post("/stats/regression")
async def perform_regression(x_col: str, y_col: str):
    """Perform linear regression between two columns."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.linear_regression(x_col, y_col)


@app.post("/stats/ttest")
async def perform_ttest(col1: str, col2: str):
    """Perform independent t-test between two columns."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.t_test_independent(col1, col2)


@app.get("/health")
async def health():
    """Health check endpoint for monitoring."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "cache_size": len(_analysis_cache),
        "current_df_loaded": _current_df is not None
    }
