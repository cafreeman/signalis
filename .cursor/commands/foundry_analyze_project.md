# Analyze Project With Foundry

## Overview
Analyze an existing codebase and create comprehensive Foundry project documents using MCP tools.

## Context Gathering Phase

**Before Starting Analysis:**
1. **Repository Structure Scan:** Examine README, package.json/Cargo.toml/pyproject.toml, docker files, CI configs
2. **Foundry System Check:** Use list_projects to avoid naming conflicts and understand existing portfolio
3. **Deployment Context:** Look for infrastructure configs, deployment scripts, environment files

## Detailed Analysis Workflow

### Step 1: Repository Discovery
**Technical Infrastructure:**
- Languages and frameworks (check package managers, import patterns, build configs)
- Build tools and deployment infrastructure (CI/CD, containerization, cloud configs)
- Service architecture and component relationships (microservices, monolith, APIs)
- Documentation quality and project maturity indicators

### Step 2: Document Drafting (No Boilerplate Content)
**Vision Document (200+ chars minimum):**
- Clear problem statement with specific user pain points
- Target audience and their core motivations
- Unique value proposition and competitive advantages
- High-level roadmap priorities and success metrics

**Tech Stack Document (150+ chars minimum):**
- Primary languages and frameworks with specific rationale
- Infrastructure and deployment platform choices with reasoning
- Database and data storage decisions with justification
- Development tools, testing, and CI/CD approach
- External integrations and API dependencies

**Summary Document (100+ chars minimum):**
- 2-3 sentences capturing project essence for immediate context loading
- Should enable future AI assistants to understand project purpose instantly

### Step 3: User Collaboration & Refinement
**Review Process:**
- Present all three documents simultaneously for holistic feedback
- Ask specific clarifying questions about technical decisions and business context
- Validate assumptions about user needs, market positioning, and technical constraints
- Ensure all content meets quality standards and minimum length requirements

### Step 4: MCP Integration
**Execute Project Creation:**
```json
{"name":"analyze_project","arguments":{"project_name":"$1","vision":"<final_vision>","tech_stack":"<final_tech_stack>","summary":"<final_summary>"}}
```

## Error Recovery Strategies

**Content Validation Issues:**
- **Length insufficient:** Guide user to expand sections with concrete details and examples
- **Generic content:** Request specific metrics, technology versions, and architectural details
- **Inconsistent information:** Highlight conflicts between documents and ask for clarification

**Technical Analysis Challenges:**
- **Complex architecture:** Break down into focused sections and validate understanding with user
- **Missing documentation:** Ask targeted questions to fill gaps in technical understanding
- **Legacy systems:** Help identify modernization opportunities and technical debt areas

**MCP Tool Errors:**
- **Project name conflicts:** Suggest variations or ask user to choose alternative naming
- **Invalid project format:** Auto-suggest kebab-case conversion for consistency
- **Permission/access issues:** Guide user to verify Foundry installation and system permissions

## Workflow Continuity

**After Successful Analysis:**
- **Immediate next step:** Use `/foundry_create_spec` to define first feature or improvement
- **Planning phase:** Consider `/foundry_list_specs` if project already has some specifications
- **Development roadmap:** Begin systematic feature specification process for development workflow

**Quality Assurance:**
- **Content accuracy:** Verify technical details match actual codebase implementation
- **Future usability:** Ensure documents provide sufficient context for development teams
- **Completeness:** Confirm all major architectural and business aspects are captured

## Advanced Analysis Techniques

**Architectural Assessment:**
- **Scalability patterns:** Identify current approach to handling growth and load
- **Security posture:** Note authentication, authorization, and data protection patterns
- **Performance characteristics:** Understand current optimization strategies and bottlenecks
- **Maintainability factors:** Assess code organization, testing, and documentation practices

**Business Context Integration:**
- **User journey mapping:** Connect technical architecture to user experience flows
- **Competitive positioning:** Understand how technical choices support business differentiation
- **Growth planning:** Identify technical enablers and constraints for business scaling
- **Risk assessment:** Note technical debt areas and potential modernization needs

## Instructions for Agent
**Primary Workflow:** Systematically gather repository context through file analysis and codebase examination, draft comprehensive vision/tech-stack/summary documents collaboratively with the user, then call the Foundry MCP "analyze_project" tool with finalized content that meets all quality and length requirements.

**Success Criteria:** Created project documents should enable any future developer or AI assistant to understand the project's purpose, technical architecture, and development context without additional research.
