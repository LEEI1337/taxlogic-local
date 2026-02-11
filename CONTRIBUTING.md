# Contributing to TaxLogic.local

```
 ██████╗ ██████╗ ███╗   ██╗████████╗██████╗ ██╗██████╗ ██╗   ██╗████████╗██╗███╗   ██╗ ██████╗
██╔════╝██╔═══██╗████╗  ██║╚══██╔══╝██╔══██╗██║██╔══██╗██║   ██║╚══██╔══╝██║████╗  ██║██╔════╝
██║     ██║   ██║██╔██╗ ██║   ██║   ██████╔╝██║██████╔╝██║   ██║   ██║   ██║██╔██╗ ██║██║  ███╗
██║     ██║   ██║██║╚██╗██║   ██║   ██╔══██╗██║██╔══██╗██║   ██║   ██║   ██║██║╚██╗██║██║   ██║
╚██████╗╚██████╔╝██║ ╚████║   ██║   ██║  ██║██║██████╔╝╚██████╔╝   ██║   ██║██║ ╚████║╚██████╔╝
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═════╝  ╚═════╝    ╚═╝   ╚═╝╚═╝  ╚═══╝ ╚═════╝
```

First off, thank you for considering contributing to TaxLogic.local! It's people like you that make this tool better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@taxlogic.local.

For details, please read our full [Code of Conduct](CODE_OF_CONDUCT.md).

### Quick Summary

- **Be respectful** - Treat everyone with respect and kindness
- **Be constructive** - Provide helpful feedback and suggestions
- **Be inclusive** - Welcome newcomers and help them get started
- **Be patient** - Remember that everyone was once a beginner

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js >= 22.0.0
- npm >= 10.0.0
- Git
- Docker Desktop (for Ollama)
- Ollama in Docker (`docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama ollama/ollama`)
- Required models: `llama3.1:8b` and `nomic-embed-text`

### Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/taxlogic-local.git
cd taxlogic-local

# Add upstream remote
git remote add upstream https://github.com/LEEI1337/taxlogic-local.git
```

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Start Ollama in Docker

```bash
docker run -d --name ollama -p 11434:11434 -v ollama_data:/root/.ollama --restart unless-stopped ollama/ollama
docker exec ollama ollama pull llama3.1:8b
docker exec ollama ollama pull nomic-embed-text
```

### 4. Start Development Server

```bash
npm start
```

### 4. Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-ocr-support` - New features
- `fix/interview-crash` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/llm-service` - Code refactoring
- `test/add-db-tests` - Test additions

### Workflow

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation if needed

4. **Test your changes**
   ```bash
   npm run lint
   npm run type-check
   npm run test
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

---

## Coding Standards

For detailed coding standards, please refer to our comprehensive [Coding Standards Guide](docs/CODING_STANDARDS.md).

### Quick Overview

#### TypeScript

- Use strict TypeScript (`strict: true`)
- Always define types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
interface UserProfile {
  name: string;
  email: string;
}

function getUser(id: string): Promise<UserProfile | null> {
  // ...
}

// Bad
function getUser(id: any): any {
  // ...
}
```

#### React Components

- Use functional components with hooks
- Use meaningful component names
- Keep components small and focused
- Extract reusable logic into custom hooks

```typescript
// Good
function InterviewPage(): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);

  return (
    <div className="interview-page">
      {/* ... */}
    </div>
  );
}

export default InterviewPage;
```

#### CSS/Styling

- Use TailwindCSS utility classes
- Create component classes for repeated patterns
- Follow the existing design system (colors, spacing)

#### File Organization

```
src/
├── main/           # Electron main process only
├── renderer/       # React components only
│   ├── pages/      # Page-level components
│   ├── components/ # Reusable UI components
│   ├── stores/     # Zustand stores
│   └── styles/     # Global styles
└── backend/        # Backend services
    ├── agents/     # AI agents
    ├── services/   # Core services
    └── workflows/  # LangGraph workflows
```

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Formatting, missing semicolons, etc.
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding missing tests
- `chore` - Maintenance tasks

### Examples

```bash
# Feature
git commit -m "feat(interview): add multi-language support"

# Bug fix
git commit -m "fix(ocr): handle corrupted PDF files gracefully"

# Documentation
git commit -m "docs: update installation instructions"

# Refactor
git commit -m "refactor(llm): extract common query logic"
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventions

### PR Template

```markdown
## Description
Brief description of the changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How have you tested these changes?

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have added tests for my changes
- [ ] All new and existing tests pass
- [ ] I have updated the documentation
```

### Review Process

1. Create a pull request with a clear description
2. Wait for automated checks to pass
3. Address reviewer feedback
4. Once approved, a maintainer will merge

---

## Reporting Bugs

### Before Reporting

- Check if the bug has already been reported
- Try the latest version
- Collect relevant information

### Bug Report Template

```markdown
## Bug Description
A clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., Windows 11, macOS 14]
- Node.js: [e.g., 22.0.0]
- App Version: [e.g., 1.0.0]
- LLM Provider: [e.g., Ollama, LM Studio]

## Screenshots/Logs
If applicable, add screenshots or log output.
```

---

## Feature Requests

### Before Requesting

- Check if the feature has already been requested
- Consider if it fits the project's scope
- Think about privacy implications (we're local-first!)

### Feature Request Template

```markdown
## Feature Description
A clear description of the feature.

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How do you envision this working?

## Alternatives Considered
What alternatives have you considered?

## Additional Context
Any other context or screenshots.
```

---

## Questions?

Feel free to:
- Open an issue for questions
- Join our community discussions
- Reach out to maintainers

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Code of Conduct](CODE_OF_CONDUCT.md) | Community guidelines and behavior expectations |
| [Security Policy](SECURITY.md) | Security guidelines and vulnerability reporting |
| [Coding Standards](docs/CODING_STANDARDS.md) | Detailed coding standards and best practices |
| [Governance](docs/GOVERNANCE.md) | Project governance and decision making |
| [Architecture](docs/ARCHITECTURE.md) | System architecture and design |
| [API Reference](docs/API.md) | Complete API documentation |

---

Thank you for contributing! 🙏
