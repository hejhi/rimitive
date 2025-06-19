# Data Analysis Workflow

## Purpose
Ensure reliable, reproducible data analysis by following a structured, multi-pass approach.

## Pre-requisites
- [ ] Identify data sources and formats
- [ ] Clarify analysis objectives
- [ ] Set up verification criteria

## Workflow Steps

### 1. Data Discovery Phase
**Goal: Understand structure without making assumptions**
- [ ] List all data files/sources
- [ ] Describe file formats (JSON, CSV, etc.)
- [ ] Note data sizes and volumes
- [ ] Document any obvious quality issues
- [ ] DO NOT analyze content yet

### 2. Schema Analysis Phase
**Goal: Map data structure and types**
- [ ] Identify all fields/columns
- [ ] Document data types for each field
- [ ] Note required vs optional fields
- [ ] Check for consistent structure
- [ ] Sample first/last records only

### 3. Basic Statistics Phase
**Goal: Gather quantitative overview**
- [ ] Count total records
- [ ] Calculate field completion rates
- [ ] Get min/max/mean for numeric fields
- [ ] Count unique values for categorical fields
- [ ] Identify any outliers or anomalies

### 4. Targeted Analysis Phase
**Goal: Answer specific questions**
- [ ] Address each analysis objective separately
- [ ] Use multiple methods to verify findings
- [ ] Document assumptions made
- [ ] Note confidence level for each finding
- [ ] Cross-reference related data points

### 5. Verification Phase
**Goal: Ensure reliability**
- [ ] Re-calculate key metrics differently
- [ ] Spot-check specific examples
- [ ] Verify edge cases handled correctly
- [ ] Test assumptions with counter-examples
- [ ] Document any limitations

### 6. Reporting Phase
**Goal: Clear, actionable insights**
- [ ] Summarize key findings
- [ ] Highlight data quality issues
- [ ] Provide confidence levels
- [ ] Suggest follow-up analyses
- [ ] Include reproducible examples

## Analysis Principles
- **Never assume data quality** - Verify everything
- **Show your work** - Include calculations
- **State uncertainties** - Be clear about limitations
- **Prefer simple methods** - Complex analysis hides errors
- **Incremental discovery** - Build understanding gradually

## Common Pitfalls to Avoid
- Analyzing before understanding structure
- Making conclusions from incomplete data
- Ignoring data quality issues
- Over-interpreting correlations
- Missing edge cases

## Verification Checklist
For each finding, ask:
- [ ] Can I reproduce this result differently?
- [ ] Have I checked for null/missing data?
- [ ] Does this make logical sense?
- [ ] What could invalidate this finding?
- [ ] How confident am I (1-10)?

## Example Analysis Structure
```markdown
## User Activity Analysis

### 1. Data Structure
- Source: user_events.json
- Format: Array of event objects
- Size: 45,231 records
- Date range: 2024-01-01 to 2024-12-31

### 2. Basic Statistics
- Total events: 45,231
- Unique users: 3,421
- Event types: 12
- Missing user_id: 0
- Missing timestamp: 23 (0.05%)

### 3. Key Findings
1. **Peak usage hours**: 2-4 PM (32% of events)
   - Verified by: Hourly histogram and percentile analysis
   - Confidence: 9/10
   
2. **Most active users**: Top 10% generate 67% of events
   - Verified by: Pareto analysis and user segmentation
   - Confidence: 10/10

### 4. Data Quality Notes
- 23 events missing timestamps (excluded from time analysis)
- Some user_ids appear to be test accounts (e.g., "test_user_123")
```