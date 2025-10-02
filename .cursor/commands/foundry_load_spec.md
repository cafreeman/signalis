# Load Spec With Foundry

## Overview
Load a complete specification using intelligent fuzzy matching to enable focused development work.

## Context Gathering & Parameter Resolution

**Discovery Workflow for Missing Parameters:**
1. **Project Name Missing:** Execute list_projects to display available options with metadata and guide user selection
2. **Spec Query Missing:** Execute list_specs for the target project and present specs in user-friendly format
3. **Both Present:** Proceed directly to fuzzy matching and loading workflow

**Validation & Preparation:**
- Verify target project exists in Foundry system before attempting spec operations
- Set user expectations about fuzzy matching capabilities and potential disambiguation needs
- Prepare for potential multiple matches requiring user selection

## Comprehensive Loading Workflow

### Step 1: Intelligent Spec Discovery
**Parameter Resolution Strategy:**
- **Missing Project:** Show list_projects with creation dates and brief descriptions for informed selection
- **Missing Spec:** Display list_specs results with feature names, dates, and completion status
- **Fuzzy Matching:** Use provided spec query with intelligent pattern matching

### Step 2: Spec Loading with Fuzzy Matching
**Execute Load Operation:**
```json
{"name":"load_spec","arguments":{"project_name":"$1","spec_name":"$2"}}
```

**Match Quality Assessment:**
- **High Confidence Single Match:** Load directly and proceed to content analysis
- **Multiple Matches:** Present candidates with feature names, creation dates, and similarity scores
- **Low Confidence:** Show alternatives and ask for clarification or more specific search terms
- **No Matches:** Suggest creating new spec or provide spelling/naming guidance

### Step 3: Comprehensive Content Analysis
**Specification Overview:**
- **Feature Summary:** Extract and highlight main feature purpose, scope, and value proposition
- **Development Status:** Analyze task completion percentage and identify remaining work
- **Context Assessment:** Review requirements, acceptance criteria, and implementation approach

**Task Portfolio Analysis:**
- **Incomplete Tasks:** Identify and prioritize pending tasks requiring attention
- **Blocked Dependencies:** Note any prerequisites or external dependencies preventing progress
- **Implementation Readiness:** Assess which tasks are ready for immediate development work

**Documentation Quality Review:**
- **Completeness Evaluation:** Identify missing sections or areas needing expansion
- **Clarity Assessment:** Note areas that might benefit from additional detail or examples
- **Consistency Check:** Ensure alignment between spec, tasks, and notes documents

## Error Recovery & Problem Resolution

**Loading & Discovery Issues:**
- **Spec Not Found:** Display available specs via list_specs and guide proper selection with fuzzy alternatives
- **Corrupted Spec Files:** Report specific file issues and provide guidance for recovery or recreation
- **Permission Errors:** Guide user through Foundry installation verification and system troubleshooting

**Fuzzy Matching Challenges:**
- **Too Many Matches:** Present top 5 candidates with distinguishing features and creation dates
- **Ambiguous Results:** Ask user for more specific search terms or suggest using exact spec names
- **Similarity Confusion:** Show match confidence scores and distinctive features for better selection

**System Integration Problems:**
- **Project Not Found:** Guide user to create project first or verify correct project name
- **Empty Project State:** Emphasize normal condition for new projects and suggest spec creation
- **MCP Connectivity:** Direct user to verify Foundry installation and system configuration

## Advanced Content Analysis Features

### Development Progress Assessment
**Task Completion Analysis:**
- **Progress Metrics:** Calculate completion percentage and estimate remaining effort
- **Milestone Tracking:** Identify major development phases and current position
- **Velocity Indicators:** Note patterns in task completion and modification history

**Implementation Readiness:**
- **Dependency Resolution:** Check if prerequisite tasks or external dependencies are satisfied
- **Resource Requirements:** Identify technical skills, tools, or infrastructure needed
- **Risk Assessment:** Note potential blockers or challenges mentioned in notes

### Content Quality & Completeness
**Documentation Standards:**
- **Section Coverage:** Verify all required specification sections are present and complete
- **Detail Sufficiency:** Assess whether implementation guidance is adequate for development
- **Example Availability:** Note presence of code examples, mockups, or concrete illustrations

**Integration Context:**
- **Related Specifications:** Identify connections to other specs or project components
- **External Dependencies:** Highlight third-party services, APIs, or system requirements
- **Testing Considerations:** Review acceptance criteria and validation approaches

## Workflow Continuity & Next Steps

### Immediate Development Actions
**For Active Implementation:**
- **Task Progression:** Use `/foundry_update_spec` to mark completed tasks and add new ones as work progresses
- **Requirement Changes:** Update specification sections when scope or requirements evolve during implementation
- **Knowledge Capture:** Add implementation insights, lessons learned, and technical decisions to notes

**For Planning & Review:**
- **Context Verification:** Consider `/foundry_load_project` to review broader project context and alignment
- **Related Work:** Use `/foundry_list_specs` to see this feature in context of overall project portfolio
- **Dependency Planning:** Load related specs that this feature depends on or connects to

### Strategic Development Guidance
**Implementation Prioritization:**
- **Quick Wins:** Identify tasks that can be completed rapidly to build momentum
- **Critical Path:** Highlight tasks that unblock other work or enable major functionality
- **Risk Mitigation:** Suggest tackling uncertain or complex tasks early for learning and adaptation

**Quality Assurance Planning:**
- **Testing Strategy:** Review acceptance criteria and plan comprehensive validation approach
- **Documentation Updates:** Ensure spec remains current as implementation progresses and understanding evolves
- **Integration Testing:** Plan for testing connections to other system components or external services

## Instructions for Agent
**Primary Mission:** Efficiently load target specification with intelligent disambiguation, perform comprehensive content analysis, and provide actionable development guidance based on current spec state.

**Content Delivery:** Present spec information in digestible format with clear development priorities, highlight immediate next steps, and provide context for decision-making.

**Success Standard:** User gains complete understanding of feature requirements, knows exactly what work remains, and has clear guidance for continuing development efficiently.
