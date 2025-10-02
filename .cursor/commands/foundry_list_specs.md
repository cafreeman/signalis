# List Specs With Foundry

## Overview
Discover and analyze existing specifications for a project to guide development planning and prioritization.

## Context Gathering Phase

**Project Discovery & Validation:**
1. **Parameter Resolution:** If project name missing, use list_projects to show available options and guide selection
2. **Project Context:** Load project summary if available to understand domain and development scope
3. **System Validation:** Ensure project exists in Foundry system before attempting spec listing

## Comprehensive Discovery Workflow

### Step 1: Project Resolution
**Missing Project Name Handling:**
- Execute list_projects to display available Foundry projects with metadata
- Present projects in user-friendly format with creation dates and brief descriptions
- Guide user to select appropriate project for spec exploration

**Project Validation:**
- Confirm target project exists and is accessible
- Load basic project context (vision/summary) if available for user orientation
- Set expectations about spec discovery process

### Step 2: Specification Listing & Analysis
**Execute Spec Discovery:**
```json
{"name":"list_specs","arguments":{"project_name":"$1"}}
```

**Results Processing & Presentation:**
- **Chronological Organization:** Present specs with newest first to show development progression
- **Metadata Display:** Include spec names, feature names, creation dates, and brief purpose descriptions
- **Status Assessment:** Highlight incomplete or recently modified specs for priority attention
- **Categorization:** Group by development phase, feature area, or completion status when patterns emerge

### Step 3: Development Insights & Analysis
**Spec Portfolio Assessment:**
- **Project Maturity:** Evaluate development progress based on spec count and completion patterns
- **Feature Coverage:** Identify areas with comprehensive specifications vs gaps needing attention
- **Development Velocity:** Note patterns in spec creation and modification timing
- **Priority Identification:** Highlight specs with incomplete tasks or recent activity

**Pattern Recognition:**
- **Feature Dependencies:** Identify logical groupings or prerequisite relationships
- **Development Phases:** Recognize infrastructure vs feature vs optimization specifications
- **Resource Allocation:** Understand where development effort has been focused

## Error Recovery & Problem Resolution

**Project Access Issues:**
- **Project Not Found:** Display available projects via list_projects and guide proper selection
- **Empty Project:** Emphasize this is normal for new projects and suggest creating first specification
- **Permission Problems:** Guide user through Foundry installation verification and troubleshooting

**Display & Usability Challenges:**
- **Large Spec Count:** Offer filtering options by date, status, or feature area for manageable display
- **Complex Naming:** Present specs with both technical names and user-friendly feature descriptions
- **No Specifications:** Frame as opportunity rather than problem and guide toward spec creation

## Workflow Continuity & Next Steps

### Immediate Action Recommendations
**When Specs Exist:**
- **Active Development:** Suggest `/foundry_load_spec [project-name] [spec-query]` for detailed work on specific features
- **Planning Phase:** Recommend reviewing incomplete specs to understand current development priorities
- **Quality Review:** Consider loading recently modified specs to assess progress and next steps

**When No Specs Found:**
- **First Spec Creation:** Guide toward `/foundry_create_spec [project-name] [feature-name]` to begin development planning
- **Project Planning:** Suggest reviewing project vision to identify logical first features or capabilities
- **Architecture Planning:** Consider starting with foundational or infrastructure specifications

### Strategic Development Guidance
**Portfolio Analysis:**
- **Multiple Incomplete Specs:** Suggest prioritizing completion with `/foundry_update_spec` for focused progress
- **Recent Activity Patterns:** Highlight likely continuation candidates based on modification dates
- **Feature Gap Identification:** Point out areas where new specifications might add value

**Development Workflow Optimization:**
- **Spec Sequencing:** Help identify logical order for feature implementation based on dependencies
- **Resource Planning:** Guide allocation of effort based on spec complexity and business priority
- **Quality Assurance:** Suggest regular spec reviews to maintain accuracy and relevance

## Advanced Analysis Features

### Development Metrics & Insights
**Progress Tracking:**
- **Completion Rates:** Assess percentage of specs with completed task lists
- **Development Patterns:** Identify cycles of specification creation vs implementation
- **Feature Scope:** Understand breadth vs depth of current development approach

**Quality Assessment:**
- **Documentation Standards:** Note consistency in spec format and completeness
- **Update Frequency:** Identify specs that may need attention due to staleness
- **Integration Planning:** Recognize specs that connect to or depend on others

## Instructions for Agent
**Primary Objective:** Efficiently discover project specifications, present them in actionable format with development insights, and guide user toward most logical next steps in their development workflow.

**Value Delivery:** Transform simple spec listing into comprehensive development planning assistance that helps users understand their project's current state and optimal next actions.

**Success Metrics:** User gains clear understanding of project development status, knows which specs need attention, and receives actionable guidance for continuing their development work.
