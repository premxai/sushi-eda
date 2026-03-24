# Non-Technical UX Plan For Sushi

Date: 2026-03-23

## Goal

Make Sushi usable for non-technical users without removing the technical depth that analysts and power users need.

Core principle:

- do not lead with methods
- lead with user intent
- keep advanced controls available, but secondary

## Problem

Current feature labels like `Statistics`, `Transforms`, `SQL`, `Monitors`, and `Pipelines` are understandable to analysts, but intimidating to business users.

For non-technical users, these labels create three problems:

1. They do not know which feature to choose.
2. They do not understand what the feature will do for them.
3. They are afraid of making the wrong selection.

This creates product friction even when the underlying capability is strong.

## Product Direction

Do not remove technical features.

Instead:

- repackage them in outcome-based language
- add guided workflows
- show plain-English summaries first
- collapse technical detail behind an advanced layer

This lets Sushi serve two user types:

- non-technical users who want answers
- technical users who want control

## Saved Dataset Model Should Be Default

Uploaded datasets should be saved automatically and treated as persistent assets, not temporary analysis sessions.

Why this matters:

- users expect uploaded work to still be there later
- users expect to return to prior analysis without re-uploading
- users expect their data to behave like a saved project, not a disposable file

If a user uploads a dataset and it does not appear reliably in `My Datasets`, the product breaks a core trust expectation.

Recommended default behavior:

1. Upload creates a saved dataset immediately.
2. The dataset appears in `My Datasets` right away.
3. The dataset shows a clear status:
   - uploading
   - analyzing
   - ready
   - failed
4. The user can reopen it at any time.
5. The user can rename, star, archive, delete, compare, and reuse it.

This changes the product from a one-time analysis tool into a persistent data workspace.

## Dataset Persistence UX Recommendations

### Required baseline behavior

- auto-save every upload by default
- show the dataset in `My Datasets` immediately
- persist analysis results against that dataset
- allow reopen from `My Datasets`
- keep dataset name editable

### Recommended dataset actions

- rename dataset
- star or pin important datasets
- archive instead of immediately delete
- permanently delete with confirmation
- compare against another saved dataset
- create report from dataset
- create monitor from dataset
- rerun analysis if needed

### Dashboard improvements

- show recent datasets on the home screen
- show processing status for in-flight uploads
- show failed datasets with a retry path
- show last opened datasets for quick return

## Investor Framing For Saved Datasets

Saved datasets strengthen the business case because they create:

- retention
- repeat usage
- dataset history
- collaboration opportunities
- expansion into monitoring, comparison, and automation

This is strategically stronger than a temporary upload-and-analyze flow.

Positioning:

“Every upload becomes a reusable data asset inside the workspace.”

## Product Rule

Temporary analysis should be the exception.

Saved-by-default should be the standard workflow.

## Rename Technical Features Into Outcome-Based Language

Recommended renames:

- `Statistics` -> `Compare & Validate`
- `Transforms` -> `Clean & Improve`
- `SQL Editor` -> `Ask With Data`
- `Correlations` -> `What Moves Together`
- `Outliers` -> `Unusual Values`
- `Monitors` -> `Data Watchlist`
- `Pipelines` -> `Repeat This Workflow`
- `Columns` -> `Field Health`
- `Overview` -> `Data Summary`

## Replace Method Selection With Goal Selection

Non-technical users should not start by picking:

- t-test
- ANOVA
- regression
- Mann-Whitney
- chi-square

They should start by picking what they want to know.

Recommended top-level prompts:

- Are these two groups different?
- What changed before and after?
- What is driving this number?
- Which values look suspicious?
- Which fields need cleaning?
- What should I track over time?

The system should choose the right statistical or analytical method behind the scenes.

## Guided Analysis Layer

Add a new layer above the current technical engine called `Guided Analysis`.

Flow:

1. User picks a goal.
2. User answers 1-3 simple questions.
3. Sushi selects the right method automatically.
4. Results are shown in plain English.
5. Advanced details are expandable.

Example questions:

- Which number do you want to improve?
- Which groups should be compared?
- Which column represents time?
- Which column is the outcome?

## Result Presentation

Results should be reordered for non-technical comprehension.

Show this first:

- short answer
- confidence level
- chart or comparison card
- recommended next action

Show this second:

- why the system reached that conclusion
- assumptions and caveats

Show this last:

- p-value
- test name
- coefficients
- diagnostics
- raw tables

## Suggested UX Patterns

### 1. Ask A Question Entry Point

Add a prominent entry point such as:

- `Ask a Question`
- `What do you want to learn from this data?`

Suggested cards:

- Compare groups
- Find what drives a result
- Detect unusual values
- Improve data quality
- Create a report

### 2. Beginner And Advanced Modes

Use a simple toggle:

- `Guided`
- `Advanced`

Guided mode:

- hides method names
- uses business language
- asks fewer questions

Advanced mode:

- exposes full stats, SQL, transforms, and monitor settings

### 3. Recommended Actions

After analysis, suggest what to do next:

- Compare customer segments
- Clean this column
- Export a report
- Track this metric weekly
- Create a watchlist alert

### 4. Explainability

Each result should include:

- `What this means`
- `Why Sushi chose this method`
- `How confident we are`

This builds trust with non-technical users.

## Example Reframes

### Current

`Statistics`

### Better

`Compare & Validate`

Sub-options:

- Compare two groups
- Check whether a change is meaningful
- Find what influences a result

### Current

`Transforms`

### Better

`Clean & Improve`

Sub-options:

- Fix missing values
- Standardize messy fields
- Create easier-to-use columns

### Current

`SQL Editor`

### Better

`Ask With Data`

Primary option:

- Ask in plain language

Secondary option:

- Open advanced query editor

## What Should Change In This Project

Recommended product changes for Sushi:

### Phase 1: Copy And Labeling

- rename technical sections across the UI
- rewrite descriptions in business language
- change nav labels to outcome-based labels
- update landing page copy to emphasize answers, not methods

### Phase 2: Guided Workflows

- add `Guided Analysis` above the current statistics surface
- add predefined question templates
- add plain-English summaries before technical outputs
- add suggested next actions after every major result

### Phase 3: Progressive Disclosure

- add `Advanced Mode`
- keep technical features available but hidden by default
- let power users expand into full controls

### Phase 4: Verticalized Templates

Add role-based starters:

- Sales: which segments convert better?
- Finance: what changed in revenue or margin?
- Product: which factors correlate with retention?
- Ops: where is the data quality risk?

This will make the product feel approachable immediately.

## Investor Framing

This is not a weakness in the product.

This is the roadmap:

“The engine is technically deep, but the interface will become intent-driven. Non-technical users will get answers in plain language, while power users keep full analytical control.”

That creates a stronger market position because the same platform can serve:

- business teams
- analysts
- hybrid operators

## Recommended Priority

If time is limited, prioritize in this order:

1. Rename technical sections
2. Add guided question-based entry points
3. Reorder result cards into plain-English-first layouts
4. Add advanced toggles
5. Add role-based workflow templates

## Success Criteria

This UX shift is working if a non-technical user can:

- upload a file
- choose a goal without knowing statistical terminology
- get a useful answer in plain English
- take a next action without asking for analyst help

## One-Line Positioning

Sushi should feel less like “a toolkit of analysis methods” and more like “a data copilot that helps you understand, clean, compare, and act on business data.”
