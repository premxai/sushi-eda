# 🍣 Sushi Test Files Guide

## Test Files Created

### 1. **test_complete.csv** (20 rows)
**Purpose:** Test CSV parsing with various data types and missing values

**Features:**
- ✅ Numeric columns: `id`, `age`, `salary`, `performance_score`
- ✅ Text columns: `name`, `email`, `department`, `city`
- ✅ Date column: `hire_date` (should be auto-detected)
- ✅ Boolean column: `is_active` (true/false)
- ✅ Missing values: Row 11 (missing email), Row 12 (missing salary), Row 13 (missing performance_score), Row 14 (missing hire_date)
- ✅ Duplicates: None intentionally added
- ✅ Outliers: Salary range 63k-105k (Frank Miller at 105k is potential outlier)

**Expected Analysis:**
- Quality Score: ~85-90 (A/B grade)
- Missing Data: ~5% (4 missing values out of 200 cells)
- Type Suggestions: hire_date → datetime, is_active → boolean
- Correlations: age vs salary, performance_score vs salary
- Outliers: High salary values (Frank Miller, Carol White)

---

### 2. **test_complete.json** (5 rows)
**Purpose:** Test JSON parsing with nested structures (arrays and objects)

**Features:**
- ✅ Flat fields: `id`, `name`, `email`, `age`, `salary`, `department`, `hire_date`, `is_active`, `performance_score`, `city`
- ✅ Nested array: `skills` (converted to JSON string)
- ✅ Nested object: `address` with `street` and `zip` (flattened to `address.street`, `address.zip`)
- ✅ No missing values
- ✅ Mixed data types

**Expected Analysis:**
- Quality Score: ~95-100 (A grade)
- Columns: 12+ (flat fields + flattened nested fields)
- Type Detection: hire_date → datetime, is_active → boolean
- Skills column: Displayed as JSON string array
- Address fields: Flattened as separate columns

---

### 3. **test_complete.xlsx** (10 rows)
**Purpose:** Test Excel parsing with proper data types

**Features:**
- ✅ All standard data types preserved
- ✅ Date column: `hire_date` (native Excel datetime)
- ✅ Boolean column: `is_active` (TRUE/FALSE)
- ✅ Numeric precision: Salary with decimals
- ✅ No missing values
- ✅ Clean dataset

**Expected Analysis:**
- Quality Score: ~98-100 (A grade)
- Perfect type detection (Excel preserves types)
- No missing data
- Correlations: age vs salary
- Department distribution: Engineering (4), Marketing (2), Sales (2), Management (2)

---

## 🧪 Testing Checklist

### CSV Upload Test
- [ ] Upload `test_complete.csv`
- [ ] Verify 20 rows, 10 columns detected
- [ ] Check quality score shows missing data penalty
- [ ] Verify hire_date detected as datetime
- [ ] Check missing values highlighted in column cards
- [ ] View outliers section for high salaries

### JSON Upload Test
- [ ] Upload `test_complete.json`
- [ ] Verify 5 rows detected
- [ ] Check nested `skills` array converted to string
- [ ] Verify `address.street` and `address.zip` columns created
- [ ] Confirm no "unhashable type" errors
- [ ] Check quality score is high (no missing data)

### Excel Upload Test
- [ ] Upload `test_complete.xlsx`
- [ ] Verify 10 rows, 10 columns detected
- [ ] Check date column properly parsed
- [ ] Verify boolean column recognized
- [ ] Confirm high quality score
- [ ] Check all visualizations render correctly

---

## 🎯 Expected Results Summary

| File Type | Rows | Columns | Quality Score | Key Features |
|-----------|------|---------|---------------|--------------|
| CSV | 20 | 10 | 85-90 (B+) | Missing values, outliers |
| JSON | 5 | 12+ | 95-100 (A) | Nested structures flattened |
| Excel | 10 | 10 | 98-100 (A) | Perfect type preservation |

---

## 🐛 Known Issues to Watch For

1. **JSON nested structures** - Should be converted to strings, not cause errors
2. **CSV missing values** - Should show up in quality score breakdown
3. **Excel dates** - Should be properly recognized as datetime
4. **CORS errors** - Backend must be running on port 8000

---

## ✅ Success Criteria

All three files should:
- ✅ Upload without errors
- ✅ Display quality score with grade
- ✅ Show column analysis with proper types
- ✅ Render correlation heatmap
- ✅ Display outliers (if any)
- ✅ Generate insights
- ✅ Allow PDF export
